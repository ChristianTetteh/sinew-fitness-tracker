process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

jest.mock("../db", () => ({ query: jest.fn() }));

const request = require("supertest");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const app = require("../server");

beforeEach(() => {
  pool.query.mockReset();
});

describe("POST /api/auth/signup", () => {
  it("creates an account and returns a token", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // no existing user with that email
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: "Ama",
            email: "ama@example.com",
            daily_water_goal_ml: 2000,
            daily_steps_goal: 8000,
            daily_sleep_goal_hours: 8,
          },
        ],
      });

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Ama", email: "ama@example.com", password: "supersecret" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe("ama@example.com");
  });

  it("rejects a password shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Ama", email: "ama@example.com", password: "short" });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email with 409", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Ama", email: "ama@example.com", password: "supersecret" });
    expect(res.status).toBe(409);
  });

  it("rejects a missing field", async () => {
    const res = await request(app).post("/api/auth/signup").send({ email: "ama@example.com" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("rejects an email that doesn't exist", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever1" });
    expect(res.status).toBe(401);
  });

  it("rejects an incorrect password", async () => {
    const hash = await bcrypt.hash("correct-password", 10);
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: "Ama", email: "ama@example.com", password_hash: hash }],
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ama@example.com", password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("logs in and returns a token with correct credentials", async () => {
    const hash = await bcrypt.hash("correct-password", 10);
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          name: "Ama",
          email: "ama@example.com",
          password_hash: hash,
          daily_water_goal_ml: 2000,
          daily_steps_goal: 8000,
          daily_sleep_goal_hours: 8,
        },
      ],
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ama@example.com", password: "correct-password" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.password_hash).toBeUndefined();
  });
});

describe("GET /api/auth/me", () => {
  it("rejects requests with no token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a malformed token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/auth/goals", () => {
  const jwt = require("jsonwebtoken");
  const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);

  it("rejects a step goal outside the allowed range", async () => {
    const res = await request(app)
      .patch("/api/auth/goals")
      .set("Authorization", `Bearer ${token}`)
      .send({ daily_steps_goal: 999999, daily_water_goal_ml: 2000, daily_sleep_goal_hours: 8 });
    expect(res.status).toBe(400);
  });

  it("accepts valid goals", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, daily_steps_goal: 10000, daily_water_goal_ml: 2500, daily_sleep_goal_hours: 7 }],
    });
    const res = await request(app)
      .patch("/api/auth/goals")
      .set("Authorization", `Bearer ${token}`)
      .send({ daily_steps_goal: 10000, daily_water_goal_ml: 2500, daily_sleep_goal_hours: 7 });
    expect(res.status).toBe(200);
    expect(res.body.user.daily_steps_goal).toBe(10000);
  });
});
