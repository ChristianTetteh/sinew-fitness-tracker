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

function validateValue(type, value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return { error: "Value must be a number." };
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
  if (!dailyLimit) return {}; // no cumulative cap for this type (e.g. walk)
  const projectedTotal = (existingTotal || 0) + numericValue;
  if (projectedTotal > dailyLimit.max) {
    return { error: dailyLimit.label };
  }
  return {};
}

module.exports = { validateValue, validateDailyTotal, LIMITS, DAILY_LIMITS };
