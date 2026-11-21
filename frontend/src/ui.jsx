const LABELS = {
  PENDING: "Waiting",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "No reply",
  CHECKED_IN: "Inside",
  CHECKED_OUT: "Left",
};

export function Chip({ status }) {
  return <span className={`chip chip-${status}`}>{LABELS[status] || status}</span>;
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <nav className="tabs">
      {tabs.map(([key, label]) => (
        <button key={key} className={key === value ? "tab on" : "tab"} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </nav>
  );
}

export function ErrorBox({ text }) {
  return text ? <div className="error" role="alert">{text}</div> : null;
}
