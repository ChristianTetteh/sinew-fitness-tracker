// Sane real-world bounds per metric, enforced both here (API) and in the frontend UI.
const LIMITS = {
  walk: { min: 1, max: 50000, label: "Steps must be between 1 and 50,000." },
  water: { min: 1, max: 10000, label: "Water must be between 1 and 10,000 ml." },
  sleep: { min: 0.25, max: 24, label: "Sleep must be between 0.25 and 24 hours." },
};

// Daily *cumulative* bounds — the most a metric may total across all of a
// user's entries for a single day, regardless of how many separate entries
// that's split across.
const DAILY_LIMITS = {
  walk: { max: 50000, label: "That would put today's total steps over 50,000, which is above the daily cap." },
  water: { max: 10000, label: "That would put today's total water intake over 10,000 ml, which isn't a safe daily amount." },
  sleep: { max: 24, label: "That would put today's total sleep over 24 hours, which isn't possible in a single day." },
};

// Only real JSON numbers are accepted: no booleans, no numeric strings like "1e3".
function validateValue(type, value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return { error: "Value must be a number." };
  const numericValue = value;
  if (type === "walk" && !Number.isInteger(numericValue)) {
    return { error: "Steps must be a whole number." };
  }
  const limit = LIMITS[type];
  if (numericValue < limit.min || numericValue > limit.max) {
    return { error: limit.label };
  }
  return { numericValue };
}

// Checks a new/edited value against the running total already logged for
// that user/type/day. `existingTotal` is the sum of the *other* entries for
// that day (the caller is responsible for excluding the entry being edited).
function validateDailyTotal(type, existingTotal, numericValue) {
  const dailyLimit = DAILY_LIMITS[type];
  if (!dailyLimit) return {}; // unknown type: no cumulative cap defined
  const projectedTotal = (existingTotal || 0) + numericValue;
  if (projectedTotal > dailyLimit.max) {
    return { error: dailyLimit.label };
  }
  return {};
}

const MAX_PAST_YEARS = 5;

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

// Validates an optional "YYYY-MM-DD" logged_at: a real calendar date, not in the
// future, and not more than MAX_PAST_YEARS old. Returns { date } (null when omitted,
// so the DB default applies) or { error }. "Today" is UTC, matching the database.
function validateLoggedAt(value, today = utcToday()) {
  if (value === undefined || value === null) return { date: null };
  const invalid = { error: "logged_at must be a valid date in YYYY-MM-DD format." };
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return invalid;
  if (value > today) return { error: "logged_at can't be in the future." };
  const oldest = new Date(`${today}T00:00:00Z`);
  oldest.setUTCFullYear(oldest.getUTCFullYear() - MAX_PAST_YEARS);
  if (value < oldest.toISOString().slice(0, 10)) {
    return { error: `logged_at can't be more than ${MAX_PAST_YEARS} years ago.` };
  }
  return { date: value };
}

// Route :id must be a positive int32 (the users/logs id columns are SERIAL/INTEGER).
function parseId(raw) {
  if (typeof raw !== "string" || !/^\d{1,10}$/.test(raw)) return null;
  const id = Number(raw);
  return id >= 1 && id <= 2147483647 ? id : null;
}

// Optional ?days= query: an integer 1-365, defaulting to defaultDays when absent.
function parseDays(raw, defaultDays) {
  if (raw === undefined) return { days: defaultDays };
  if (typeof raw !== "string" || !/^\d{1,4}$/.test(raw)) return { error: "days must be an integer between 1 and 365." };
  const days = Number(raw);
  if (days < 1 || days > 365) return { error: "days must be an integer between 1 and 365." };
  return { days };
}

module.exports = { validateValue, validateDailyTotal, validateLoggedAt, parseId, parseDays, LIMITS, DAILY_LIMITS };
