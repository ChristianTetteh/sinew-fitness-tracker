require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== "test") {
  throw new Error("JWT_SECRET is not set. Refusing to start without a signing secret.");
}

const authRoutes = require("./routes/auth");
const logRoutes = require("./routes/logs");

const app = express();

// Render (and most PaaS) sit behind a reverse proxy; trust it so req.ip / rate
// limiting see the real client IP instead of the proxy's.
app.set("trust proxy", 1);

// crossOriginResourcePolicy is disabled because this is a pure JSON API meant
// to be called cross-origin from the frontend's own domain.
app.use(helmet({ crossOriginResourcePolicy: false }));
// Browsers send Origin without a trailing slash, so tolerate "https://app.example.com/".
const corsOrigin = (process.env.CORS_ORIGIN || "*").trim().replace(/\/+$/, "") || "*";
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/logs", logRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found." }));

// Last-resort error handler: always JSON, never a stack trace.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON in request body." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

// Only bind a real port when run directly (`node server.js` / `npm start`).
// Tests import `app` via require("../server") and drive it with supertest
// instead, so no port is ever opened during the test run.
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Sinew API running on port ${PORT}`));
}

module.exports = app;
