const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/authMiddleware");
const { validateValue } = require("../lib/validation");
const { computeScore, computeStreak, computeInsight } = require("../lib/scoring");

const router = express.Router();
const VALID_TYPES = ["walk", "water", "sleep"];

router.use(requireAuth);

// Create a log entry
router.post("/", async (req, res) => {
  const { type, value, logged_at } = req.body;

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: "Type must be one of: walk, water, sleep." });
  }
  const { numericValue, error } = validateValue(type, value);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const result = await pool.query(
      `INSERT INTO logs (user_id, type, value, logged_at)
       VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE))
       RETURNING id, type, value, logged_at`,
      [req.userId, type, numericValue, logged_at || null]
    );
    res.status(201).json({ log: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save that entry." });
  }
});

// List recent logs, optionally filtered by type, most recent first
router.get("/", async (req, res) => {
  const { type, days = 30 } = req.query;
  const params = [req.userId, Number(days) || 30];
  let query = `
    SELECT id, type, value, logged_at
    FROM logs
    WHERE user_id = $1 AND logged_at >= CURRENT_DATE - ($2 || ' days')::interval
  `;
  if (type) {
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
});

// Edit an existing log entry's value (only if it belongs to the caller)
router.put("/:id", async (req, res) => {
  const { value } = req.body;
  try {
    const existing = await pool.query(
      "SELECT type FROM logs WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Entry not found." });
    }
    const { numericValue, error } = validateValue(existing.rows[0].type, value);
    if (error) {
      return res.status(400).json({ error });
    }
    const result = await pool.query(
      "UPDATE logs SET value = $1 WHERE id = $2 AND user_id = $3 RETURNING id, type, value, logged_at",
      [numericValue, req.params.id, req.userId]
    );
    res.json({ log: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update that entry." });
  }
});

// Delete a log entry (only if it belongs to the caller)
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM logs WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entry not found." });
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete that entry." });
  }
});

// Daily totals per type for the last N days, for the dashboard charts
router.get("/summary/weekly", async (req, res) => {
  const days = Number(req.query.days) || 7;
  try {
    const result = await pool.query(
      `SELECT logged_at, type, SUM(value)::float AS total
       FROM logs
       WHERE user_id = $1 AND logged_at >= CURRENT_DATE - ($2 || ' days')::interval
       GROUP BY logged_at, type
       ORDER BY logged_at ASC`,
      [req.userId, days]
    );

    const todayResult = await pool.query(
      `SELECT type, SUM(value)::float AS total
       FROM logs
       WHERE user_id = $1 AND logged_at = CURRENT_DATE
       GROUP BY type`,
      [req.userId]
    );

    res.json({ history: result.rows, today: todayResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load summary." });
  }
});

// One call that powers the dashboard: today's totals, goal-completion score,
// logging streak, and a plain-language insight comparing this week to last week.
router.get("/summary/overview", async (req, res) => {
  const days = Number(req.query.days) || 7;
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
       WHERE user_id = $1 AND logged_at >= CURRENT_DATE - ($2 || ' days')::interval
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
       WHERE user_id = $1 AND logged_at >= CURRENT_DATE - INTERVAL '90 days'
       ORDER BY logged_at DESC`,
      [req.userId]
    );
    const loggedDates = streakDaysResult.rows.map((r) => r.logged_at.toISOString().slice(0, 10));
    const streak = computeStreak(loggedDates);

    // Insight: compare this week's daily average per metric to the prior week's.
    const weekAvgResult = await pool.query(
      `SELECT
         type,
         AVG(value) FILTER (WHERE logged_at >= CURRENT_DATE - INTERVAL '7 days') AS this_week,
         AVG(value) FILTER (WHERE logged_at < CURRENT_DATE - INTERVAL '7 days' AND logged_at >= CURRENT_DATE - INTERVAL '14 days') AS last_week
       FROM logs
       WHERE user_id = $1 AND logged_at >= CURRENT_DATE - INTERVAL '14 days'
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
});

module.exports = router;
