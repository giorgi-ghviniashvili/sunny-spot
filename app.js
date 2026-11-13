// Sunny Spot — find the closest place that will be sunny when you ARRIVE.
// APIs (all free, no key): Open-Meteo (weather), OSRM demo server (routing),
// Nominatim (geocoding), BigDataCloud (reverse geocoding for place names).

const OSRM = "https://router.project-osrm.org";
const KM_PER_DRIVE_HOUR = 70; // straight-line km covered per hour of driving (rough)

const $ = (id) => document.getElementById(id);
const els = {
  form: $("form"), place: $("place"), locate: $("locate"), originLabel: $("originLabel"),
  start: $("start"), maxDrive: $("maxDrive"), stay: $("stay"), clouds: $("clouds"),
  cloudsVal: $("cloudsVal"), go: $("go"), goIcon: $("goIcon"), goText: $("goText"),
  status: $("status"), results: $("results"), list: $("list"),
};

let origin = null; // { lat, lon, label }
let lastPlaceQuery = "";

// ---------- Map ----------
const map = L.map("map", { zoomControl: true }).setView([46.8, 8.2], 6);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);
const layers = { candidates: L.layerGroup().addTo(map), route: L.layerGroup().addTo(map), origin: L.layerGroup().addTo(map) };

// ---------- Helpers ----------
const pad = (n) => String(n).padStart(2, "0");
function toLocalInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDuration(sec) {
  if (sec < 60) return "0 min";
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h} h ${pad(m)} min` : `${m} min`;
}
function fmtTime(date) {
  const sameDay = date.toDateString() === new Date().toDateString();
  const t = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? t : `${date.toLocaleDateString([], { weekday: "short" })} ${t}`;
}
function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.className = `min-h-4 text-center text-xs ${isError ? "text-rose-600 font-medium" : "text-slate-500"}`;
}
function setBusy(busy) {
  els.go.disabled = busy;
  els.goIcon.innerHTML = busy
    ? '<svg class="spin size-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity=".3"/><path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3"/></svg>'
    : "☀️";
  els.goText.textContent = busy ? "Searching…" : "Find the sun";
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.json();
}
function weatherEmoji(code, isDay) {
  if (!isDay) return "🌙";
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67 || (code >= 80 && code <= 82)) return "🌧️";
  if (code <= 77 || code === 85 || code === 86) return "🌨️";
  return "⛈️";
}

// Destination point from (lat, lon), bearing (deg) and distance (km).
function destination(lat, lon, bearingDeg, km) {
  const R = 6371, d = km / R, b = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180, λ1 = (lon * Math.PI) / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(b));
  const λ2 = λ1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: (φ2 * 180) / Math.PI, lon: ((((λ2 * 180) / Math.PI) + 540) % 360) - 180 };
}

// Rings of candidate points around the origin (origin itself included first).
function buildCandidates(o, maxHours) {
  const R = maxHours * KM_PER_DRIVE_HOUR;
  const rings = [[0.12, 8], [0.25, 10], [0.4, 12], [0.55, 14], [0.72, 16], [0.9, 18], [1.05, 20]];
  const pts = [{ lat: o.lat, lon: o.lon }];
  rings.forEach(([f, n], ri) => {
    const offset = ri % 2 ? 180 / n : 0; // stagger rings
    for (let i = 0; i < n; i++) pts.push(destination(o.lat, o.lon, offset + (360 / n) * i, R * f));
  });
  return pts; // <= 99 points (OSRM demo table limit is 100)
}

// ---------- Geocoding ----------
async function geocode(q) {
  const data = await getJSON(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
  if (!data.length) throw new Error(`Couldn't find "${q}".`);
  return { lat: +data[0].lat, lon: +data[0].lon, label: data[0].display_name };
}
async function placeName(lat, lon) {
  try {
    const d = await getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    const name = d.locality || d.city || d.principalSubdivision;
    const region = [d.principalSubdivision, d.countryCode].filter((x) => x && x !== name).join(", ");
    return name ? { name, region } : null;
  } catch { return null; }
}
function setOrigin(o) {
  origin = o;
  els.originLabel.textContent = `📌 ${o.label}`;
  layers.origin.clearLayers();
  L.marker([o.lat, o.lon], { title: "Start" }).addTo(layers.origin).bindPopup("<b>Start</b>");
}

els.locate.addEventListener("click", () => {
  if (!navigator.geolocation) return setStatus("Geolocation isn't available in this browser.", true);
  setStatus("Getting your location…");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const p = await placeName(lat, lon);
      const label = p ? [p.name, p.region].filter(Boolean).join(", ") : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      els.place.value = label;
      lastPlaceQuery = label;
      setOrigin({ lat, lon, label });
      map.setView([lat, lon], 8);
      setStatus("");
    },
    (err) => setStatus(`Couldn't get location: ${err.message}`, true),
    { enableHighAccuracy: false, timeout: 10000 }
  );
});

els.clouds.addEventListener("input", () => (els.cloudsVal.textContent = `${els.clouds.value}%`));

// ---------- Core search ----------
async function driveTimes(points) {
  const coords = points.map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
  const d = await getJSON(`${OSRM}/table/v1/driving/${coords}?sources=0&annotations=duration,distance`);
  if (d.code !== "Ok") throw new Error(`Routing failed: ${d.message || d.code}`);
  return points.map((_, i) => ({
    duration: d.durations[0][i],
    distance: d.distances?.[0]?.[i] ?? null,
    snapped: { lon: d.destinations[i].location[0], lat: d.destinations[i].location[1] },
    snapDist: d.destinations[i].distance, // metres from sampled point to nearest road
  }));
}

async function forecasts(points) {
  const out = [];
  for (let i = 0; i < points.length; i += 50) {
    const chunk = points.slice(i, i + 50);
    const lat = chunk.map((p) => p.lat.toFixed(4)).join(",");
    const lon = chunk.map((p) => p.lon.toFixed(4)).join(",");
    const d = await getJSON(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=cloud_cover,precipitation,is_day,weather_code,temperature_2m&timeformat=unixtime&timezone=GMT&forecast_days=8`
    );
    out.push(...(Array.isArray(d) ? d : [d]));
  }
  return out;
}

// Evaluate the hours [arrival, arrival + stay) for one location.
function evaluate(fc, arrivalSec, stayHours, maxCloud) {
  const t = fc.hourly.time;
  const idx = Math.round((arrivalSec - t[0]) / 3600);
  if (idx < 0 || idx + stayHours > t.length) return null;
  const hours = [];
  for (let k = idx; k < idx + stayHours; k++) {
    hours.push({
      time: t[k], cloud: fc.hourly.cloud_cover[k], precip: fc.hourly.precipitation[k],
      isDay: fc.hourly.is_day[k] === 1, code: fc.hourly.weather_code[k], temp: fc.hourly.temperature_2m[k],
    });
  }
  const dark = hours.some((h) => !h.isDay);
  const sunny = !dark && hours.every((h) => h.cloud <= maxCloud && h.precip < 0.1);
  const avgCloud = Math.round(hours.reduce((s, h) => s + h.cloud, 0) / hours.length);
  return { hours, dark, sunny, avgCloud, status: sunny ? "sunny" : dark ? "dark" : "cloudy" };
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  layers.route.clearLayers();
  layers.candidates.clearLayers();
  els.results.classList.add("hidden");

  const startDate = new Date(els.start.value);
  const now = Date.now();
  if (isNaN(startDate)) return setStatus("Pick a start time.", true);
  if (startDate.getTime() < now - 3600e3) return setStatus("Start time is in the past.", true);
  if (startDate.getTime() > now + 6 * 86400e3) return setStatus("Forecasts only go ~6 days ahead.", true);

  const maxHours = +els.maxDrive.value, stay = +els.stay.value, maxCloud = +els.clouds.value;
  setBusy(true);
  try {
    const q = els.place.value.trim();
    if (!q && !origin) throw new Error("Enter a starting place or use 📍.");
    if (q && q !== lastPlaceQuery) {
      setStatus("Finding your starting point…");
      setOrigin(await geocode(q));
      lastPlaceQuery = q;
    }

    setStatus("Calculating drive times…");
    const sampled = buildCandidates(origin, maxHours);
    const drives = await driveTimes(sampled);

    // Keep reachable points within the time limit, snapped to the road network.
    const seen = new Set();
    const reachable = [];
    drives.forEach((d, i) => {
      if (d.duration == null || d.duration > maxHours * 3600) return;
      if (i > 0 && d.snapDist > 15000) return; // sampled point far from any road (sea, lake…)
      const key = `${d.snapped.lat.toFixed(2)},${d.snapped.lon.toFixed(2)}`;
      if (seen.has(key)) return;
      seen.add(key);
      reachable.push({ ...d, isOrigin: i === 0, lat: i === 0 ? origin.lat : d.snapped.lat, lon: i === 0 ? origin.lon : d.snapped.lon });
    });
    if (!reachable.length) throw new Error("No reachable places found — try a longer max drive.");

    setStatus(`Checking the forecast at ${reachable.length} places…`);
    const fcs = await forecasts(reachable);
    const startSec = Math.floor(startDate.getTime() / 1000);

    const evaluated = reachable
      .map((c, i) => {
        const arrival = startSec + c.duration;
        const ev = evaluate(fcs[i], arrival, stay, maxCloud);
        return ev && { ...c, arrival, ...ev };
      })
      .filter(Boolean);

    drawCandidates(evaluated);

    const sunny = evaluated.filter((c) => c.sunny).sort((a, b) => a.duration - b.duration);
    let top, headline;
    if (sunny.length) {
      top = sunny.slice(0, 5);
      headline = `Found ${sunny.length} sunny spot${sunny.length > 1 ? "s" : ""}.`;
    } else {
      top = evaluated.filter((c) => !c.dark).sort((a, b) => a.avgCloud - b.avgCloud || a.duration - b.duration).slice(0, 5);
      headline = top.length
        ? "No fully sunny spot in range — here are the least cloudy."
        : "It'll be dark on arrival everywhere in range. Try an earlier start.";
    }

    setStatus("Looking up place names…");
    await Promise.all(top.map(async (c) => {
      c.place = c.isOrigin ? { name: "Right where you are", region: "No driving needed" } : await placeName(c.lat, c.lon);
    }));

    renderResults(top, !!sunny.length);
    setStatus(headline);
    if (top.length) await showRoute(top[0]);
    else map.fitBounds(layers.candidates.getLayers().map((l) => l.getLatLng()), { padding: [30, 30] });
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Something went wrong.", true);
  } finally {
    setBusy(false);
  }
});

// ---------- Rendering ----------
const COLORS = { sunny: "#f59e0b", cloudy: "#94a3b8", dark: "#6366f1" };

function drawCandidates(items) {
  items.forEach((c) => {
    const h = c.hours[0];
    L.circleMarker([c.lat, c.lon], {
      radius: c.sunny ? 7 : 5, color: "#fff", weight: 1.5, fillColor: COLORS[c.status], fillOpacity: 0.9,
    })
      .addTo(layers.candidates)
      .bindPopup(
        `<div class="text-sm"><div class="font-semibold">${weatherEmoji(h.code, h.isDay)} ${c.status === "sunny" ? "Sunny" : c.status === "dark" ? "Dark" : "Cloudy"} on arrival</div>` +
        `<div>Drive: ${fmtDuration(c.duration)}</div><div>Arrive: ${fmtTime(new Date(c.arrival * 1000))}</div>` +
        `<div>Clouds: ${c.avgCloud}% · ${Math.round(h.temp)}°C</div></div>`
      )
      .on("click", () => showRoute(c));
  });
}

function renderResults(items, anySunny) {
  els.list.innerHTML = "";
  els.results.classList.toggle("hidden", !items.length);
  items.forEach((c, i) => {
    const h = c.hours[0];
    const name = c.place?.name || `${c.lat.toFixed(3)}, ${c.lon.toFixed(3)}`;
    const region = c.place?.region || "";
    const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${c.lat},${c.lon}&travelmode=driving`;
    const li = document.createElement("li");
    li.innerHTML = `
      <button type="button" data-i="${i}" class="card group w-full rounded-2xl border border-white/60 bg-white/80 p-4 text-left shadow-md shadow-orange-900/5 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg">
        <div class="flex items-start gap-3">
          <div class="grid size-12 shrink-0 place-items-center rounded-xl ${c.sunny ? "bg-gradient-to-br from-amber-300 to-orange-400" : "bg-slate-200"} text-2xl">${weatherEmoji(h.code, h.isDay)}</div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="truncate font-bold">${escapeHtml(name)}</h3>
              ${i === 0 && anySunny ? '<span class="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-700">Closest</span>' : ""}
            </div>
            <p class="truncate text-xs text-slate-500">${escapeHtml(region)}</p>
            <div class="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div><div class="text-slate-400">Drive</div><div class="font-semibold">${fmtDuration(c.duration)}</div></div>
              <div><div class="text-slate-400">Arrive</div><div class="font-semibold">${fmtTime(new Date(c.arrival * 1000))}</div></div>
              <div><div class="text-slate-400">Clouds</div><div class="font-semibold">${c.avgCloud}% · ${Math.round(h.temp)}°</div></div>
            </div>
          </div>
        </div>
        <div class="mt-3 flex gap-1">
          ${c.hours.map((x) => `<div title="${fmtTime(new Date(x.time * 1000))}: ${x.cloud}% clouds" class="h-1.5 flex-1 rounded-full" style="background:${x.isDay ? `color-mix(in oklab, #f59e0b ${100 - x.cloud}%, #94a3b8)` : "#6366f1"}"></div>`).join("")}
        </div>
      </button>
      ${c.isOrigin ? "" : `<a href="${gmaps}" target="_blank" rel="noopener" class="mt-1 inline-block px-2 text-xs font-semibold text-orange-600 hover:underline">Open directions in Google Maps →</a>`}`;
    li.querySelector("button").addEventListener("click", () => {
      els.list.querySelectorAll(".card").forEach((b) => b.classList.remove("ring-2", "ring-orange-400"));
      li.querySelector("button").classList.add("ring-2", "ring-orange-400");
      showRoute(c);
    });
    els.list.appendChild(li);
  });
  els.list.querySelector(".card")?.classList.add("ring-2", "ring-orange-400");
}

async function showRoute(c) {
  layers.route.clearLayers();
  const dest = L.circleMarker([c.lat, c.lon], { radius: 11, color: "#fff", weight: 3, fillColor: COLORS[c.status], fillOpacity: 1 }).addTo(layers.route);
  if (c.isOrigin) {
    map.setView([c.lat, c.lon], 10);
    return;
  }
  try {
    const d = await getJSON(`${OSRM}/route/v1/driving/${origin.lon},${origin.lat};${c.lon},${c.lat}?overview=full&geometries=geojson`);
    const coords = d.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    L.polyline(coords, { color: "#fff", weight: 9, opacity: 0.9 }).addTo(layers.route);
    const line = L.polyline(coords, { color: "#f97316", weight: 5 }).addTo(layers.route);
    dest.bringToFront();
    map.fitBounds(line.getBounds(), { padding: [40, 40] });
  } catch (err) {
    console.error(err);
    map.fitBounds(L.latLngBounds([[origin.lat, origin.lon], [c.lat, c.lon]]), { padding: [40, 40] });
  }
}

// ---------- Init ----------
const next = new Date();
next.setMinutes(0, 0, 0);
next.setHours(next.getHours() + 1);
els.start.value = toLocalInput(next);
