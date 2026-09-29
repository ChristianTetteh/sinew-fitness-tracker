require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/auth");
const logRoutes = require("./routes/logs");

const app = express();

// Render (and most PaaS) sit behind a reverse proxy; trust it so req.ip / rate
// limiting see the real client IP instead of the proxy's.
app.set("trust proxy", 1);

// crossOriginResourcePolicy is disabled because this is a pure JSON API meant
// to be called cross-origin from the frontend's own domain.
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/logs", logRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found." }));

// Only bind a real port when run directly (`node server.js` / `npm start`).
// Tests import `app` via require("../server") and drive it with supertest
// instead, so no port is ever opened during the test run.
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Sinew API running on port ${PORT}`));
}

module.exports = app;
