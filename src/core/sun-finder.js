import { SunnyRule } from "./sunny-rule.js";

/**
 * The core idea of the app:
 *   arrival = departure + drive time
 * and a place only counts if it is sunny from `arrival` for the whole stay.
 */
export class SunFinder {
  #router;
  #weather;
  #geocoder;
  #sampler;
  #config;

  constructor({ router, weather, geocoder, sampler, config }) {
    this.#router = router;
    this.#weather = weather;
    this.#geocoder = geocoder;
    this.#sampler = sampler;
    this.#config = config;
  }

  /**
   * @param {{ origin, start: Date, maxDriveHours, stayHours, maxCloudPct }} trip
   * @param {(message: string) => void} onProgress
   * @returns {{ spots, top, sunnyCount }} every assessed spot, the best few, and how many are sunny
   */
  async search(trip, onProgress = () => {}) {
    onProgress("Calculating drive times…");
    const reachable = await this.#reachablePlaces(trip);
    if (!reachable.length) throw new Error("No reachable places found — try a longer drive.");

    onProgress(`Checking the forecast at ${reachable.length} places…`);
    const spots = await this.#assess(reachable, trip);

    const sunny = spots.filter((spot) => spot.status === "sunny").sort((a, b) => a.durationSec - b.durationSec);
    const top = (sunny.length ? sunny : SunFinder.#leastCloudy(spots)).slice(0, this.#config.search.topResults);

    onProgress("Looking up place names…");
    await this.#namePlaces(top);

    return { spots, top, sunnyCount: sunny.length };
  }

  /** Sampled points we can drive to in time, snapped to roads and de-duplicated. */
  async #reachablePlaces({ origin, maxDriveHours }) {
    const sampled = this.#sampler.sample(origin, maxDriveHours);
    const drives = await this.#router.driveTimes(sampled);
    const seen = new Set();

    return drives.flatMap((drive, i) => {
      const isOrigin = i === 0;
      const { lat, lon } = isOrigin ? origin : drive.snapped;
      const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;

      const unreachable = drive.durationSec == null || drive.durationSec > maxDriveHours * 3600;
      const offRoad = !isOrigin && drive.snapDistanceM > this.#config.search.maxSnapDistanceM;
      if (unreachable || offRoad || seen.has(key)) return [];

      seen.add(key);
      return [{ lat, lon, isOrigin, durationSec: drive.durationSec, distanceM: drive.distanceM }];
    });
  }

  /** Attach arrival time, the forecast for the stay, and a sunny/cloudy/dark verdict. */
  async #assess(places, { start, stayHours, maxCloudPct }) {
    const rule = new SunnyRule({ maxCloudPct, maxPrecipMm: this.#config.sunny.maxPrecipMm });
    const forecasts = await this.#weather.forecasts(places);
    const startSec = Math.floor(start.getTime() / 1000);

    return places.flatMap((place, i) => {
      const arrivalSec = startSec + place.durationSec;
      const hours = forecasts[i].window(arrivalSec, stayHours);
      return hours ? [{ ...place, arrivalSec, hours, ...rule.assess(hours) }] : [];
    });
  }

  async #namePlaces(spots) {
    await Promise.all(spots.map(async (spot) => {
      spot.place = spot.isOrigin
        ? { name: "Right where you are", region: "No driving needed" }
        : await this.#geocoder.reverse(spot);
    }));
  }

  static #leastCloudy(spots) {
    return spots
      .filter((spot) => spot.status !== "dark")
      .sort((a, b) => a.avgCloud - b.avgCloud || a.durationSec - b.durationSec);
  }
}
