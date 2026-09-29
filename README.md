# Sinew — track. understand. improve.

A full-stack fitness tracker built for the Full Stack Developer intern task ("Fitness
Tracking Web App"), then taken well past the minimum brief: **React + Node/Express +
PostgreSQL**, deployed, tested, and hardened.

**Live demo:** https://sinew-frontend.onrender.com
**API:** https://sinew-backend.onrender.com

## What's included

**Core requirements**
- **Auth** — email/password sign-up and login, JWT sessions, bcrypt password hashing
- **3 data types** — walk (steps), water (ml), sleep (hours)
- **Dashboard with weekly charts** — a 7-day bar chart per metric, switchable by tab

**Beyond the brief**
- **Custom goals** — a dedicated Goals page; step/water/sleep targets are per-user, not hardcoded
- **SINEW Score** — a 0–100 same-day goal-completion score (explicitly labeled as *not* a
  health measure — it's a progress metric, not a diagnosis)
- **Streaks** — consecutive days logged, with a flame counter
- **Insights** — a plain-language callout comparing this week's average to last week's
  (e.g. "Your steps are up 18% compared to last week"), computed server-side from real data
- **Real validation** — sane bounds per metric (e.g. sleep 0.25–24 hrs), enforced on both
  the client and the API, so bad data (like a 5,000-hour sleep entry) can't get in
- **Edit, not just delete** — fix a mis-typed entry in place
- **Human-readable dates** — "Today" / "Yesterday" / "Friday, Sep 25" instead of raw ISO
  timestamps, with entries grouped by day
- **Light + dark mode** — toggle in the sidebar, persisted per browser
- **Responsive mobile nav** — the sidebar becomes a hamburger-triggered slide-in drawer
  below 760px, with horizontally-scrollable stat/score cards instead of a cramped stack
- **On-brand loading state** — an animated dumbbell bicep-curl (SVG/SMIL, no images) instead
  of a spinner
- **Automated tests** — 36 Jest + Supertest tests covering validation, the score/streak/
  insight logic, and the auth/logs routes (see [Testing](#testing))
- **Security hardening** — Helmet security headers, rate limiting on auth endpoints, and
  ownership checks on every log mutation (a user can only edit/delete their own entries)

```
sinew/
  backend/     Express API + PostgreSQL (Node)
  frontend/    React app (Vite)
```

## 1. Set up the database

Create a Postgres database (locally, or a free instance on Render/Supabase/Railway/Neon),
then apply the schema:

```bash
cd backend
cp .env.example .env
# edit .env: set DATABASE_URL and a random JWT_SECRET
npm install
npm run migrate   # creates the users and logs tables (safe to re-run; idempotent)
```

## 2. Run the backend

```bash
cd backend
npm run dev        # http://localhost:4000
```

## 3. Run the frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_URL, defaults to http://localhost:4000/api
npm install
npm run dev         # http://localhost:5173
```

Vite's dev server proxies `/api` to `http://localhost:4000` automatically, so the two
`.env` files only really matter once you deploy.

## Testing

```bash
cd backend
npm test
```

36 tests across 4 suites, all running against mocked dependencies (no live database or
network calls needed):

- **`lib/scoring.js`** — pure functions for the SINEW Score, streak, and insight logic,
  unit tested directly (goal-completion math, streak edge cases like same-day/yesterday/
  gapped dates, insight direction and magnitude)
- **`lib/validation.js`** — per-type value bounds, including the exact 5,000-hour-sleep bug
  this validation was built to prevent
- **`routes/auth.js`** and **`routes/logs.js`** — integration tests via Supertest against
  the real Express app, with the Postgres layer (`db.js`) mocked out, covering auth flows,
  goal updates, and log CRUD including ownership checks

## API overview

| Method | Route | Description |
|--------|-------|-------------|
| POST   | `/api/auth/signup` | Create account, returns JWT |
| POST   | `/api/auth/login` | Log in, returns JWT |
| GET    | `/api/auth/me` | Current user (`Authorization: Bearer <token>`) |
| PATCH  | `/api/auth/goals` | Update daily step/water/sleep goals |
| POST   | `/api/logs` | Create an entry `{ type, value, logged_at? }`, validated per type |
| GET    | `/api/logs?type=&days=` | List recent entries |
| PUT    | `/api/logs/:id` | Edit an entry's value |
| DELETE | `/api/logs/:id` | Delete an entry |
| GET    | `/api/logs/summary/overview?days=7` | Today's totals, goals, chart history, SINEW Score, streak, and insight — one call powers the whole dashboard |

Signup/login are rate-limited (20 requests / 15 min / IP) to blunt brute-force attempts.

## Deployment

Both halves are deployed on Render:

**Database:** Render Postgres (free tier).

**Backend (Render Web Service):**
1. New → Web Service → point at the repo, build/start commands `cd backend && npm install` / `cd backend && npm start`
2. Environment variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `PGSSL`
3. `npm start` runs `node migrate.js && node server.js`, so the schema is applied on every boot (idempotent — safe to leave permanently)

**Frontend (Render Static Site):**
1. New → Static Site → root build command `cd frontend && npm install && npm run build`, publish path `frontend/dist`
2. Environment variable: `VITE_API_URL` = `https://<your-backend>.onrender.com/api`

(Vercel works too if you'd rather split them — the frontend is a standard Vite/React static build with no server-side requirements.)

## Notes for extending it

- `logs.logged_at` defaults to today but accepts a specific date, so a "log yesterday's
  workout" feature is just a date picker away.
- The overview endpoint's insight logic (this-week vs last-week average) is a good spot to
  extend with more comparisons — best day, longest streak, etc.
- Repo is two independent npm projects (no shared root `package.json`) so each half can be
  deployed and scaled separately.
- Natural next hardening steps: move the JWT out of `localStorage` into an httpOnly cookie
  to reduce XSS exposure, and add a CI workflow that runs `npm test` on every push.
