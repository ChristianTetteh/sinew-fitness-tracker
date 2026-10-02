import { useState } from "react";
import { METRIC_LABELS } from "../utils/metrics";

const TYPES = [
  { key: "walk", label: METRIC_LABELS.walk, unit: "steps", placeholder: "e.g. 4500", min: 1, max: 50000 },
  { key: "water", label: METRIC_LABELS.water, unit: "ml", placeholder: "e.g. 500", min: 1, max: 10000 },
  { key: "sleep", label: METRIC_LABELS.sleep, unit: "hours", placeholder: "e.g. 7.5", min: 0.25, max: 24 },
];

export default function QuickLog({ onLog }) {
  const [active, setActive] = useState("walk");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeType = TYPES.find((t) => t.key === active);

  function switchType(key) {
    setActive(key);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const numericValue = Number(value);
    if (!value || Number.isNaN(numericValue)) {
      setError("Enter a value to log.");
      return;
    }
    if (numericValue < activeType.min || numericValue > activeType.max) {
      setError(
        `${activeType.label} must be between ${activeType.min} and ${activeType.max.toLocaleString()} ${activeType.unit}.`
      );
      return;
    }
    setBusy(true);
    try {
      await onLog(active, numericValue);
      setValue("");
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't save that entry. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="quick-log" id="quick-log" onSubmit={handleSubmit} aria-label="Log an entry">
      <h2 className="quick-log-title">Log an entry</h2>
      <div className="quick-log-tabs" role="group" aria-label="What to log">
        {TYPES.map((t) => (
          <button
            type="button"
            key={t.key}
            className={`quick-log-tab t-${t.key} ${active === t.key ? "is-active" : ""}`}
            aria-pressed={active === t.key}
            onClick={() => switchType(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="quick-log-input-row">
        <input
          type="number"
          step="any"
          min={activeType.min}
          max={activeType.max}
          inputMode="decimal"
          aria-label={`${activeType.label} amount in ${activeType.unit}`}
          placeholder={activeType.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <span className="quick-log-unit" aria-hidden="true">{activeType.unit}</span>
      </div>
      <button className="btn-primary btn-block" type="submit" disabled={busy}>
        {busy ? "Logging…" : `Log ${activeType.label.toLowerCase()}`}
      </button>
      {error && <p className="quick-log-error" role="alert">{error}</p>}
    </form>
  );
}
