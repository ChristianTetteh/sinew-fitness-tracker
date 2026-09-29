process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

jest.mock("../db", () => ({ query: jest.fn() }));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const app = require("../server");

const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);

beforeEach(() => {
  pool.query.mockReset();
});

describe("POST /api/logs", () => {
  it("rejects requests with no auth token", async () => {
    const res = await request(app).post("/api/logs").send({ type: "walk", value: 4500 });
    expect(res.status).toBe(401);
  });

  it("rejects an unknown entry type", async () => {
    const res = await request(app)
      .post("/api/logs")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "run", value: 10 });
    expect(res.status).toBe(400);
  });

  it("rejects an out-of-range sleep value", async () => {
    const res = await request(app)
      .post("/api/logs")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "sleep", value: 5000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/24 hours/);
  });

  it("accepts a valid entry", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, type: "walk", value: 4500, logged_at: "2026-01-01" }],
    });
    const res = await request(app)
      .post("/api/logs")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "walk", value: 4500 });
    expect(res.status).toBe(201);
    expect(res.body.log.value).toBe(4500);
  });
});

describe("PUT /api/logs/:id", () => {
  it("returns 404 for an entry that doesn't belong to the caller", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put("/api/logs/99")
      .set("Authorization", `Bearer ${token}`)
      .send({ value: 5000 });
    expect(res.status).toBe(404);
  });

  it("rejects an edit that violates the value bounds", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ type: "sleep" }] });
    const res = await request(app)
      .put("/api/logs/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ value: 30 });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/logs/:id", () => {
  it("returns 404 when the entry isn't found", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete("/api/logs/99").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("deletes successfully when the entry exists", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const res = await request(app).delete("/api/logs/1").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });
});
