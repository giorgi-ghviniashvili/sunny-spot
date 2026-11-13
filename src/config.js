/**
 * Every tunable value in the app lives here.
 *
 * Override anything by passing a partial object to `new Config({...})`,
 * by setting `window.SUNNY_SPOT_CONFIG` before the app loads, or — for the
 * form defaults — through the URL: `?from=Seattle&drive=2&stay=3&clouds=40`.
 */
const DEFAULTS = {
  endpoints: {
    osrm: "https://router.project-osrm.org",
    openMeteo: "https://api.open-meteo.com/v1/forecast",
    metNorway: "https://api.met.no/weatherapi/locationforecast/2.0/compact",
    nominatim: "https://nominatim.openstreetmap.org/search",
    reverseGeocode: "https://api.bigdatacloud.net/data/reverse-geocode-client",
    tiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },

  /** How candidate places are sampled and ranked. */
  search: {
    kmPerDriveHour: 70, // straight-line km covered per hour of driving
    rings: [[0.12, 8], [0.25, 10], [0.4, 12], [0.55, 14], [0.72, 16], [0.9, 18], [1.05, 20]], // [radius fraction, points]
    maxSnapDistanceM: 15_000, // drop samples this far from any road (sea, lakes…)
    topResults: 5,
    forecastHorizonDays: 6,
  },

  /** What counts as "sunny" besides the user's cloud limit. */
  sunny: {
    maxPrecipMm: 0.1, // per hour, exclusive
    daylightElevationDeg: -0.833, // sun above this = day
  },

  weather: {
    forecastDays: 8,
    openMeteoTimeoutMs: 8000,
    openMeteoBatchSize: 50,
    metNorwayConcurrency: 6,
  },

  /** Form options and their initial values. */
  form: {
    from: "",
    driveHourOptions: [1, 2, 3, 4, 5],
    stayHourOptions: [1, 2, 3, 4],
    maxDriveHours: 3,
    stayHours: 2,
    maxCloudPct: 30,
    cloudRange: { min: 10, max: 60, step: 5 },
  },

  map: { center: [46.8, 8.2], zoom: 6, maxZoom: 19 },
};

export class Config {
  constructor(overrides = {}) {
    Object.assign(this, Config.#freeze(Config.#merge(DEFAULTS, overrides)));
    Object.freeze(this);
  }

  /** Defaults + `window.SUNNY_SPOT_CONFIG` + URL parameters. */
  static fromEnvironment({ search = location.search, global = window.SUNNY_SPOT_CONFIG } = {}) {
    const base = new Config(global ?? {});
    return new Config(Config.#merge(global ?? {}, { form: Config.#formFromUrl(search, base.form) }));
  }

  static #formFromUrl(search, form) {
    const params = new URLSearchParams(search);
    const out = {};
    const pick = (key, allowed) => {
      const n = Number(params.get(key));
      return params.has(key) && allowed(n) ? n : undefined;
    };

    const drive = pick("drive", (n) => form.driveHourOptions.includes(n));
    const stay = pick("stay", (n) => form.stayHourOptions.includes(n));
    const clouds = pick("clouds", (n) => n >= form.cloudRange.min && n <= form.cloudRange.max);

    if (params.get("from")) out.from = params.get("from");
    if (drive !== undefined) out.maxDriveHours = drive;
    if (stay !== undefined) out.stayHours = stay;
    if (clouds !== undefined) out.maxCloudPct = clouds;
    return out;
  }

  static #isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  static #merge(base, extra) {
    const out = { ...base };
    for (const [key, value] of Object.entries(extra ?? {})) {
      out[key] = Config.#isPlainObject(value) && Config.#isPlainObject(base[key]) ? Config.#merge(base[key], value) : value;
    }
    return out;
  }

  static #freeze(value) {
    if (value && typeof value === "object") Object.values(value).forEach((v) => Config.#freeze(v));
    return Object.freeze(value);
  }
}
