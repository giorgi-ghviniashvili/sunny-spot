import { Geo } from "../lib/geo.js";

/** Picks candidate places: staggered rings of points around the origin. */
export class CandidateSampler {
  #kmPerDriveHour;
  #rings;

  constructor({ kmPerDriveHour, rings }) {
    this.#kmPerDriveHour = kmPerDriveHour;
    this.#rings = rings;
  }

  /** The origin first, then the ring points out to `maxDriveHours`. */
  sample(origin, maxDriveHours) {
    const reachKm = maxDriveHours * this.#kmPerDriveHour;
    const points = [{ lat: origin.lat, lon: origin.lon }];

    this.#rings.forEach(([radiusFraction, count], ringIndex) => {
      const step = 360 / count;
      const stagger = ringIndex % 2 ? step / 2 : 0;
      for (let i = 0; i < count; i++) {
        points.push(Geo.destination(origin, stagger + step * i, reachKm * radiusFraction));
      }
    });
    return points;
  }
}
