import { useEffect, useRef, useState } from "react";

// Calls fn now and then every `ms` milliseconds. Pauses while the app is in the background
// and refreshes immediately when the user comes back.
export function usePoll(fn, ms, deps = []) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    const run = () => {
      if (!document.hidden) saved.current();
    };
    run();
    const id = setInterval(run, ms);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("gatepass-push", run); // a push arrived while the app is open
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("gatepass-push", run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Re-renders every second (for countdowns).
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function buzz() {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
}
