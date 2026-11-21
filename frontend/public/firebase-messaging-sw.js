// The app's one service worker. It does two jobs:
//   1. Shows a notification when a push arrives and the app is closed or in the background.
//   2. Keeps the app shell cached so the app opens even with a bad connection.
// Config values below are public (same as in src/firebase.js).
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBXwEIhkBKl0E-9TYyxk0A2ZlckKNlDV7k",
  authDomain: "gatepass-1cb4f.firebaseapp.com",
  projectId: "gatepass-1cb4f",
  storageBucket: "gatepass-1cb4f.firebasestorage.app",
  messagingSenderId: "711805390913",
  appId: "1:711805390913:web:92839e8e2332a8725a36c0",
});

const messaging = firebase.messaging();

// The server sends data-only messages, so we build the notification ourselves.
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  return self.registration.showNotification(d.title || "Gate Pass", {
    body: d.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.visit_id ? `visit-${d.visit_id}` : "gatepass",
    vibrate: [200, 100, 200],
    requireInteraction: d.type === "visit_request", // keep a visitor request on screen until handled
    data: d,
  });
});

// Tap on the notification: bring the app to the front (or open it).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow("/");
    })
  );
});

// ---- offline shell cache (same behaviour as before) ----
const CACHE = "gatepass-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only our own files. API calls (another origin) and everything else are left alone.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/index.html")))
  );
});
