-- Sinew fitness tracker schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  daily_water_goal_ml INTEGER NOT NULL DEFAULT 2000,
  daily_steps_goal INTEGER NOT NULL DEFAULT 8000,
  daily_sleep_goal_hours NUMERIC(4,1) NOT NULL DEFAULT 8.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per logged entry. type is one of: 'walk', 'water', 'sleep'
-- The unit is implied by type and never stored: steps for walk, ml for water, hours for sleep.
CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('walk', 'water', 'sleep')),
  value NUMERIC NOT NULL CHECK (value > 0),
  logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_user_date ON logs (user_id, logged_at);

-- Safety nets behind the API's own validation. Both are idempotent and safe on existing data.

-- Emails are stored lower-cased by the API; this makes the database enforce it too.
-- Skipped (with a notice) if legacy rows already collide case-insensitively.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users GROUP BY lower(email) HAVING count(*) > 1) THEN
    RAISE NOTICE 'Skipping idx_users_email_lower: duplicate emails differing only by case exist';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
  END IF;
END $$;

-- No future-dated entries (one day of slack for timezones). NOT VALID so existing rows
-- are not scanned or rejected; it applies to every new insert and update.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logs_logged_at_not_future') THEN
    ALTER TABLE logs ADD CONSTRAINT logs_logged_at_not_future
      CHECK (logged_at <= CURRENT_DATE + 1) NOT VALID;
  END IF;
END $$;
