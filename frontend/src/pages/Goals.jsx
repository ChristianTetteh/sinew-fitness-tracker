import { useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext.jsx";
import Sidebar from "../components/Sidebar.jsx";

export default function Goals() {
  const { user, updateUser } = useAuth();
  const [steps, setSteps] = useState(user?.daily_steps_goal ?? 8000);
  const [water, setWater] = useState(user?.daily_water_goal_ml ?? 2000);
  const [sleep, setSleep] = useState(user?.daily_sleep_goal_hours ?? 8);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setBusy(true);
    try {
      const res = await api.patch("/auth/goals", {
        daily_steps_goal: Number(steps),
        daily_water_goal_ml: Number(water),
        daily_sleep_goal_hours: Number(sleep),
      });
      updateUser(res.data.user);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't save your goals. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main">
        <header className="main-header">
          <h1>Goals</h1>
          <p className="main-sub">Set your own daily targets — SINEW will track progress against these.</p>
        </header>

        <form className="goals-form" onSubmit={handleSave}>
          <label className="goals-field">
            <span>Daily steps</span>
            <input
              type="number"
              min="1000"
              max="50000"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
          </label>
          <label className="goals-field">
            <span>Daily water (ml)</span>
            <input
              type="number"
              min="500"
              max="10000"
              value={water}
              onChange={(e) => setWater(e.target.value)}
            />
          </label>
          <label className="goals-field">
            <span>Sleep (hours)</span>
            <input
              type="number"
              step="0.5"
              min="3"
              max="14"
              value={sleep}
              onChange={(e) => setSleep(e.target.value)}
            />
          </label>

          {error && <p className="auth-error" role="alert">{error}</p>}
          {saved && <p className="goals-saved" role="status">Goals updated ✓</p>}

          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save goals"}
          </button>
        </form>
      </main>
    </div>
  );
}
