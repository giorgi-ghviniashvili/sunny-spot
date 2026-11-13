# ☀️ Sunny Spot

Find the closest place that will be **sunny when you arrive** — not when you leave.

Enter where you're starting from and when you're leaving. Sunny Spot samples ~100 points around you,
gets real drive times to each, adds that to your departure time, and checks the hourly forecast at the
**arrival hour** (plus how long you want it to stay sunny). The closest match wins, with the route on the map.

**Live:** https://giorgi-ghviniashvili.github.io/sunny-spot/

## How it works

1. Geocode the start (Nominatim) or use browser geolocation.
2. Sample candidate points in rings out to your max drive time.
3. Drive times from the origin to every candidate in one call (OSRM table API), snapped to roads.
4. Hourly forecast for every reachable candidate (Open-Meteo, batched).
5. `arrival = start + driveTime`; a spot is sunny if, for every hour in `[arrival, arrival + stay)`,
   it's daytime, cloud cover ≤ threshold, and no precipitation.
6. Sort sunny spots by drive time; draw the route (OSRM) and link to Google Maps directions.

## Stack

Plain static HTML + JS, Tailwind CSS (browser build), Leaflet. No build step, no API keys.

APIs: [Open-Meteo](https://open-meteo.com), [OSRM demo server](https://project-osrm.org),
[Nominatim](https://nominatim.org), [BigDataCloud](https://www.bigdatacloud.com) reverse geocoding,
OpenStreetMap tiles.

## Run locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.
