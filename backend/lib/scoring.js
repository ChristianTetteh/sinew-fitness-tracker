// Pure functions extracted from the /summary/overview route so the "smart" parts of
// the app (score, streak, insight) can be unit tested without touching a database.

function computeScore(today, goals) {
  const pct = (type) => Math.min(100, Math.round((today[type] / goals[type]) * 100));
  return Math.round((pct("walk") + pct("water") + pct("sleep")) / 3);
}

// loggedDates: array of "YYYY-MM-DD" strings, sorted most-recent-first.
// todayStr: "YYYY-MM-DD", injectable for deterministic tests.
function computeStreak(allDates, todayStr = new Date().toISOString().slice(0, 10)) {
  // Entries dated after today (bad data / clock skew) must not produce a negative gap.
  const loggedDates = allDates.filter((d) => d <= todayStr);
  if (loggedDates.length === 0) return 0;

  const oneDayMs = 24 * 60 * 60 * 1000;
  const mostRecent = new Date(loggedDates[0]);
  const gapFromToday = Math.round((new Date(todayStr) - mostRecent) / oneDayMs);
  if (gapFromToday > 1) return 0; // most recent entry isn't today or yesterday: streak is broken

  let streak = 1;
  for (let i = 1; i < loggedDates.length; i++) {
    const prev = new Date(loggedDates[i - 1]);
    const curr = new Date(loggedDates[i]);
    if (Math.round((prev - curr) / oneDayMs) === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

const INSIGHT_LABELS = { walk: "steps", water: "water intake", sleep: "sleep" };
const DEFAULT_INSIGHT = "Keep logging daily to unlock personalized insights.";

// rows: [{ type, this_week, last_week }] — this_week/last_week are averages of per-day totals, or null.
function computeInsight(rows) {
  let insight = DEFAULT_INSIGHT;
  let bestChange = 0;
  let compared = false;

  rows.forEach((row) => {
    const thisWeek = Number(row.this_week) || 0;
    const lastWeek = Number(row.last_week) || 0;
    if (lastWeek > 0 && thisWeek > 0) {
      compared = true;
      const change = ((thisWeek - lastWeek) / lastWeek) * 100;
      // Changes that round to 0% aren't news ("up 0%"), so they never win.
      if (Math.round(Math.abs(change)) >= 1 && Math.abs(change) > Math.abs(bestChange)) {
        bestChange = change;
        const direction = change >= 0 ? "up" : "down";
        insight = `Your ${INSIGHT_LABELS[row.type]} is ${direction} ${Math.abs(Math.round(change))}% compared to last week.`;
      }
    }
  });

  if (compared && insight === DEFAULT_INSIGHT) return "Your daily averages are steady compared to last week.";
  return insight;
}

module.exports = { computeScore, computeStreak, computeInsight };
