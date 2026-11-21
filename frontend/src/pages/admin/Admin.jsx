import { useEffect, useState } from "react";
import { api } from "../../api";
import { usePoll } from "../../hooks";
import { ErrorBox, Tabs } from "../../ui.jsx";
import { History } from "../resident/Resident.jsx";

export default function Admin() {
  const [tab, setTab] = useState("users");
  return (
    <div>
      <Tabs
        tabs={[
          ["users", "People"],
          ["add", "Add person"],
          ["flats", "Flats"],
          ["log", "Visit log"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "users" && <Users />}
      {tab === "add" && <AddUser />}
      {tab === "flats" && <Flats />}
      {tab === "log" && <History />}
    </div>
  );
}

function Users() {
  const [list, setList] = useState([]);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setList(await api("/admin/users"));
      setErr("");
    } catch (e) {
      setErr(e.message);
    }
  }
  usePoll(load, 20000, []);

  async function disable(u) {
    if (!window.confirm(`Disable ${u.name}? They will be logged out immediately.`)) return;
    try {
      await api(`/admin/users/${u.id}/disable`, { method: "PATCH" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <ErrorBox text={err} />
      {list.map((u) => (
        <div className="card" key={u.id}>
          <div className="row">
            <div>
              <strong>{u.name}</strong>
              <div className="muted">
                {u.role.toLowerCase()}
                {u.flat_no ? ` · Flat ${u.flat_no}` : ""} · {u.phone}
              </div>
            </div>
            {u.is_active ? (
              u.role !== "ADMIN" && (
                <button className="btn small stop" onClick={() => disable(u)}>
                  Disable
                </button>
              )
            ) : (
              <span className="chip chip-REJECTED">Disabled</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AddUser() {
  const [flats, setFlats] = useState([]);
  const [form, setForm] = useState({ name: "", phone: "", pin: "", role: "RESIDENT", flat_no: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    api("/flats").then(setFlats).catch((e) => setErr(e.message));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!form.name.trim()) return setErr("Enter a name.");
    if (!/^\d{10,15}$/.test(form.phone.trim())) return setErr("Phone must be 10-15 digits.");
    if (form.pin.length < 4) return setErr("PIN must be at least 4 digits.");
    if (form.role === "RESIDENT" && !form.flat_no) return setErr("Choose the resident's flat.");
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        pin: form.pin,
        role: form.role,
        flat_no: form.role === "RESIDENT" ? form.flat_no : null,
      };
      const u = await api("/admin/users", { method: "POST", body });
      setMsg(`Added ${u.name}. Tell them their PIN in person.`);
      setForm({ ...form, name: "", phone: "", pin: "" });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label>
        Name
        <input value={form.name} onChange={set("name")} />
      </label>
      <label>
        Phone
        <input type="tel" inputMode="numeric" value={form.phone} onChange={set("phone")} />
      </label>
      <label>
        PIN (they can be told to keep it private)
        <input inputMode="numeric" value={form.pin} onChange={set("pin")} />
      </label>
      <label>
        Role
        <select value={form.role} onChange={set("role")}>
          <option value="RESIDENT">Resident</option>
          <option value="WATCHMAN">Watchman</option>
          <option value="ADMIN">Admin</option>
        </select>
      </label>
      {form.role === "RESIDENT" && (
        <label>
          Flat
          <select value={form.flat_no} onChange={set("flat_no")}>
            <option value="">Choose...</option>
            {flats.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
      )}
      <ErrorBox text={err} />
      {msg && <div className="ok">{msg}</div>}
      <button className="btn primary" disabled={busy}>
        {busy ? "Adding..." : "Add person"}
      </button>
    </form>
  );
}

function Flats() {
  const [flats, setFlats] = useState([]);
  const [flat, setFlat] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    try {
      setFlats(await api("/flats"));
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e) {
    e.preventDefault();
    setErr("");
    const no = flat.trim();
    if (!no) return;
    try {
      await api(`/admin/flats/${encodeURIComponent(no)}`, { method: "POST" });
      setFlat("");
      load();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <div>
      <form onSubmit={add} className="inline">
        <input placeholder="Flat number, e.g. 101" value={flat} onChange={(e) => setFlat(e.target.value)} />
        <button className="btn primary">Add</button>
      </form>
      <ErrorBox text={err} />
      <div className="chips">
        {flats.map((f) => (
          <span className="pill" key={f}>
            {f}
          </span>
        ))}
      </div>
      <p className="muted small">{flats.length} flats</p>
    </div>
  );
}
