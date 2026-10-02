import { useState } from "react";
import { dayLabel } from "../utils/dates";
import { METRIC_LABELS, METRIC_UNITS } from "../utils/metrics";

function groupByDay(logs) {
  const groups = [];
  const byDate = new Map();
  logs.forEach((log) => {
    const key = log.logged_at.slice(0, 10);
    if (!byDate.has(key)) {
      const group = { key, label: dayLabel(log.logged_at), entries: [] };
      byDate.set(key, group);
      groups.push(group);
    }
    byDate.get(key).entries.push(log);
  });
  return groups;
}

export default function RecentEntries({ logs, onDelete, onEdit }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [error, setError] = useState({ id: null, message: "" });

  function startEdit(log) {
    setEditingId(log.id);
    setEditValue(String(log.value));
    setConfirmingId(null);
    setError({ id: null, message: "" });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
    setError({ id: null, message: "" });
  }

  async function saveEdit(log) {
    setSavingId(log.id);
    setError({ id: null, message: "" });
    try {
      await onEdit(log.id, Number(editValue));
      setEditingId(null);
    } catch (err) {
      // Keep the editor open and show why (e.g. the daily cap would be exceeded).
      setError({ id: log.id, message: err.response?.data?.error || "Couldn't save that change. Try again." });
    } finally {
      setSavingId(null);
    }
  }

  async function confirmRemove(log) {
    setConfirmingId(null);
    await onDelete(log.id);
  }

  if (logs.length === 0) {
    return <p className="recent-empty">Nothing logged yet — add your first entry above.</p>;
  }

  const groups = groupByDay(logs);

  return (
    <div className="recent-groups">
      {groups.map((group) => (
        <div key={group.key} className="recent-group">
          <div className="recent-group-label">{group.label}</div>
          <ul className="recent-list">
            {group.entries.map((log) => {
              const name = METRIC_LABELS[log.type];
              const summary = `${name} entry, ${log.value.toLocaleString()} ${METRIC_UNITS[log.type]}, ${group.label}`;
              return (
                <li key={log.id} className="recent-item">
                  <span className={`recent-dot dot-${log.type}`} />
                  <span className="recent-type">{name}</span>
                  {editingId === log.id ? (
                    <>
                      <input
                        className="recent-edit-input"
                        type="number"
                        step="any"
                        value={editValue}
                        aria-label={`New value for ${summary}`}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                      />
                      <button
                        className="recent-action"
                        onClick={() => saveEdit(log)}
                        disabled={savingId === log.id}
                        aria-label={`Save ${summary}`}
                      >
                        {savingId === log.id ? "Saving…" : "Save"}
                      </button>
                      <button className="recent-action" onClick={cancelEdit} aria-label={`Cancel editing ${summary}`}>
                        Cancel
                      </button>
                      {error.id === log.id && (
                        <p className="recent-error" role="alert">
                          {error.message}
                        </p>
                      )}
                    </>
                  ) : confirmingId === log.id ? (
                    <>
                      <span className="recent-value" role="alert">
                        Remove this entry?
                      </span>
                      <button
                        className="recent-action recent-delete"
                        onClick={() => confirmRemove(log)}
                        aria-label={`Confirm removing ${summary}`}
                        autoFocus
                      >
                        Yes, remove
                      </button>
                      <button
                        className="recent-action"
                        onClick={() => setConfirmingId(null)}
                        aria-label={`Keep ${summary}`}
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="recent-value">
                        {log.value.toLocaleString()} {METRIC_UNITS[log.type]}
                      </span>
                      <button className="recent-action" onClick={() => startEdit(log)} aria-label={`Edit ${summary}`}>
                        Edit
                      </button>
                      <button
                        className="recent-action recent-delete"
                        onClick={() => setConfirmingId(log.id)}
                        aria-label={`Remove ${summary}`}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
