const jwt = require("jsonwebtoken");
const pool = require("../db");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing authentication token." });
  }

  let userId;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    userId = payload.userId;
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }

  try {
    // A valid token can outlive its account; treat that as unauthenticated, not a 500.
    const result = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Account no longer exists." });
    }
    req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;
