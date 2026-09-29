const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const pool = require("../db");
const requireAuth = require("../middleware/authMiddleware");

const router = express.Router();

// Blunt but effective brute-force protection on the auth endpoints. Skipped
// entirely in tests so the suite's own requests never trip it.
const authLimiter =
  process.env.NODE_ENV === "test"
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: "Too many attempts. Please try again in a few minutes." },
      });

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

router.post("/signup", authLimiter, async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are all required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, daily_water_goal_ml, daily_steps_goal, daily_sleep_goal_hours`,
      [name, email.toLowerCase(), passwordHash]
    );

    const user = result.rows[0];
    const token = signToken(user.id);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create account. Try again." });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, password_hash, daily_water_goal_ml, daily_steps_goal, daily_sleep_goal_hours
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    delete user.password_hash;
    const token = signToken(user.id);
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not log in. Try again." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, daily_water_goal_ml, daily_steps_goal, daily_sleep_goal_hours
       FROM users WHERE id = $1`,
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load profile." });
  }
});

router.patch("/goals", requireAuth, async (req, res) => {
  const steps = Number(req.body.daily_steps_goal);
  const water = Number(req.body.daily_water_goal_ml);
  const sleep = Number(req.body.daily_sleep_goal_hours);

  if (!Number.isFinite(steps) || steps < 1000 || steps > 50000) {
    return res.status(400).json({ error: "Step goal must be between 1,000 and 50,000." });
  }
  if (!Number.isFinite(water) || water < 500 || water > 10000) {
    return res.status(400).json({ error: "Water goal must be between 500 and 10,000 ml." });
  }
  if (!Number.isFinite(sleep) || sleep < 3 || sleep > 14) {
    return res.status(400).json({ error: "Sleep goal must be between 3 and 14 hours." });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET daily_steps_goal = $1, daily_water_goal_ml = $2, daily_sleep_goal_hours = $3
       WHERE id = $4
       RETURNING id, name, email, daily_water_goal_ml, daily_steps_goal, daily_sleep_goal_hours`,
      [steps, water, sleep, req.userId]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update goals." });
  }
});

module.exports = router;
