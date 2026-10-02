const pool = require("../db");

// Runs fn(client) in a transaction holding a per-user advisory lock, so concurrent
// requests from the same user are serialised. The daily-cap checks read a SUM and then
// write, which is only safe if no other write for that user can slip in between.
async function withUserLock(userId, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [userId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Rollback failed", rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withUserLock };
