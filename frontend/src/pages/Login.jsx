import { useState } from "react";
import { api } from "../api";
import { ErrorBox } from "../ui.jsx";

export default function Login({ onLogin }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!/^\d{10,15}$/.test(phone.trim())) return setErr("Enter your phone number (digits only).");
    if (pin.length < 4) return setErr("PIN must be at least 4 digits.");
    setBusy(true);
    try {
      const r = await api("/auth/login", { method: "POST", body: { phone: phone.trim(), pin } });
      onLogin({ token: r.access_token, role: r.role, name: r.name });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <h1>Gate Pass</h1>
      <p className="muted">Sign in with the phone number and PIN given by the admin.</p>
      <form onSubmit={submit}>
        <label>
          Phone number
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="username"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label>
          PIN
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </label>
        <ErrorBox text={err} />
        <button className="btn primary" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
