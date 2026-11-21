import { useEffect, useState } from "react";
import { loadSession, saveSession, clearSession } from "./api";
import Login from "./pages/Login.jsx";
import Watchman from "./pages/watchman/Watchman.jsx";
import Resident from "./pages/resident/Resident.jsx";
import Admin from "./pages/admin/Admin.jsx";
import Notify from "./Notify.jsx";
import { forgetToken } from "./firebase";

const SCREENS = { WATCHMAN: Watchman, RESIDENT: Resident, ADMIN: Admin };

export default function App() {
  const [session, setSession] = useState(loadSession());

  // api.js fires this when the server says the login is no longer valid.
  useEffect(() => {
    const out = () => setSession(null);
    window.addEventListener("gatepass-logout", out);
    return () => window.removeEventListener("gatepass-logout", out);
  }, []);

  if (!session) {
    return (
      <Login
        onLogin={(s) => {
          saveSession(s);
          setSession(s);
        }}
      />
    );
  }

  const Screen = SCREENS[session.role];
  return (
    <div className="app">
      <header className="top">
        <div>
          <strong>{session.name}</strong>
          <span className="role">{session.role.toLowerCase()}</span>
        </div>
        <button
          className="link"
          onClick={async () => {
            await forgetToken(); // stop alerts to this phone while we still have the login
            clearSession();
            setSession(null);
          }}
        >
          Log out
        </button>
      </header>
      <main>
        {(session.role === "WATCHMAN" || session.role === "RESIDENT") && <Notify />}
        {Screen ? <Screen /> : <p>Unknown role.</p>}
      </main>
    </div>
  );
}
