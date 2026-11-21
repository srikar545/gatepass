import { useEffect, useState } from "react";
import { enablePush, pushConfigured, pushSupported, registerToken } from "./firebase";

// Small banner on the watchman and resident screens.
// states: checking | ask | on | blocked | unsupported | off | error
export default function Notify() {
  const [state, setState] = useState("checking");
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    const set = (s) => live && setState(s);
    (async () => {
      if (!pushConfigured()) return set("off"); // push key not set up yet: stay quiet
      if (!(await pushSupported())) return set("unsupported");
      if (Notification.permission === "denied") return set("blocked");
      if (Notification.permission === "granted") {
        try {
          await registerToken(); // refresh the address on every login
          set("on");
        } catch (e) {
          if (live) setErr(e.message);
          set("error");
        }
        return;
      }
      set("ask");
    })();
    return () => {
      live = false;
    };
  }, []);

  async function turnOn() {
    setErr("");
    try {
      const result = await enablePush();
      setState(result === "granted" ? "on" : result === "denied" ? "blocked" : "ask");
    } catch (e) {
      setErr(e.message);
      setState("error");
    }
  }

  if (state === "ask") {
    return (
      <div className="notice">
        <div>Get an alert on this phone even when the app is closed.</div>
        <button className="btn primary" onClick={turnOn}>
          Turn on alerts
        </button>
      </div>
    );
  }
  if (state === "blocked") {
    return (
      <div className="notice muted small">
        Alerts are blocked for this app. Allow notifications for this site in the browser settings.
      </div>
    );
  }
  if (state === "unsupported") {
    return (
      <div className="notice muted small">
        This browser cannot show alerts. On iPhone, add the app to the Home Screen first and open it from there.
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="notice">
        <div className="small">Could not turn on alerts{err ? `: ${err}` : "."}</div>
        <button className="btn" onClick={turnOn}>
          Try again
        </button>
      </div>
    );
  }
  return null;
}
