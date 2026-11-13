const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const CLOUD = '<path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6 11.5 3.5 3.5 0 0 0 7 18z"/>';
const LOW_CLOUD = '<path d="M7 15h10a3.5 3.5 0 0 0 .5-6.96A5.5 5.5 0 0 0 6.2 9.4 3 3 0 0 0 7 15z"/>';

const ICONS = {
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>'),
  partly: svg(`<circle cx="8" cy="8" r="3"/><path d="M8 2v1.3M2 8h1.3M3.8 3.8l.9.9M12.2 3.8l-.9.9"/><path d="M9 19h8.5a3.5 3.5 0 0 0 .4-6.98A5 5 0 0 0 8.3 13.6 2.8 2.8 0 0 0 9 19z"/>`),
  cloud: svg(CLOUD),
  fog: svg('<path d="M4 9h16M4 13h16M6 17h12"/>'),
  rain: svg(`${LOW_CLOUD}<path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/>`),
  snow: svg(`${LOW_CLOUD}<path d="M8 19h.01M12 20.5h.01M16 19h.01"/>`),
  storm: svg(`${LOW_CLOUD}<path d="M12.5 16l-2 3h3l-2 3"/>`),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
};

/** An inline SVG for a WMO weather code. */
export function weatherIcon(code, isDay) {
  if (!isDay) return ICONS.moon;
  if (code === 0) return ICONS.sun;
  if (code <= 2) return ICONS.partly;
  if (code === 3) return ICONS.cloud;
  if (code <= 48) return ICONS.fog;
  if (code <= 67 || (code >= 80 && code <= 82)) return ICONS.rain;
  if (code <= 77 || code === 85 || code === 86) return ICONS.snow;
  return ICONS.storm;
}
