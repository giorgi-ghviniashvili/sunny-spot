import { clock, duration, escapeHtml } from "../lib/format.js";
import { weatherIcon } from "./icons.js";

/** The ranked list of places, each with a "trip strip": the drive, then the sky hour by hour. */
export class ResultsView {
  /** @type {(spot: object) => void} */ onSelect = () => {};

  #section;
  #title;
  #list;
  #rows = new Map(); // spot → <li>

  constructor(section) {
    this.#section = section;
    this.#title = section.querySelector('[data-el="results-title"]');
    this.#list = section.querySelector('[data-el="results-list"]');
  }

  clear() {
    this.#section.hidden = true;
    this.#list.innerHTML = "";
    this.#rows.clear();
  }

  /**
   * @param {{ top, sunnyCount }} result
   * @param {{ origin, start: Date, maxDriveHours, stayHours }} trip
   */
  render({ top, sunnyCount }, trip) {
    this.clear();
    this.#section.hidden = false;
    this.#title.textContent = ResultsView.#headline(top.length, sunnyCount);

    top.forEach((spot, index) => {
      const row = document.createElement("li");
      row.style.setProperty("--i", index);
      row.innerHTML = this.#rowHtml(spot, index, trip);
      row.querySelector("button").addEventListener("click", () => this.onSelect(spot));
      this.#list.append(row);
      this.#rows.set(spot, row);
    });
  }

  /** Mark one row as the selected one (or none, for a spot that isn't listed). */
  highlight(spot) {
    for (const [candidate, row] of this.#rows) {
      row.querySelector("button").setAttribute("aria-pressed", String(candidate === spot));
    }
  }

  static #headline(shown, sunnyCount) {
    if (sunnyCount) return `Closest sun — ${sunnyCount} sunny ${sunnyCount === 1 ? "place" : "places"} in range`;
    if (shown) return "No clear sky in range — least cloudy instead";
    return "Dark on arrival everywhere — try leaving earlier";
  }

  #rowHtml(spot, index, trip) {
    const first = spot.hours[0];
    const name = spot.place?.name ?? `${spot.lat.toFixed(3)}, ${spot.lon.toFixed(3)}`;
    const region = spot.place?.region ?? "";
    const arrival = clock(new Date(spot.arrivalSec * 1000));

    return `
      <button type="button" class="spot spot--${spot.status}" aria-pressed="false">
        <span class="spot-rank">${String(index + 1).padStart(2, "0")}</span>
        <span class="spot-body">
          <span class="spot-head">
            <span class="spot-name">${escapeHtml(name)}</span>
            <span class="spot-drive">${spot.isOrigin ? "0m" : duration(spot.durationSec)}</span>
          </span>
          <span class="spot-region">${escapeHtml(region)}</span>
          ${ResultsView.#tripStrip(spot, trip)}
          <span class="spot-meta">
            <span class="spot-icon">${weatherIcon(first.code, first.isDay)}</span>
            <span>arrive <b>${arrival}</b></span>
            <span><b>${spot.avgCloud}%</b> cloud</span>
            <span><b>${Math.round(first.temp)}°</b></span>
          </span>
        </span>
      </button>
      ${spot.isOrigin ? "" : `<a class="spot-link" href="${ResultsView.#directionsUrl(trip.origin, spot)}" target="_blank" rel="noopener">Directions ↗</a>`}`;
  }

  /**
   * One bar on a shared time scale (max drive + stay):
   * a dashed stretch for the drive, then one cell per hour of the stay, tinted by cloud cover.
   */
  static #tripStrip(spot, { maxDriveHours, stayHours }) {
    const spanSec = (maxDriveHours + stayHours) * 3600;
    const idleSec = spanSec - spot.durationSec - stayHours * 3600;

    const cells = spot.hours.map((hour) => {
      const tint = hour.isDay ? `color-mix(in oklab, var(--sun) ${100 - hour.cloud}%, var(--cloud))` : "var(--night)";
      const label = `${clock(new Date(hour.time * 1000))} · ${hour.cloud}% cloud`;
      return `<span class="strip-hour" style="flex:3600;background:${tint}" title="${label}"></span>`;
    }).join("");

    return `
      <span class="strip" aria-hidden="true">
        <span class="strip-drive" style="flex:${Math.max(spot.durationSec, 1)}"></span>
        ${cells}
        <span style="flex:${Math.max(idleSec, 0)}"></span>
      </span>`;
  }

  static #directionsUrl(origin, spot) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${spot.lat},${spot.lon}&travelmode=driving`;
  }
}
