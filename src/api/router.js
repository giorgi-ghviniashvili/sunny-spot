/** Driving times and routes from OSRM. */
export class Router {
  #http;
  #baseUrl;

  constructor(http, baseUrl) {
    this.#http = http;
    this.#baseUrl = baseUrl;
  }

  /**
   * Drive time from points[0] to every point, in one request.
   * Each result carries the point snapped onto the road network.
   */
  async driveTimes(points) {
    const coords = points.map(Router.#coord).join(";");
    const table = await this.#http.getJSON(
      `${this.#baseUrl}/table/v1/driving/${coords}?sources=0&annotations=duration,distance`,
    );
    if (table.code !== "Ok") throw new Error(`Routing failed: ${table.message || table.code}`);

    return points.map((_, i) => {
      const [lon, lat] = table.destinations[i].location;
      return {
        durationSec: table.durations[0][i], // null when unreachable
        distanceM: table.distances?.[0]?.[i] ?? null,
        snapped: { lat, lon },
        snapDistanceM: table.destinations[i].distance,
      };
    });
  }

  /** The driving route as [[lat, lon], …]. */
  async route(from, to) {
    const data = await this.#http.getJSON(
      `${this.#baseUrl}/route/v1/driving/${Router.#coord(from)};${Router.#coord(to)}?overview=full&geometries=geojson`,
    );
    return data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  }

  static #coord({ lat, lon }) {
    return `${lon.toFixed(5)},${lat.toFixed(5)}`;
  }
}
