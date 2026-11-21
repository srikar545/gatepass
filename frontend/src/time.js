export const EXPIRY_SECONDS = 120; // keep in sync with EXPIRY_MINUTES in backend/main.py

// The server sends UTC times without a "Z" at the end. Add it, or the browser reads them as local time.
export function parseUtc(s) {
  if (!s) return null;
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z");
}

export function fmtTime(s) {
  const d = parseUtc(s);
  if (!d) return "";
  return d.toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function secondsLeft(createdAt, now = Date.now()) {
  const d = parseUtc(createdAt);
  if (!d) return 0;
  return Math.max(0, EXPIRY_SECONDS - Math.floor((now - d.getTime()) / 1000));
}

export function mmss(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
