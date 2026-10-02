// Real-database integration tests. Skipped unless TEST_DATABASE_URL is set, e.g.
//   TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:5432/sinew_test npm test
// WARNING: this DROPS and recreates the users/logs tables in that database. Use a scratch DB.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("integration (real Postgres)", () => {
  let request, jwt, pool, app, fs, path;
  let token;
  let userId;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const applySchema = () => pool.query(fs.readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8"));
  // Date string `n` days before the database's CURRENT_DATE.
  const daysAgo = async (n) =>
    (await pool.query("SELECT (CURRENT_DATE - $1::int)::text AS d", [n])).rows[0].d;
  const seed = (type, value, offset) =>
    pool.query("INSERT INTO logs (user_id, type, value, logged_at) VALUES ($1, $2, $3, CURRENT_DATE - $4::int)", [
      userId,
      type,
      value,
      offset,
    ]);

  beforeAll(async () => {
    // Set before db.js is first required; dotenv never overrides existing variables.
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.PGSSL = "false";
    process.env.JWT_SECRET = "integration-secret";
    process.env.NODE_ENV = "test";
    request = require("supertest");
    jwt = require("jsonwebtoken");
    fs = require("fs");
    path = require("path");
    pool = require("../db");
    app = require("../server");

    await pool.query("DROP TABLE IF EXISTS logs; DROP TABLE IF EXISTS users;");
    await applySchema();
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE logs, users RESTART IDENTITY CASCADE");
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Ama", email: "Ama@Example.com", password: "supersecret" });
    expect(res.status).toBe(201);
    token = res.body.token;
    userId = res.body.user.id;
  });

  it("re-applying the schema is idempotent", async () => {
    await applySchema();
    await applySchema();
  });

  describe("auth", () => {
    it("lower-cases email, and rejects a case-variant duplicate with 409", async () => {
      expect((await pool.query("SELECT email FROM users")).rows[0].email).toBe("ama@example.com");
      const res = await request(app)
        .post("/api/auth/signup")
        .send({ name: "Other", email: "AMA@example.COM", password: "supersecret" });
      expect(res.status).toBe(409);
    });

    it("the unique index (not just the app check) turns a racing duplicate into 409, not 500", async () => {
      const body = { name: "Race", email: "race@example.com", password: "supersecret" };
      const results = await Promise.all([1, 2, 3].map(() => request(app).post("/api/auth/signup").send(body)));
      expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    });

    it("logs in case-insensitively and returns numeric goals", async () => {
      const res = await request(app).post("/api/auth/login").send({ email: "AMA@example.com", password: "supersecret" });
      expect(res.status).toBe(200);
      expect(res.body.user.daily_sleep_goal_hours).toBe(8);
      expect(typeof res.body.user.daily_sleep_goal_hours).toBe("number");
    });

    it("returns 401 (not 500) for a valid token whose user was deleted", async () => {
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
      expect((await request(app).get("/api/logs").set(auth())).status).toBe(401);
      expect((await request(app).get("/api/auth/me").set(auth())).status).toBe(401);
    });

    it("rejects a token with a forged algorithm", async () => {
      const none = jwt.sign({ userId }, "integration-secret", { algorithm: "HS384" });
      expect((await request(app).get("/api/auth/me").set({ Authorization: `Bearer ${none}` })).status).toBe(401);
    });
  });

  describe("logs", () => {
    it("returns logged_at as YYYY-MM-DD and value as a number", async () => {
      const post = await request(app).post("/api/logs").set(auth()).send({ type: "sleep", value: 7.5 });
      expect(post.status).toBe(201);
      expect(post.body.log.value).toBe(7.5);
      expect(post.body.log.logged_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const list = await request(app).get("/api/logs").set(auth());
      expect(list.body.logs[0]).toMatchObject({ type: "sleep", value: 7.5, logged_at: post.body.log.logged_at });
    });

    it("stores an explicit logged_at on exactly that calendar day", async () => {
      const day = await daysAgo(3);
      const post = await request(app).post("/api/logs").set(auth()).send({ type: "water", value: 500, logged_at: day });
      expect(post.status).toBe(201);
      expect(post.body.log.logged_at).toBe(day);
    });

    it("rejects future and impossible dates", async () => {
      const send = (logged_at) => request(app).post("/api/logs").set(auth()).send({ type: "water", value: 500, logged_at });
      expect((await send("2999-01-01")).status).toBe(400);
      expect((await send("2026-02-30")).status).toBe(400);
    });

    it("the daily cap holds under concurrent requests", async () => {
      const results = await Promise.all(
        Array.from({ length: 6 }, () => request(app).post("/api/logs").set(auth()).send({ type: "water", value: 3000 }))
      );
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(3);
      expect(statuses.filter((s) => s === 400)).toHaveLength(3);
      const { rows } = await pool.query("SELECT SUM(value)::float AS total FROM logs WHERE user_id = $1", [userId]);
      expect(rows[0].total).toBe(9000);
    });

    it("the cap also holds for concurrent edits", async () => {
      const ids = [];
      for (let i = 0; i < 2; i++) {
        ids.push((await request(app).post("/api/logs").set(auth()).send({ type: "sleep", value: 6 })).body.log.id);
      }
      // Each edit alone (6 + 15 = 21) is fine, both together (30) are not.
      const results = await Promise.all(
        ids.map((id) => request(app).put(`/api/logs/${id}`).set(auth()).send({ value: 15 }))
      );
      expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    });

    it("handles bad ids and days with 4xx, never 500", async () => {
      expect((await request(app).put("/api/logs/abc").set(auth()).send({ value: 5 })).status).toBe(400);
      expect((await request(app).delete("/api/logs/99999999999").set(auth())).status).toBe(400);
      expect((await request(app).delete("/api/logs/424242").set(auth())).status).toBe(404);
      expect((await request(app).get("/api/logs?days=abc").set(auth())).status).toBe(400);
      expect((await request(app).get("/api/logs?days=365").set(auth())).status).toBe(200);
    });

    it("won't let one user touch another user's entry", async () => {
      const other = await request(app)
        .post("/api/auth/signup")
        .send({ name: "Kofi", email: "kofi@example.com", password: "supersecret" });
      const log = await request(app).post("/api/logs").set(auth()).send({ type: "walk", value: 100 });
      const otherAuth = { Authorization: `Bearer ${other.body.token}` };
      expect((await request(app).put(`/api/logs/${log.body.log.id}`).set(otherAuth).send({ value: 5 })).status).toBe(404);
      expect((await request(app).delete(`/api/logs/${log.body.log.id}`).set(otherAuth)).status).toBe(404);
    });
  });

  describe("database constraints", () => {
    it("rejects a far-future logged_at even when the API is bypassed", async () => {
      await expect(
        pool.query("INSERT INTO logs (user_id, type, value, logged_at) VALUES ($1, 'walk', 10, CURRENT_DATE + 30)", [userId])
      ).rejects.toMatchObject({ code: "23514" });
    });

    it("rejects a case-variant duplicate email at the index level", async () => {
      await expect(
        pool.query("INSERT INTO users (name, email, password_hash) VALUES ('x', 'AMA@EXAMPLE.COM', 'h')")
      ).rejects.toMatchObject({ code: "23505" });
    });
  });

  describe("GET /api/logs/summary/overview", () => {
    it("compares averages of per-day totals over exact 7-day windows", async () => {
      // This week = today and the 6 days before: day -1 totals 3000 (three entries), day -2 totals 1000 -> avg 2000.
      await seed("walk", 1000, 1);
      await seed("walk", 1000, 1);
      await seed("walk", 1000, 1);
      await seed("walk", 1000, 2);
      // Last week = days -7..-13: -7 (the first day of last week) totals 500 and -8 totals 1500 -> avg 1000.
      await seed("walk", 500, 7);
      await seed("walk", 1500, 8);
      // Outside both windows; must be ignored.
      await seed("walk", 99999, 14);

      const res = await request(app).get("/api/logs/summary/overview").set(auth());
      expect(res.status).toBe(200);
      expect(res.body.insight).toBe("Your steps is up 100% compared to last week.");
    });

    it("returns numeric values, string dates, a 7-day history and a streak past 90 days", async () => {
      for (let i = 0; i < 100; i++) await seed("water", 250, i);
      const res = await request(app).get("/api/logs/summary/overview").set(auth());
      expect(res.status).toBe(200);
      expect(res.body.streak).toBe(100);
      expect(res.body.as_of).toBe(await daysAgo(0));
      expect(res.body.today.water).toBe(250);
      expect(typeof res.body.goals.sleep).toBe("number");
      expect(res.body.history).toHaveLength(7);
      res.body.history.forEach((h) => {
        expect(h.logged_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof h.total).toBe("number");
      });
    });

    it("says nothing like 'up 0%' when the weeks match", async () => {
      await seed("walk", 1000, 1);
      await seed("walk", 1000, 9);
      const res = await request(app).get("/api/logs/summary/overview").set(auth());
      expect(res.body.insight).not.toMatch(/0%/);
    });
  });
});
