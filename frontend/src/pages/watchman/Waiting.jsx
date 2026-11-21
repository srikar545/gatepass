import { useRef, useState } from "react";
import { api } from "../../api";
import { buzz, usePoll, useNow } from "../../hooks";
import { ErrorBox } from "../../ui.jsx";
import { mmss, secondsLeft } from "../../time";

// Shown right after the watchman sends a request. Checks the server every 3 seconds.
export default function Waiting({ visit: first, onDone }) {
  const [visit, setVisit] = useState(first);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const last = useRef(first.status);
  const now = useNow();

  async function refresh() {
    if (visit.status !== "PENDING") return; // nothing more to wait for
    try {
      const v = await api(`/visits/${visit.id}`);
      if (v.status !== last.current) {
        last.current = v.status;
        buzz();
      }
      setVisit(v);
      setErr("");
    } catch (e) {
      setErr(e.message);
    }
  }
  usePoll(refresh, 3000, [visit.status]);

  async function checkIn() {
    setBusy(true);
    try {
      setVisit(await api(`/visits/${visit.id}/checkin`, { method: "PATCH" }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendAgain() {
    setBusy(true);
    try {
      const v = await api("/visits", {
        method: "POST",
        body: {
          guest_name: visit.guest_name,
          guest_phone: visit.guest_phone,
          flat_no: visit.flat_no,
          purpose: visit.purpose,
        },
      });
      last.current = v.status;
      setVisit(v);
      setErr("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const left = secondsLeft(visit.created_at, now);
  // If the clock runs out but the server has not said so yet, the next poll will flip it to EXPIRED.
  const s = visit.status;

  return (
    <div>
      <div className="muted">
        {visit.guest_name} → Flat {visit.flat_no}
      </div>

      {s === "PENDING" && (
        <div className="panel wait">
          <div className="panel-title">Waiting for Flat {visit.flat_no}</div>
          <div className="timer">{mmss(left)}</div>
          <div>Do not let the guest in yet.</div>
        </div>
      )}

      {s === "APPROVED" && (
        <div className="panel allow">
          <div className="panel-title">ALLOW</div>
          <div>Flat {visit.flat_no} approved.</div>
          <button className="btn white" disabled={busy} onClick={checkIn}>
            Let them in (check in)
          </button>
        </div>
      )}

      {s === "CHECKED_IN" && (
        <div className="panel allow">
          <div className="panel-title">Checked in</div>
          <div>Remember to check them out when they leave.</div>
        </div>
      )}

      {s === "REJECTED" && (
        <div className="panel deny">
          <div className="panel-title">DENY</div>
          <div>Flat {visit.flat_no} said no. Do not let the guest in.</div>
        </div>
      )}

      {s === "EXPIRED" && (
        <div className="panel idle">
          <div className="panel-title">No reply</div>
          <div>Nobody answered in 2 minutes. Call the guest's host, or send again.</div>
          <button className="btn white" disabled={busy} onClick={sendAgain}>
            Send again
          </button>
        </div>
      )}

      <ErrorBox text={err} />
      <button className="btn" onClick={onDone}>
        {s === "PENDING" ? "Back to list (keeps waiting)" : "Done"}
      </button>
    </div>
  );
}
