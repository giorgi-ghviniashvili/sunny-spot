const RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

/** Spherical-earth and solar geometry helpers. */
export class Geo {
  /** The point `km` away from (lat, lon) along `bearingDeg`. */
  static destination({ lat, lon }, bearingDeg, km) {
    const d = km / EARTH_RADIUS_KM;
    const bearing = bearingDeg * RAD;
    const lat1 = lat * RAD;
    const lon1 = lon * RAD;

    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing));
    const lon2 = lon1 + Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
    return { lat: lat2 / RAD, lon: ((lon2 / RAD + 540) % 360) - 180 };
  }

  /** Solar elevation in degrees at a unix time (accurate to ~0.5°). */
  static sunElevation({ lat, lon }, unixSec) {
    const days = unixSec / 86400 + 2440587.5 - 2451545.0; // days since J2000
    const meanLongitude = (280.46 + 0.9856474 * days) % 360;
    const meanAnomaly = ((357.528 + 0.9856003 * days) % 360) * RAD;
    const eclipticLongitude = (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD;
    const obliquity = (23.439 - 0.0000004 * days) * RAD;

    const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
    const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude)) / RAD;
    const siderealHours = (18.697374558 + 24.06570982441908 * days) % 24;
    const hourAngle = (siderealHours * 15 + lon - rightAscension) * RAD;

    return Math.asin(
      Math.sin(lat * RAD) * Math.sin(declination) + Math.cos(lat * RAD) * Math.cos(declination) * Math.cos(hourAngle),
    ) / RAD;
  }
}
