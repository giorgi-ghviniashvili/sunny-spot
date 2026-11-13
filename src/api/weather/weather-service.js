/**
 * Asks weather providers in order. When one fails (unreachable, timeout),
 * it moves on to the next and stays there for the rest of the session.
 */
export class WeatherService {
  #providers;
  #active = 0;

  constructor(providers) {
    this.#providers = providers;
  }

  get providerName() {
    return this.#providers[this.#active].name;
  }

  /** One Forecast per point, in the same order. */
  async forecasts(points) {
    for (;;) {
      const provider = this.#providers[this.#active];
      try {
        return await provider.forecasts(points);
      } catch (error) {
        if (this.#active === this.#providers.length - 1) throw error;
        console.warn(`${provider.name} failed, trying the next weather provider.`, error);
        this.#active++;
      }
    }
  }
}
