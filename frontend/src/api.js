// All talking to the backend goes through api().
// Set VITE_API_URL in frontend/.env to point at your server, e.g. https://gate.example.com
// Default: same host as the page, port 8000 (works on your laptop and on a phone on the same Wi-Fi).
const API_BASE =
  import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;

const KEY = "gatepass_session";

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}
export function saveSession(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}
export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function errorText(d) {
  if (!d) return "";
  if (typeof d.detail === "string") return d.detail;
  if (Array.isArray(d.detail)) {
    return d.detail.map((e) => `${e.loc?.slice(-1)[0] || "field"}: ${e.msg}`).join(", ");
  }
  return "";
}

export async function api(path, { method = "GET", body } = {}) {
  const session = loadSession();
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check the internet connection.");
  }

  // Token expired or account disabled: send the user back to the login screen.
  if (res.status === 401 && path !== "/auth/login") {
    clearSession();
    window.dispatchEvent(new Event("gatepass-logout"));
  }

  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) throw new ApiError(res.status, errorText(data) || `Error ${res.status}`);
  return data;
}
