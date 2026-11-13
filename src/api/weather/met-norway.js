import { Geo } from "../../lib/geo.js";
import { Forecast } from "./forecast.js";

/**
 * MET Norway: one place per request, worldwide coverage.
 * Steps are hourly for ~2.5 days, then 6-hourly; we expand them to an hourly grid
 * and work out day/night ourselves from the sun's elevation.
 */
export class MetNorwayProvider {
  name = "MET Norway";
  #http;
  #url;
  #concurrency;
  #daylightElevationDeg;

  constructor(http, url, { metNorwayConcurrency }, { daylightElevationDeg }) {
    this.#http = http;
    this.#url = url;
    this.#concurrency = metNorwayConcurrency;
    this.#daylightElevationDeg = daylightElevationDeg;
  }

  async forecasts(points) {
    const forecasts = new Array(points.length);
    let next = 0;
    const worker = async () => {
      while (next < points.length) {
        const i = next++;
        forecasts[i] = await this.#fetchOne(points[i]);
      }
    };
    await Promise.all(Array.from({ length: this.#concurrency }, worker));
    return forecasts;
  }

  async #fetchOne(point) {
    const data = await this.#http.getJSON(`${this.#url}?lat=${point.lat.toFixed(4)}&lon=${point.lon.toFixed(4)}`);
    return this.#toHourly(data.properties.timeseries, point);
  }

  #toHourly(timeseries, point) {
    const steps = timeseries.map((step) => ({ time: Date.parse(step.time) / 1000, data: step.data }));
    const hourly = { time: [], cloudCover: [], precipitation: [], isDay: [], weatherCode: [], temperature: [] };

    let s = 0;
    for (let time = steps[0].time; time <= steps.at(-1).time; time += 3600) {
      while (s + 1 < steps.length && steps[s + 1].time <= time) s++;
      const { instant, next_1_hours: next1, next_6_hours: next6, next_12_hours: next12 } = steps[s].data;
      const symbol = (next1 ?? next6 ?? next12)?.summary?.symbol_code ?? "";

      hourly.time.push(time);
      hourly.cloudCover.push(Math.round(instant.details.cloud_area_fraction ?? 100));
      hourly.precipitation.push(MetNorwayProvider.#precipPerHour(next1, next6));
      hourly.isDay.push(Geo.sunElevation(point, time) > this.#daylightElevationDeg ? 1 : 0);
      hourly.weatherCode.push(MetNorwayProvider.#symbolToWmo(symbol));
      hourly.temperature.push(instant.details.air_temperature);
    }
    return new Forecast(hourly);
  }

  static #precipPerHour(next1, next6) {
    if (next1) return next1.details.precipitation_amount ?? 0;
    if (next6) return (next6.details.precipitation_amount ?? 0) / 6;
    return 0;
  }

  static #symbolToWmo(symbol) {
    if (symbol.includes("thunder")) return 95;
    if (symbol.includes("snow")) return 71;
    if (symbol.includes("rain") || symbol.includes("sleet")) return 61;
    if (symbol.startsWith("fog")) return 45;
    if (symbol.startsWith("cloudy")) return 3;
    if (symbol.startsWith("partlycloudy")) return 2;
    if (symbol.startsWith("fair")) return 1;
    return 0; // clear sky
  }
}
