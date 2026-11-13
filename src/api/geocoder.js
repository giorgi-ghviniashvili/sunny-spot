/** Place name ⇄ coordinates. */
export class Geocoder {
  #http;
  #endpoints;

  constructor(http, endpoints) {
    this.#http = http;
    this.#endpoints = endpoints;
  }

  /** "Seattle" → { lat, lon, label }. Throws if nothing matches. */
  async search(query) {
    const url = `${this.#endpoints.nominatim}?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const [hit] = await this.#http.getJSON(url);
    if (!hit) throw new Error(`Couldn't find "${query}".`);
    return { lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name };
  }

  /** Coordinates → { name, region }, or null when unknown. Never throws. */
  async reverse({ lat, lon }) {
    try {
      const url = `${this.#endpoints.reverseGeocode}?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
      const place = await this.#http.getJSON(url);
      const name = place.locality || place.city || place.principalSubdivision;
      if (!name) return null;
      const region = [place.principalSubdivision, place.countryCode].filter((part) => part && part !== name).join(", ");
      return { name, region };
    } catch {
      return null;
    }
  }
}
