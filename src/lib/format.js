const pad = (n) => String(n).padStart(2, "0");

/** 1620 → "27m", 7440 → "2h 04m" */
export function duration(seconds) {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h ? `${h}h ${pad(m)}m` : `${m}m`;
}

/** Local clock time; prefixed with the weekday when it isn't today. */
export function clock(date) {
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday ? time : `${date.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

/** Value for an <input type="datetime-local">. */
export function toDatetimeLocal(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function escapeHtml(text) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, (char) => entities[char]);
}
