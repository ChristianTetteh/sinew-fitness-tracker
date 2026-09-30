import { useState } from "react";

const TYPES = [
  { key: "walk", label: "Walk", unit: "steps", placeholder: "e.g. 4500", min: 1, max: 50000 },
  { key: "water", label: "Water", unit: "ml", placeholder: "e.g. 500", min: 1, max: 10000 },
  { key: "sleep", label: "Sleep", unit: "hours", placeholder: "e.g. 7.5", min: 0.25, max: 24 },
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
    <form className="quick-log" onSubmit={handleSubmit}>
      <div className="quick-log-tabs">
        {TYPES.map((t) => (
          <button
            type="button"
            key={t.key}
            className={`quick-log-tab ${active === t.key ? "is-active" : ""}`}
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
          placeholder={activeType.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <span className="quick-log-unit">{activeType.unit}</span>
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Logging…" : "Log it"}
        </button>
      </div>
      {error && <p className="quick-log-error">{error}</p>}
    </form>
  );
}
