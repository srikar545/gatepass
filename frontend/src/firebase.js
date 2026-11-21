// Push notifications (Firebase Cloud Messaging).
// These config values are public by design (they ship in every web app). Not secrets.
// The only thing you add yourself is the web push key, in frontend/.env:
//     VITE_FIREBASE_VAPID_KEY=B....
import { initializeApp } from "firebase/app";
import { api } from "./api";

export const firebaseConfig = {
  apiKey: "AIzaSyBXwEIhkBKl0E-9TYyxk0A2ZlckKNlDV7k",
  authDomain: "gatepass-1cb4f.firebaseapp.com",
  projectId: "gatepass-1cb4f",
  storageBucket: "gatepass-1cb4f.firebasestorage.app",
  messagingSenderId: "711805390913",
  appId: "1:711805390913:web:92839e8e2332a8725a36c0",
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

let app = null;
let listening = false;

export function pushConfigured() {
  return Boolean(VAPID_KEY);
}

// False on browsers that cannot do web push (e.g. iPhone Safari before the app is added to the Home Screen).
export async function pushSupported() {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
    const { isSupported } = await import("firebase/messaging");
    return await isSupported();
  } catch {
    return false;
  }
}

// Gets this phone's push address from Firebase and gives it to our server.
export async function registerToken() {
  const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
  app = app || initializeApp(firebaseConfig);
  // If the service worker could not start (offline, blocked), "ready" never finishes. Give up after 10 s.
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("The background service did not start. Check the internet and reload.")), 10000)
    ),
  ]);
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Firebase did not give a push token.");
  await api("/me/fcm-token", { method: "POST", body: { token } });

  // App is open and in front: no notification is shown, so refresh the lists right now instead.
  if (!listening) {
    listening = true;
    onMessage(messaging, () => {
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {}
      window.dispatchEvent(new Event("gatepass-push"));
    });
  }
  return token;
}

// Asks the user for permission (must be called from a button tap), then registers.
export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission === "granted") await registerToken();
  return permission;
}

// On log out: stop alerts going to this phone.
export async function forgetToken() {
  try {
    await api("/me/fcm-token", { method: "DELETE" });
  } catch {}
}
