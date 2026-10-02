const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const pool = require("../db");
const requireAuth = require("../middleware/authMiddleware");
const asyncHandler = require("../lib/asyncHandler");

const router = express.Router();

// Blunt but effective brute-force protection on the auth endpoints. Skipped
// entirely in tests so the suite's own requests never trip it.
const authLimiter =
  process.env.NODE_ENV === "test"
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        skipSuccessfulRequests: true, // only failed attempts count toward the limit
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: "Too many attempts. Please try again in a few minutes." },
      });

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "30d" });
}

// Compared against when the email is unknown so login takes about as long either way.
const DUMMY_HASH = bcrypt.hashSync("sinew-timing-equaliser", 10);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/signup", authLimiter, asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Name, email, and password are all required." });
  }
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanName || !cleanEmail || !password) {
    return res.status(400).json({ error: "Name, email, and password are all required." });
  }
  if (cleanName.length > 100) {
    return res.status(400).json({ error: "Name must be 100 characters or fewer." });
  }
  if (cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (Buffer.byteLength(password) > 72) {
    // bcrypt only uses the first 72 bytes; refuse rather than silently truncate.
    return res.status(400).json({ error: "Password must be at most 72 bytes." });
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE lower(email) = $1", [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, daily_water_goal_ml, daily_steps_goal, daily_sleep_goal_hours`,
      [cleanName, cleanEmail, passwordHash]
    );

    const user = result.rows[0];
    const token = signToken(user.id);
    res.status(201).json({ token, user });
  } catch (err) {
    // Two simultaneous signups can both pass the SELECT above; the unique index decides.
    if (err.code === "23505") {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create account. Try again." });
  }
}));

router.post("/login", authLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, password_hash, daily_water_goal_ml, daily_steps_goal, daily_sleep_goal_hours
       FROM users WHERE lower(email) = $1`,
      [email.trim().toLowerCase()]
    );
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !valid) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    delete user.password_hash;
    const token = signToken(user.id);
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not log in. Try again." });
  }
}));

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
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
}));

router.patch("/goals", requireAuth, asyncHandler(async (req, res) => {
  const steps = Number(req.body.daily_steps_goal);
  const water = Number(req.body.daily_water_goal_ml);
  const sleep = Number(req.body.daily_sleep_goal_hours);

  if (!Number.isInteger(steps) || steps < 1000 || steps > 50000) {
    return res.status(400).json({ error: "Step goal must be between 1,000 and 50,000." });
  }
  if (!Number.isInteger(water) || water < 500 || water > 10000) {
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
}));

module.exports = router;
