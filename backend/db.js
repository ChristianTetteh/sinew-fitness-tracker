const { Pool, types } = require("pg");

// Return DATE columns as plain "YYYY-MM-DD" strings (pg's default builds a JS Date at
// local midnight, which shifts the day when serialised to JSON) and NUMERIC columns as
// numbers (pg returns them as strings to avoid precision loss; our values are small).
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1700, (value) => parseFloat(value));

// DATABASE_URL example: postgres://user:password@host:5432/sinew
// Render/Railway/Supabase Postgres instances usually require SSL in production.
//
// rejectUnauthorized is false because managed providers' pooler endpoints present
// certificates that don't chain to the system trust store, so strict verification
// would refuse to connect. The connection is still encrypted, but the server's
// identity is not verified. For a stricter setup, pin the provider's CA instead:
//   ssl: { ca: fs.readFileSync("provider-ca.pem"), rejectUnauthorized: true }
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});

module.exports = pool;
