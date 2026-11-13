import { Forecast } from "./forecast.js";

/** Open-Meteo: many places per request. */
export class OpenMeteoProvider {
  name = "Open-Meteo";
  #http;
  #url;
  #options;

  constructor(http, url, { forecastDays, openMeteoTimeoutMs, openMeteoBatchSize }) {
    this.#http = http;
    this.#url = url;
    this.#options = { forecastDays, timeoutMs: openMeteoTimeoutMs, batchSize: openMeteoBatchSize };
  }

  async forecasts(points) {
    const { batchSize } = this.#options;
    const forecasts = [];
    for (let i = 0; i < points.length; i += batchSize) {
      forecasts.push(...(await this.#fetchBatch(points.slice(i, i + batchSize))));
    }
    return forecasts;
  }

  async #fetchBatch(points) {
    const params = new URLSearchParams({
      latitude: points.map((p) => p.lat.toFixed(4)).join(","),
      longitude: points.map((p) => p.lon.toFixed(4)).join(","),
      hourly: "cloud_cover,precipitation,is_day,weather_code,temperature_2m",
      timeformat: "unixtime",
      timezone: "GMT",
      forecast_days: this.#options.forecastDays,
    });
    const data = await this.#http.getJSON(`${this.#url}?${params}`, { timeoutMs: this.#options.timeoutMs });
    return [data].flat().map(({ hourly }) => new Forecast({
      time: hourly.time,
      cloudCover: hourly.cloud_cover,
      precipitation: hourly.precipitation,
      isDay: hourly.is_day,
      weatherCode: hourly.weather_code,
      temperature: hourly.temperature_2m,
    }));
  }
}
