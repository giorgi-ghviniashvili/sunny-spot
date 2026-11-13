import { clock, duration } from "../lib/format.js";

const STATUS_LABEL = { sunny: "Sunny on arrival", cloudy: "Cloudy on arrival", dark: "Dark on arrival" };

/**
 * The Leaflet map. All colours come from CSS (see styles.css), so markers and
 * the route follow the light/dark theme without any JavaScript.
 */
export class MapView {
  /** @type {(spot: object) => void} */ onSpotClick = () => {};

  #map;
  #layers;

  constructor(element, mapConfig, tilesUrl) {
    const L = window.L;
    this.#map = L.map(element, { zoomControl: false }).setView(mapConfig.center, mapConfig.zoom);
    L.control.zoom({ position: "topright" }).addTo(this.#map);
    L.tileLayer(tilesUrl, {
      maxZoom: mapConfig.maxZoom,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#layers = {
      spots: L.layerGroup().addTo(this.#map),
      route: L.layerGroup().addTo(this.#map),
      origin: L.layerGroup().addTo(this.#map),
    };
  }

  clearResults() {
    this.#layers.spots.clearLayers();
    this.#layers.route.clearLayers();
  }

  showOrigin(origin, { focus = false } = {}) {
    this.#layers.origin.clearLayers();
    MapView.#pin(origin, "pin-origin").addTo(this.#layers.origin);
    if (focus) this.#map.setView([origin.lat, origin.lon], 8);
  }

  /** A dot for every assessed place, coloured by its status. */
  showSpots(spots) {
    this.#layers.spots.clearLayers();
    for (const spot of spots) {
      window.L.circleMarker([spot.lat, spot.lon], {
        radius: spot.status === "sunny" ? 6.5 : 4.5,
        className: `spot-dot spot-dot--${spot.status}`,
      })
        .bindTooltip(MapView.#tooltip(spot), { direction: "top", offset: [0, -6] })
        .on("click", () => this.onSpotClick(spot))
        .addTo(this.#layers.spots);
    }
  }

  /** Highlight a destination and draw the route to it (`path` may be null if routing failed). */
  showRoute(origin, spot, path) {
    const L = window.L;
    this.#layers.route.clearLayers();

    if (path) {
      L.polyline(path, { className: "route-casing", interactive: false }).addTo(this.#layers.route);
      const line = L.polyline(path, { className: "route-line", interactive: false }).addTo(this.#layers.route);
      line.getElement()?.setAttribute("pathLength", "1"); // lets CSS animate the line being drawn
    }
    MapView.#pin(spot, `pin-dest pin-dest--${spot.status}`).addTo(this.#layers.route);

    if (spot.isOrigin) {
      this.#map.setView([spot.lat, spot.lon], 10);
    } else {
      const bounds = L.latLngBounds(path ?? [[origin.lat, origin.lon], [spot.lat, spot.lon]]);
      this.#map.fitBounds(bounds, { padding: [56, 56] });
    }
  }

  fitSpots(spots) {
    if (spots.length) this.#map.fitBounds(spots.map((spot) => [spot.lat, spot.lon]), { padding: [40, 40] });
  }

  static #pin({ lat, lon }, className) {
    const icon = window.L.divIcon({ className: "", html: `<span class="pin ${className}"></span>`, iconSize: [0, 0] });
    return window.L.marker([lat, lon], { icon, interactive: false, keyboard: false });
  }

  static #tooltip(spot) {
    const arrival = clock(new Date(spot.arrivalSec * 1000));
    return `<b>${STATUS_LABEL[spot.status]}</b><br>${duration(spot.durationSec)} drive · arrive ${arrival}<br>${spot.avgCloud}% cloud · ${Math.round(spot.hours[0].temp)}°`;
  }
}
