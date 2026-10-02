process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

jest.mock("../db", () => ({ query: jest.fn(), connect: jest.fn() }));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const app = require("../server");

const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);

beforeEach(() => {
  pool.query.mockReset();
});

describe("error handling", () => {
  it("returns 400 JSON for malformed JSON bodies", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Malformed JSON/);
  });

  it("returns 413 JSON for oversized bodies", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "a".repeat(200 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body.error).toBeTruthy();
  });

  it("returns a generic 500 JSON with no stack when something unexpected throws", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    pool.query.mockRejectedValueOnce(new Error("db exploded: secret detail")); // auth middleware lookup
    const res = await request(app).get("/api/logs").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Something went wrong" });
    expect(JSON.stringify(res.body)).not.toMatch(/secret detail|stack/);
    console.error.mockRestore();
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body.error).toBeTruthy();
  });
});

describe("startup and CORS", () => {
  const loadServer = () => {
    let loaded;
    jest.isolateModules(() => {
      jest.doMock("dotenv", () => ({ config: jest.fn() })); // a local .env must not mask the missing secret
      loaded = require("../server");
    });
    return loaded;
  };

  it("refuses to start without JWT_SECRET outside of tests", () => {
    const { JWT_SECRET, NODE_ENV } = process.env;
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = "production";
    try {
      expect(loadServer).toThrow(/JWT_SECRET/);
    } finally {
      process.env.JWT_SECRET = JWT_SECRET;
      process.env.NODE_ENV = NODE_ENV;
    }
  });

  it("strips a trailing slash from CORS_ORIGIN", async () => {
    process.env.CORS_ORIGIN = "https://app.example.com/";
    try {
      const res = await request(loadServer()).get("/api/health").set("Origin", "https://app.example.com");
      expect(res.headers["access-control-allow-origin"]).toBe("https://app.example.com");
    } finally {
      delete process.env.CORS_ORIGIN;
    }
  });
});
