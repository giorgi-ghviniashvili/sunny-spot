# Sunny Spot

Find the closest place that will be **sunny when you arrive** — not when you leave.

**Live:** https://giorgi-ghviniashvili.github.io/sunny-spot/

Enter where you start and when you leave. Sunny Spot samples ~100 points around you, gets real
drive times to each, and checks the hourly forecast at each place's **arrival time**
(`departure + drive time`) for as long as you want the sun to last. The closest match wins.

## Stack

Static HTML, ES modules, Tailwind CSS (browser build) plus one hand-written stylesheet, Leaflet.
No build step and no API keys. The theme follows the system (`color-scheme` + `light-dark()`).

## Code layout

```
index.html            markup; layout with Tailwind utilities
styles.css            theme tokens (light/dark) and custom components
src/
  main.js             entry point: new App(Config.fromEnvironment()).start()
  app.js              App — wires form, search and views
  config.js           Config — every tunable value
  core/
    sun-finder.js       SunFinder — arrival = departure + drive; rank sunny places
    sunny-rule.js       SunnyRule — is this run of hours sunny?
    candidate-sampler.js CandidateSampler — rings of points around the origin
  api/
    geocoder.js         Geocoder — Nominatim search, BigDataCloud reverse
    router.js           Router — OSRM drive-time table and routes
    weather/            WeatherService with OpenMeteoProvider → MetNorwayProvider fallback,
                        both normalised to Forecast
  ui/
    search-form.js      SearchForm
    results-view.js     ResultsView (list + "trip strip")
    map-view.js         MapView (Leaflet)
    theme-badge.js      ThemeBadge
    icons.js            weather icons (inline SVG)
  lib/                  HttpClient, Geo, format helpers
```

## Configuration

All settings live in [`src/config.js`](src/config.js): API endpoints, sampling rings, what counts
as sunny, timeouts, form options and defaults, map start view. Override them in any of three ways:

```html
<!-- 1. before the app loads -->
<script>window.SUNNY_SPOT_CONFIG = { search: { topResults: 8 }, form: { maxDriveHours: 2 } };</script>
```

```js
// 2. in code
new App(new Config({ sunny: { maxPrecipMm: 0.3 } })).start();
```

```
3. form defaults from the URL
?from=Seattle&drive=2&stay=3&clouds=40
```

## Run locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Data

[Open-Meteo](https://open-meteo.com) (falls back to [MET Norway](https://api.met.no)),
[OSRM demo server](https://project-osrm.org), [Nominatim](https://nominatim.org),
[BigDataCloud](https://www.bigdatacloud.com), OpenStreetMap tiles.
