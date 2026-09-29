// Sane real-world bounds per metric, enforced both here (API) and in the frontend UI.
const LIMITS = {
  walk: { min: 1, max: 100000, label: "Steps must be between 1 and 100,000." },
  water: { min: 1, max: 10000, label: "Water must be between 1 and 10,000 ml." },
  sleep: { min: 0.25, max: 24, label: "Sleep must be between 0.25 and 24 hours." },
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

module.exports = { validateValue, LIMITS };
