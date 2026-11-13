import { Geocoder } from "./api/geocoder.js";
import { Router } from "./api/router.js";
import { MetNorwayProvider } from "./api/weather/met-norway.js";
import { OpenMeteoProvider } from "./api/weather/open-meteo.js";
import { WeatherService } from "./api/weather/weather-service.js";
import { CandidateSampler } from "./core/candidate-sampler.js";
import { SunFinder } from "./core/sun-finder.js";
import { HttpClient } from "./lib/http.js";
import { MapView } from "./ui/map-view.js";
import { ResultsView } from "./ui/results-view.js";
import { SearchForm } from "./ui/search-form.js";
import { ThemeBadge } from "./ui/theme-badge.js";

/** Wires the form, the search and the views together. */
export class App {
  #config;
  #geocoder;
  #router;
  #weather;
  #finder;
  #form;
  #map;
  #results;

  #origin = null; // { lat, lon, label }
  #resolvedPlace = ""; // the text that #origin was resolved from
  #trip = null; // the last searched trip (form values + origin)

  constructor(config) {
    this.#config = config;
    const { endpoints } = config;
    const http = new HttpClient();

    this.#geocoder = new Geocoder(http, endpoints);
    this.#router = new Router(http, endpoints.osrm);
    this.#weather = new WeatherService([
      new OpenMeteoProvider(http, endpoints.openMeteo, config.weather),
      new MetNorwayProvider(http, endpoints.metNorway, config.weather, config.sunny),
    ]);
    this.#finder = new SunFinder({
      router: this.#router,
      weather: this.#weather,
      geocoder: this.#geocoder,
      sampler: new CandidateSampler(config.search),
      config,
    });

    this.#form = new SearchForm(document.querySelector("#search"), config.form);
    this.#map = new MapView(document.querySelector("#map"), config.map, endpoints.tiles);
    this.#results = new ResultsView(document.querySelector("#results"));
    new ThemeBadge(document.querySelector("#theme-badge"));
  }

  start() {
    this.#form.onSubmit = (values) => this.#search(values);
    this.#form.onLocate = () => this.#useMyLocation();
    this.#results.onSelect = (spot) => this.#select(spot);
    this.#map.onSpotClick = (spot) => this.#select(spot);
  }

  async #search(values) {
    const problem = this.#validate(values);
    if (problem) return this.#form.setStatus(problem, { error: true });

    this.#map.clearResults();
    this.#results.clear();
    this.#form.setBusy(true);
    try {
      await this.#resolveOrigin(values.place);
      const trip = { ...values, origin: this.#origin };
      const result = await this.#finder.search(trip, (message) => this.#form.setStatus(message));

      this.#trip = trip;
      this.#map.showSpots(result.spots);
      this.#results.render(result, trip);
      this.#form.setStatus(`${result.spots.length} places checked · forecast by ${this.#weather.providerName}`);

      if (result.top.length) await this.#select(result.top[0]);
      else this.#map.fitSpots(result.spots);
    } catch (error) {
      console.error(error);
      this.#form.setStatus(error.message || "Something went wrong.", { error: true });
    } finally {
      this.#form.setBusy(false);
    }
  }

  #validate({ place, start }) {
    const now = Date.now();
    const horizonMs = this.#config.search.forecastHorizonDays * 86_400_000;
    if (!place && !this.#origin) return "Enter a starting place, or use your location.";
    if (Number.isNaN(start.getTime())) return "Pick a time to leave.";
    if (start.getTime() < now - 3_600_000) return "That start time is in the past.";
    if (start.getTime() > now + horizonMs) return `Forecasts only reach about ${this.#config.search.forecastHorizonDays} days ahead.`;
    return null;
  }

  /** Geocode the typed place unless it's the one we already resolved. */
  async #resolveOrigin(place) {
    if (!place || place === this.#resolvedPlace) return;
    this.#form.setStatus("Finding your starting point…");
    this.#setOrigin(await this.#geocoder.search(place), place);
  }

  #setOrigin(origin, resolvedFrom, { focus = false } = {}) {
    this.#origin = origin;
    this.#resolvedPlace = resolvedFrom;
    this.#form.setOriginLabel(origin.label);
    this.#map.showOrigin(origin, { focus });
  }

  #useMyLocation() {
    if (!navigator.geolocation) return this.#form.setStatus("This browser can't share a location.", { error: true });

    this.#form.setStatus("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const point = { lat: coords.latitude, lon: coords.longitude };
        const place = await this.#geocoder.reverse(point);
        const label = place ? [place.name, place.region].filter(Boolean).join(", ") : `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`;
        this.#form.setPlace(label);
        this.#setOrigin({ ...point, label }, label, { focus: true });
        this.#form.setStatus("");
      },
      (error) => this.#form.setStatus(`Couldn't get your location: ${error.message}`, { error: true }),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  /** Show one place: highlight its row and draw the route to it. */
  async #select(spot) {
    this.#results.highlight(spot);
    const origin = this.#trip.origin;
    const path = spot.isOrigin ? null : await this.#router.route(origin, spot).catch(() => null);
    this.#map.showRoute(origin, spot, path);
  }
}
