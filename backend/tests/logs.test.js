process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

jest.mock("../db", () => ({ query: jest.fn(), connect: jest.fn() }));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const app = require("../server");

const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);
const auth = { Authorization: `Bearer ${token}` };
const today = new Date().toISOString().slice(0, 10);

// Transactional routes run on a pooled client. Transaction plumbing (BEGIN, the advisory
// lock, COMMIT, ROLLBACK) is answered automatically; `results` are the route's own
// queries, in order.
let client;
function mockTransaction(...results) {
  const queue = [...results];
  client.query.mockImplementation(async (sql) =>
    /^(BEGIN|COMMIT|ROLLBACK)|pg_advisory_xact_lock/.test(sql) ? { rows: [] } : queue.shift()
  );
}
function txSql() {
  return client.query.mock.calls.map((c) => c[0]);
}

beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockReset();
  client = { query: jest.fn(), release: jest.fn() };
  pool.connect.mockResolvedValue(client);
  // Every authenticated request first looks the user up (auth middleware).
  pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
});

describe("auth middleware", () => {
  it("returns 401 for a valid token whose user no longer exists", async () => {
    pool.query.mockReset();
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get("/api/logs").set(auth);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/logs", () => {
  it("rejects requests with no auth token", async () => {
    const res = await request(app).post("/api/logs").send({ type: "walk", value: 4500 });
    expect(res.status).toBe(401);
  });

  it("rejects an unknown entry type", async () => {
    const res = await request(app).post("/api/logs").set(auth).send({ type: "run", value: 10 });
    expect(res.status).toBe(400);
  });

  it("rejects an out-of-range sleep value", async () => {
    const res = await request(app).post("/api/logs").set(auth).send({ type: "sleep", value: 5000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/24 hours/);
  });

  it.each([
    ["boolean", true],
    ["numeric string", "1e3"],
    ["null", null],
    ["array", [5]],
  ])("rejects a non-number value (%s)", async (_label, value) => {
    const res = await request(app).post("/api/logs").set(auth).send({ type: "water", value });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be a number/);
  });

  it("rejects fractional steps", async () => {
    const res = await request(app).post("/api/logs").set(auth).send({ type: "walk", value: 100.5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/whole number/);
  });

  it("accepts a valid entry inside a locked transaction", async () => {
    mockTransaction(
      { rows: [{ total: 0 }] }, // existing daily total (cumulative cap check)
      { rows: [{ id: 1, type: "walk", value: 4500, logged_at: "2026-01-01" }] } // INSERT
    );
    const res = await request(app).post("/api/logs").set(auth).send({ type: "walk", value: 4500 });
    expect(res.status).toBe(201);
    expect(res.body.log.value).toBe(4500);
    expect(res.body.log.logged_at).toBe("2026-01-01");
    const sql = txSql();
    expect(sql[0]).toBe("BEGIN");
    expect(sql[1]).toMatch(/pg_advisory_xact_lock/);
    expect(client.query.mock.calls[1][1]).toEqual([1]);
    expect(sql[sql.length - 1]).toBe("COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("rejects an entry that would push today's water total over the daily cap", async () => {
    // Already logged 9,000ml today; logging 2,000ml more would hit 11,000ml (> 10,000 cap).
    mockTransaction({ rows: [{ total: 9000 }] });
    const res = await request(app).post("/api/logs").set(auth).send({ type: "water", value: 2000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/10,000 ml/);
    expect(txSql().some((q) => /INSERT/.test(q))).toBe(false);
  });

  it("rejects an entry that would push today's walk total over the daily cap", async () => {
    mockTransaction({ rows: [{ total: 45000 }] });
    const res = await request(app).post("/api/logs").set(auth).send({ type: "walk", value: 10000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/50,000/);
  });

  it("rolls back and releases the client when a query fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    client.query.mockImplementation(async (sql) => {
      if (/SUM/.test(sql)) throw new Error("boom");
      return { rows: [] };
    });
    const res = await request(app).post("/api/logs").set(auth).send({ type: "walk", value: 100 });
    expect(res.status).toBe(500);
    expect(txSql()).toContain("ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
    console.error.mockRestore();
  });

  describe("logged_at", () => {
    const post = (logged_at) => request(app).post("/api/logs").set(auth).send({ type: "walk", value: 100, logged_at });

    it.each([
      ["not a string", 20260101],
      ["wrong format", "01/02/2026"],
      ["timestamp", "2026-01-01T00:00:00Z"],
      ["impossible date", "2026-02-30"],
      ["month 13", "2026-13-01"],
      ["too far in the past", "2000-01-01"],
    ])("rejects %s", async (_label, value) => {
      const res = await post(value);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/logged_at/);
    });

    it("rejects a future date", async () => {
      const res = await post("2999-01-01");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/future/);
    });

    it("accepts today and passes the date through", async () => {
      mockTransaction({ rows: [{ total: 0 }] }, { rows: [{ id: 2, type: "walk", value: 100, logged_at: today }] });
      const res = await post(today);
      expect(res.status).toBe(201);
      expect(client.query.mock.calls.find((c) => /SUM/.test(c[0]))[1]).toEqual([1, "walk", today]);
    });
  });
});

describe("GET /api/logs", () => {
  it("clamps days: rejects garbage and out-of-range values with 400", async () => {
    for (const days of ["abc", "0", "-5", "366", "1.5", "1e2", ""]) {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // the beforeEach lookup is consumed by the first request only
      const res = await request(app).get("/api/logs").query({ days }).set(auth);
      expect(res.status).toBe(400);
    }
  });

  it("rejects repeated days params", async () => {
    const res = await request(app).get("/api/logs?days=1&days=2").set(auth);
    expect(res.status).toBe(400);
  });

  it("accepts the boundary values and queries with an integer", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get("/api/logs?days=365").set(auth);
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[1][1]).toEqual([1, 365]);
  });

  it("defaults to 30 days", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await request(app).get("/api/logs").set(auth);
    expect(pool.query.mock.calls[1][1]).toEqual([1, 30]);
  });

  it("rejects an invalid type filter", async () => {
    const res = await request(app).get("/api/logs?type=run").set(auth);
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/logs/:id", () => {
  it("returns 404 for an entry that doesn't belong to the caller", async () => {
    mockTransaction({ rows: [] });
    const res = await request(app).put("/api/logs/99").set(auth).send({ value: 5000 });
    expect(res.status).toBe(404);
  });

  it.each(["abc", "0", "-1", "1.5", "2147483648", "99999999999999999999"])(
    "returns 400 (not 500) for id %s",
    async (id) => {
      const res = await request(app).put(`/api/logs/${id}`).set(auth).send({ value: 5 });
      expect(res.status).toBe(400);
      expect(pool.connect).not.toHaveBeenCalled();
    }
  );

  it("rejects an edit that violates the value bounds", async () => {
    mockTransaction({ rows: [{ type: "sleep", logged_at: "2026-01-01" }] });
    const res = await request(app).put("/api/logs/1").set(auth).send({ value: 30 });
    expect(res.status).toBe(400);
  });

  it("rejects an edit that would push today's total over the daily cap", async () => {
    // The day's *other* sleep entries already total 20 hours, so editing this one up
    // to 8 would make 28 (> 24 cap).
    mockTransaction({ rows: [{ type: "sleep", logged_at: "2026-01-01" }] }, { rows: [{ total: 20 }] });
    const res = await request(app).put("/api/logs/1").set(auth).send({ value: 8 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/24 hours/);
  });

  it("updates inside a locked transaction", async () => {
    mockTransaction(
      { rows: [{ type: "sleep", logged_at: "2026-01-01" }] },
      { rows: [{ total: 2 }] },
      { rows: [{ id: 1, type: "sleep", value: 7, logged_at: "2026-01-01" }] }
    );
    const res = await request(app).put("/api/logs/1").set(auth).send({ value: 7 });
    expect(res.status).toBe(200);
    expect(res.body.log.value).toBe(7);
    expect(txSql()[1]).toMatch(/pg_advisory_xact_lock/);
  });
});

describe("DELETE /api/logs/:id", () => {
  it("returns 404 when the entry isn't found", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete("/api/logs/99").set(auth);
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    const res = await request(app).delete("/api/logs/abc").set(auth);
    expect(res.status).toBe(400);
  });

  it("deletes successfully when the entry exists", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const res = await request(app).delete("/api/logs/1").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });
});

describe("GET /api/logs/summary/overview", () => {
  it("rejects a bad days param", async () => {
    const res = await request(app).get("/api/logs/summary/overview?days=abc").set(auth);
    expect(res.status).toBe(400);
  });

  it("returns dashboard data with string dates and computes streak/insight", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ daily_water_goal_ml: 2000, daily_steps_goal: 8000, daily_sleep_goal_hours: 8 }] })
      .mockResolvedValueOnce({ rows: [{ logged_at: today, type: "walk", total: 4000 }] })
      .mockResolvedValueOnce({ rows: [{ type: "walk", total: 4000 }] })
      .mockResolvedValueOnce({ rows: [{ logged_at: today }] })
      .mockResolvedValueOnce({ rows: [{ type: "walk", this_week: 6000, last_week: 4000 }] });
    const res = await request(app).get("/api/logs/summary/overview").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.streak).toBe(1);
    expect(res.body.score).toBe(17);
    expect(res.body.insight).toMatch(/steps is up 50%/);
    expect(res.body.history[0].logged_at).toBe(today);
  });

  it("no longer exposes the removed /summary/weekly route", async () => {
    const res = await request(app).get("/api/logs/summary/weekly").set(auth);
    expect(res.status).toBe(404);
  });
});
