const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/authMiddleware");
const asyncHandler = require("../lib/asyncHandler");
const { withUserLock } = require("../lib/tx");
const { validateValue, validateDailyTotal, validateLoggedAt, parseId, parseDays } = require("../lib/validation");
const { computeScore, computeStreak, computeInsight } = require("../lib/scoring");

const router = express.Router();
const VALID_TYPES = ["walk", "water", "sleep"];

router.use(requireAuth);

// Create a log entry
router.post("/", asyncHandler(async (req, res) => {
  const { type, value, logged_at } = req.body;

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: "Type must be one of: walk, water, sleep." });
  }
  const { numericValue, error } = validateValue(type, value);
  if (error) {
    return res.status(400).json({ error });
  }
  const { date, error: dateError } = validateLoggedAt(logged_at);
  if (dateError) {
    return res.status(400).json({ error: dateError });
  }

  try {
    // Cumulative check: even though this single entry is within bounds, it must not
    // push the day's total (across all of that day's entries for this type) past the
    // daily cap. The per-user advisory lock makes check + insert atomic, so two
    // concurrent requests can't both pass the check and jointly exceed the cap.
    const outcome = await withUserLock(req.userId, async (client) => {
      const totalResult = await client.query(
        `SELECT COALESCE(SUM(value), 0)::float AS total
         FROM logs
         WHERE user_id = $1 AND type = $2 AND logged_at = COALESCE($3::date, CURRENT_DATE)`,
        [req.userId, type, date]
      );
      const dailyError = validateDailyTotal(type, totalResult.rows[0].total, numericValue).error;
      if (dailyError) return { status: 400, body: { error: dailyError } };

      const result = await client.query(
        `INSERT INTO logs (user_id, type, value, logged_at)
         VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE))
         RETURNING id, type, value, logged_at`,
        [req.userId, type, numericValue, date]
      );
      return { status: 201, body: { log: result.rows[0] } };
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save that entry." });
  }
}));

// List recent logs, optionally filtered by type, most recent first
router.get("/", asyncHandler(async (req, res) => {
  const { type } = req.query;
  const { days, error: daysError } = parseDays(req.query.days, 30);
  if (daysError) {
    return res.status(400).json({ error: daysError });
  }
  const params = [req.userId, days];
  let query = `
    SELECT id, type, value, logged_at
    FROM logs
    WHERE user_id = $1 AND logged_at > CURRENT_DATE - $2::int
  `;
  if (type !== undefined) {
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: "Invalid type filter." });
    }
    params.push(type);
    query += ` AND type = $3`;
  }
  query += " ORDER BY logged_at DESC, created_at DESC";

  try {
    const result = await pool.query(query, params);
    res.json({ logs: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load entries." });
  }
}));

// Edit an existing log entry's value (only if it belongs to the caller)
router.put("/:id", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Invalid entry id." });
  }
  const { value } = req.body;
  try {
    const outcome = await withUserLock(req.userId, async (client) => {
      const existing = await client.query(
        "SELECT type, logged_at FROM logs WHERE id = $1 AND user_id = $2",
        [id, req.userId]
      );
      if (existing.rows.length === 0) return { status: 404, body: { error: "Entry not found." } };

      const { type: existingType, logged_at: existingDate } = existing.rows[0];
      const { numericValue, error } = validateValue(existingType, value);
      if (error) return { status: 400, body: { error } };

      // Same cumulative check as create, but excluding this entry's own
      // current value from the existing total (it's about to be replaced).
      const totalResult = await client.query(
        `SELECT COALESCE(SUM(value), 0)::float AS total
         FROM logs
         WHERE user_id = $1 AND type = $2 AND logged_at = $3 AND id != $4`,
        [req.userId, existingType, existingDate, id]
      );
      const dailyError = validateDailyTotal(existingType, totalResult.rows[0].total, numericValue).error;
      if (dailyError) return { status: 400, body: { error: dailyError } };

      const result = await client.query(
        "UPDATE logs SET value = $1 WHERE id = $2 AND user_id = $3 RETURNING id, type, value, logged_at",
        [numericValue, id, req.userId]
      );
      return { status: 200, body: { log: result.rows[0] } };
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update that entry." });
  }
}));

// Delete a log entry (only if it belongs to the caller)
router.delete("/:id", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Invalid entry id." });
  }
  try {
    const result = await pool.query(
      "DELETE FROM logs WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entry not found." });
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete that entry." });
  }
}));

// One call that powers the dashboard: today's totals, goal-completion score,
// logging streak, and a plain-language insight comparing this week to last week.
router.get("/summary/overview", asyncHandler(async (req, res) => {
  const { days, error: daysError } = parseDays(req.query.days, 7);
  if (daysError) {
    return res.status(400).json({ error: daysError });
  }
  try {
    const userResult = await pool.query(
      `SELECT daily_water_goal_ml, daily_steps_goal, daily_sleep_goal_hours
       FROM users WHERE id = $1`,
      [req.userId]
    );
    const goals = userResult.rows[0];

    const historyResult = await pool.query(
      `SELECT logged_at, type, SUM(value)::float AS total
       FROM logs
       WHERE user_id = $1 AND logged_at > CURRENT_DATE - $2::int AND logged_at <= CURRENT_DATE
       GROUP BY logged_at, type
       ORDER BY logged_at ASC`,
      [req.userId, days]
    );

    const todayResult = await pool.query(
      `SELECT type, SUM(value)::float AS total
       FROM logs WHERE user_id = $1 AND logged_at = CURRENT_DATE
       GROUP BY type`,
      [req.userId]
    );
    const today = { walk: 0, water: 0, sleep: 0 };
    todayResult.rows.forEach((row) => (today[row.type] = row.total));

    const goalFor = {
      walk: goals.daily_steps_goal,
      water: goals.daily_water_goal_ml,
      sleep: Number(goals.daily_sleep_goal_hours),
    };
    const score = computeScore(today, goalFor);

    // Streak: consecutive days (ending today or yesterday) with at least one entry.
    const streakDaysResult = await pool.query(
      `SELECT DISTINCT logged_at FROM logs
       WHERE user_id = $1
       ORDER BY logged_at DESC`,
      [req.userId]
    );
    const loggedDates = streakDaysResult.rows.map((r) => r.logged_at);
    const streak = computeStreak(loggedDates);

    // Insight: compare the average *daily total* per metric over the last 7 days
    // (today and the 6 days before) with the 7 days before that. Entries are summed
    // per day first, so several small entries in one day aren't averaged as if each
    // were a full day; days with no entries are not counted.
    const weekAvgResult = await pool.query(
      `SELECT
         type,
         AVG(total) FILTER (WHERE logged_at > CURRENT_DATE - 7) AS this_week,
         AVG(total) FILTER (WHERE logged_at <= CURRENT_DATE - 7) AS last_week
       FROM (
         SELECT type, logged_at, SUM(value) AS total
         FROM logs
         WHERE user_id = $1 AND logged_at > CURRENT_DATE - 14 AND logged_at <= CURRENT_DATE
         GROUP BY type, logged_at
       ) AS daily
       GROUP BY type`,
      [req.userId]
    );
    const insight = computeInsight(weekAvgResult.rows);

    res.json({
      today,
      goals: goalFor,
      history: historyResult.rows,
      score,
      streak,
      insight,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load overview." });
  }
}));

module.exports = router;
