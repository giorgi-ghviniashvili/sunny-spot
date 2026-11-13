/** Decides whether a run of forecast hours counts as sunny. */
export class SunnyRule {
  #maxCloudPct;
  #maxPrecipMm;

  constructor({ maxCloudPct, maxPrecipMm }) {
    this.#maxCloudPct = maxCloudPct;
    this.#maxPrecipMm = maxPrecipMm;
  }

  /** → { status: "sunny" | "cloudy" | "dark", avgCloud } */
  assess(hours) {
    const avgCloud = Math.round(hours.reduce((sum, hour) => sum + hour.cloud, 0) / hours.length);
    if (hours.some((hour) => !hour.isDay)) return { status: "dark", avgCloud };

    const clear = hours.every((hour) => hour.cloud <= this.#maxCloudPct && hour.precip < this.#maxPrecipMm);
    return { status: clear ? "sunny" : "cloudy", avgCloud };
  }
}
