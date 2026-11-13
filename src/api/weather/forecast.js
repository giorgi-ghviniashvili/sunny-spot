/**
 * An hourly forecast for one place, in a provider-neutral shape.
 * Every array is aligned with `time` (unix seconds, one entry per hour).
 */
export class Forecast {
  constructor({ time, cloudCover, precipitation, isDay, weatherCode, temperature }) {
    this.time = time;
    this.cloudCover = cloudCover;
    this.precipitation = precipitation;
    this.isDay = isDay;
    this.weatherCode = weatherCode; // WMO code
    this.temperature = temperature; // °C
  }

  /** The `hours` hourly entries starting at `fromUnixSec`, or null if out of range. */
  window(fromUnixSec, hours) {
    const first = Math.round((fromUnixSec - this.time[0]) / 3600);
    if (first < 0 || first + hours > this.time.length) return null;

    return Array.from({ length: hours }, (_, offset) => {
      const i = first + offset;
      return {
        time: this.time[i],
        cloud: this.cloudCover[i],
        precip: this.precipitation[i],
        isDay: Boolean(this.isDay[i]),
        code: this.weatherCode[i],
        temp: this.temperature[i],
      };
    });
  }
}
