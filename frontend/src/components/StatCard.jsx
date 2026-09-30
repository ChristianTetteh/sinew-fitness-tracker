function Icon({ metric }) {
  switch (metric) {
    case "walk":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M9 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm2.2 6.4-3.6 1c-.8.2-1.3.9-1.3 1.7v4.4a1 1 0 0 0 2 0v-3.4l1.1-.3-.5 3.1-2.4 3.2a1 1 0 0 0 1.6 1.2l2.4-3.2.9-3 .9 1.9v4.2a1 1 0 0 0 2 0v-4.4c0-.2 0-.4-.1-.6l-1.6-3.5c-.3-.7-1-1.1-1.7-1Z"
          />
          <circle cx="16.5" cy="8" r="1.8" fill="currentColor" opacity="0.55" />
        </svg>
      );
    case "water":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2.5s6.5 7.2 6.5 12a6.5 6.5 0 1 1-13 0c0-4.8 6.5-12 6.5-12Z"
          />
        </svg>
      );
    case "sleep":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M20.5 15.3a8.5 8.5 0 1 1-9.8-12 7 7 0 1 0 9.8 12Z"
          />
        </svg>
      );
    default:
      return null;
  }
}

export default function StatCard({ label, metric, value, unit, goal, accent }) {
  const pct = goal ? Math.min(100, Math.round((value / goal) * 100)) : null;
  const remaining = goal ? Math.max(0, goal - value) : null;
  const metGoal = goal && value >= goal;

  return (
    <div className="stat-card" style={{ "--accent": accent }}>
      <div className="stat-card-top">
        <span className="stat-icon">
          <Icon metric={metric} />
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
            {metGoal
              ? "Goal reached today 🎉"
              : `${remaining.toLocaleString()} ${unit} more to reach today's goal`}
          </div>
        </>
      ) : (
        <div className="stat-goal">no entries yet today</div>
      )}
    </div>
  );
}
