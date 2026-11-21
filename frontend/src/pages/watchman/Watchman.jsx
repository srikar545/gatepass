import { useState } from "react";
import { api } from "../../api";
import { usePoll } from "../../hooks";
import { Chip, ErrorBox } from "../../ui.jsx";
import { fmtTime } from "../../time";
import NewVisit from "./NewVisit.jsx";
import Waiting from "./Waiting.jsx";

export default function Watchman() {
  // view: "home" | "new" | a visit object (the waiting screen)
  const [view, setView] = useState("home");

  if (view === "new") {
    return <NewVisit onBack={() => setView("home")} onCreated={(v) => setView(v)} />;
  }
  if (typeof view === "object") {
    return <Waiting visit={view} onDone={() => setView("home")} />;
  }
  return <Home onNew={() => setView("new")} onOpen={(v) => setView(v)} />;
}

function Home({ onNew, onOpen }) {
  const [list, setList] = useState([]);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      setList(await api("/visits/active"));
      setErr("");
    } catch (e) {
      setErr(e.message);
    }
  }
  usePoll(load, 4000, []);

  async function act(id, action) {
    setBusyId(id);
    try {
      await api(`/visits/${id}/${action}`, { method: "PATCH" });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <button className="btn primary big" onClick={onNew}>
        + New visitor
      </button>
      <ErrorBox text={err} />

      <h2>At the gate and inside</h2>
      {list.length === 0 && <p className="muted">No one right now.</p>}
      {list.map((v) => (
        <div className="card" key={v.id}>
          <div className="row">
            <div>
              <strong>{v.guest_name}</strong>
              <div className="muted">
                Flat {v.flat_no} · <a href={`tel:${v.guest_phone}`}>{v.guest_phone}</a>
              </div>
              <div className="muted small">
                {v.purpose ? `${v.purpose} · ` : ""}
                {fmtTime(v.created_at)}
              </div>
            </div>
            <Chip status={v.status} />
          </div>

          {v.status === "PENDING" && (
            <button className="btn" onClick={() => onOpen(v)}>
              View waiting screen
            </button>
          )}
          {v.status === "APPROVED" && (
            <button className="btn go" disabled={busyId === v.id} onClick={() => act(v.id, "checkin")}>
              Allow in (check in)
            </button>
          )}
          {v.status === "CHECKED_IN" && (
            <button className="btn" disabled={busyId === v.id} onClick={() => act(v.id, "checkout")}>
              Guest left (check out)
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
