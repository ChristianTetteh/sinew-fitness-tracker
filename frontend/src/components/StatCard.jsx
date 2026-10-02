import { MetricIcon } from "./Icons.jsx";

export default function StatCard({ label, metric, value, unit, goal, accent }) {
  const pct = goal ? Math.min(100, Math.round((value / goal) * 100)) : null;
  const remaining = goal ? Math.max(0, goal - value) : null;
  const metGoal = goal && value >= goal;

  return (
    <div className="stat-card" style={{ "--accent": accent }}>
      <div className="stat-card-top">
        <span className="stat-icon">
          <MetricIcon metric={metric} />
        </span>
        <span className="stat-label">{label}</span>
        {pct !== null && <span className="stat-pct">{pct}%</span>}
      </div>
      <div className="stat-value">
        {value.toLocaleString()}
        {goal ? <span className="stat-of-goal"> / {goal.toLocaleString()}</span> : null}
        <span className="stat-unit">{unit}</span>
      </div>
      {goal ? (
        <>
          <div className="stat-bar-track">
            <div className="stat-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="stat-goal">
            {metGoal ? "Goal reached today" : `${remaining.toLocaleString()} ${unit} to go today`}
          </div>
        </>
      ) : (
        <div className="stat-goal">Nothing logged today</div>
      )}
    </div>
  );
}
