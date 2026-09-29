const { computeScore, computeStreak, computeInsight } = require("../lib/scoring");

describe("computeScore", () => {
  it("averages goal-completion percentage across the three metrics", () => {
    const today = { walk: 4000, water: 1800, sleep: 5.6 };
    const goals = { walk: 8000, water: 2000, sleep: 8 };
    // 50%, 90%, 70% -> average 70
    expect(computeScore(today, goals)).toBe(70);
  });

  it("caps any single metric at 100% even if its goal is exceeded", () => {
    const today = { walk: 20000, water: 2000, sleep: 8 };
    const goals = { walk: 8000, water: 2000, sleep: 8 };
    expect(computeScore(today, goals)).toBe(100);
  });

  it("returns 0 when nothing has been logged today", () => {
    const today = { walk: 0, water: 0, sleep: 0 };
    const goals = { walk: 8000, water: 2000, sleep: 8 };
    expect(computeScore(today, goals)).toBe(0);
  });
});

describe("computeStreak", () => {
  it("returns 0 with no logged days", () => {
    expect(computeStreak([])).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const dates = ["2026-01-10", "2026-01-09", "2026-01-08"];
    expect(computeStreak(dates, "2026-01-10")).toBe(3);
  });

  it("still counts as active if the most recent entry was yesterday", () => {
    const dates = ["2026-01-09", "2026-01-08"];
    expect(computeStreak(dates, "2026-01-10")).toBe(2);
  });

  it("resets to 0 if the most recent entry is more than a day old", () => {
    const dates = ["2026-01-05"];
    expect(computeStreak(dates, "2026-01-10")).toBe(0);
  });

  it("stops counting at the first gap in the date list", () => {
    const dates = ["2026-01-10", "2026-01-09", "2026-01-07"]; // gap between 09 and 07
    expect(computeStreak(dates, "2026-01-10")).toBe(2);
  });
});

describe("computeInsight", () => {
  it("returns the default message when there's no prior-week data", () => {
    expect(computeInsight([{ type: "walk", this_week: 5000, last_week: null }])).toMatch(
      /unlock personalized insights/
    );
  });

  it("reports the metric with the largest percentage change", () => {
    const rows = [
      { type: "walk", this_week: 5000, last_week: 5000 }, // 0%
      { type: "water", this_week: 1800, last_week: 1200 }, // +50%
      { type: "sleep", this_week: 6, last_week: 8 }, // -25%
    ];
    expect(computeInsight(rows)).toMatch(/water intake is up 50%/);
  });

  it("reports a decrease with the correct direction and magnitude", () => {
    const rows = [{ type: "sleep", this_week: 6, last_week: 8 }];
    expect(computeInsight(rows)).toMatch(/sleep is down 25%/);
  });
});
