import { useId } from "react";
import { IconFlame } from "./Icons.jsx";

const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEGMENTS = 40; // the ring is cut into "fibres"; the filled share is revealed through the same cuts
const SEG = CIRCUMFERENCE / SEGMENTS;
const GAP = 3.2;

export default function ScoreCard({ score, streak, insight }) {
  const uid = useId();
  const maskId = `${uid}-fibres`;
  const pct = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE * (1 - pct / 100);
  const cuts = `${SEG - GAP} ${GAP}`;

  return (
    <section className="hero-card" aria-label="Today's effort">
      <div className="hero-score">
        <svg viewBox="0 0 180 180" className="score-ring" aria-hidden="true">
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="180">
              <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="#fff" strokeWidth="14" strokeDasharray={cuts} />
            </mask>
          </defs>
          <circle cx="90" cy="90" r={RADIUS} className="score-ring-track" strokeDasharray={cuts} />
          <g mask={`url(#${maskId})`}>
            <circle
              cx="90"
              cy="90"
              r={RADIUS}
              className="score-ring-fill"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
            />
          </g>
        </svg>
        <div className="score-ring-center">
          <span className="score-ring-value">{score}</span>
          <span className="score-ring-max">out of 100</span>
        </div>
      </div>

      <div className="hero-details">
        <div className="hero-top">
          <h2 className="score-label">Today's effort</h2>
          <p className="score-sub">Your SINEW score is how much of today's goals you've completed. It isn't a health measure.</p>
        </div>

        <div className="hero-foot">
          <div className="streak-chip">
            <span className="streak-flame"><IconFlame width="20" height="20" /></span>
            <span className="streak-value">{streak}</span>
            <span className="streak-label">day streak</span>
          </div>
          <p className="insight-text">{insight}</p>
        </div>
      </div>
    </section>
  );
}
