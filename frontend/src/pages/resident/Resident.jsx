import { useRef, useState } from "react";
import { api } from "../../api";
import { buzz, usePoll, useNow } from "../../hooks";
import { Chip, ErrorBox, Tabs } from "../../ui.jsx";
import { fmtTime, mmss, secondsLeft } from "../../time";

export default function Resident() {
  const [tab, setTab] = useState("pending");
  return (
    <div>
      <Tabs
        tabs={[
          ["pending", "Requests"],
          ["history", "History"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "pending" ? <Pending /> : <History />}
    </div>
  );
}

function Pending() {
  const [list, setList] = useState([]);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);
  const seen = useRef(null); // ids we already knew about
  const now = useNow();

  async function load() {
    try {
      const rows = await api("/visits/pending");
      const ids = new Set(rows.map((r) => r.id));
      // Buzz when a request appears that we have not seen before (not on the first load).
      if (seen.current && rows.some((r) => !seen.current.has(r.id))) buzz();
      seen.current = ids;
      setList(rows);
      setErr("");
    } catch (e) {
      setErr(e.message);
    }
  }
  usePoll(load, 4000, []);

  async function decide(id, decision) {
    setBusyId(id);
    setErr("");
    try {
      await api(`/visits/${id}/decision`, { method: "PATCH", body: { decision } });
    } catch (e) {
      setErr(e.message); // e.g. "Already EXPIRED"
    } finally {
      setBusyId(null);
      load();
    }
  }

  // Hide requests whose 2 minutes are up (the server will mark them expired too).
  const live = list.filter((v) => secondsLeft(v.created_at, now) > 0);

  return (
    <div>
      <ErrorBox text={err} />
      {live.length === 0 && <p className="muted">No visitors waiting for approval.</p>}
      {live.map((v) => (
        <div className="card ask" key={v.id}>
          <div className="row">
            <div>
              <strong className="big-name">{v.guest_name}</strong>
              <div className="muted">
                <a href={`tel:${v.guest_phone}`}>{v.guest_phone}</a>
                {v.purpose ? ` · ${v.purpose}` : ""}
              </div>
            </div>
            <div className="timer small-timer">{mmss(secondsLeft(v.created_at, now))}</div>
          </div>
          <div className="two">
            <button className="btn go" disabled={busyId === v.id} onClick={() => decide(v.id, "APPROVED")}>
              Approve
            </button>
            <button className="btn stop" disabled={busyId === v.id} onClick={() => decide(v.id, "REJECTED")}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function History() {
  const [list, setList] = useState([]);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setList(await api("/visits/history"));
      setErr("");
    } catch (e) {
      setErr(e.message);
    }
  }
  usePoll(load, 15000, []);

  return (
    <div>
      <ErrorBox text={err} />
      {list.length === 0 && <p className="muted">No visits yet.</p>}
      {list.map((v) => (
        <div className="card" key={v.id}>
          <div className="row">
            <div>
              <strong>{v.guest_name}</strong>
              <div className="muted">
                {v.flat_no ? `Flat ${v.flat_no} · ` : ""}
                {v.guest_phone}
                {v.purpose ? ` · ${v.purpose}` : ""}
              </div>
              <div className="muted small">{fmtTime(v.created_at)}</div>
            </div>
            <Chip status={v.status} />
          </div>
        </div>
      ))}
    </div>
  );
}
