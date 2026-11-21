import { useEffect, useState } from "react";
import { api } from "../../api";
import { ErrorBox } from "../../ui.jsx";

const PURPOSES = ["Guest", "Delivery", "Cab", "Service", "Other"];

export default function NewVisit({ onBack, onCreated }) {
  const [flats, setFlats] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [flat, setFlat] = useState("");
  const [purpose, setPurpose] = useState("Guest");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/flats")
      .then(setFlats)
      .catch((e) => setErr(e.message));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Enter the guest's name.");
    if (!/^\d{10,15}$/.test(phone.trim())) return setErr("Enter the guest's phone number (digits only).");
    if (!flat) return setErr("Choose a flat.");
    setBusy(true);
    try {
      const v = await api("/visits", {
        method: "POST",
        body: { guest_name: name.trim(), guest_phone: phone.trim(), flat_no: flat, purpose },
      });
      onCreated(v);
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="link back" onClick={onBack}>
        ← Back
      </button>
      <h2>New visitor</h2>
      <form onSubmit={submit}>
        <label>
          Guest name
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label>
          Guest phone
          <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          Visiting flat
          <select value={flat} onChange={(e) => setFlat(e.target.value)}>
            <option value="">Choose...</option>
            {flats.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <div className="label">Purpose</div>
        <div className="chips">
          {PURPOSES.map((p) => (
            <button
              type="button"
              key={p}
              className={p === purpose ? "pill on" : "pill"}
              onClick={() => setPurpose(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <ErrorBox text={err} />
        <button className="btn primary big" disabled={busy}>
          {busy ? "Sending..." : "Ask the resident"}
        </button>
      </form>
    </div>
  );
}
