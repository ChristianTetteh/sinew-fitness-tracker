const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ScoreCard({ score, streak, insight }) {
  const pct = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE * (1 - pct / 100);

  return (
    <section className="hero-card">
      <div className="hero-score">
        <svg viewBox="0 0 110 110" className="score-ring" aria-hidden="true">
          <circle cx="55" cy="55" r={RADIUS} className="score-ring-track" />
          <circle
            cx="55"
            cy="55"
            r={RADIUS}
            className="score-ring-fill"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="score-ring-center">
          <span className="score-ring-value">{score}</span>
          <span className="score-ring-max">/100</span>
        </div>
      </div>

      <div className="hero-details">
        <div className="hero-top">
          <span className="score-label">SINEW Score</span>
          <span className="score-sub">Today's goal completion — not a health measure</span>
        </div>

        <div className="hero-chips">
          <div className="streak-chip">
            <span className="streak-flame" aria-hidden="true">🔥</span>
            <span className="streak-value">{streak}</span>
            <span className="streak-label">{streak === 1 ? "day streak" : "day streak"}</span>
          </div>
          <div className="insight-chip">
            <span className="insight-label">Insight</span>
            <span className="insight-text">{insight}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
