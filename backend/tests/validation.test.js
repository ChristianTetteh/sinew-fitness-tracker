const { validateValue, validateDailyTotal, validateLoggedAt, parseId, parseDays } = require("../lib/validation");

describe("validateValue", () => {
  it("accepts an in-range value for each metric", () => {
    expect(validateValue("walk", 4500)).toEqual({ numericValue: 4500 });
    expect(validateValue("water", 500)).toEqual({ numericValue: 500 });
    expect(validateValue("sleep", 7.5)).toEqual({ numericValue: 7.5 });
  });

  it("rejects a non-numeric value", () => {
    expect(validateValue("walk", "not-a-number")).toEqual({ error: "Value must be a number." });
  });

  it("only accepts real finite numbers (no booleans, numeric strings, NaN, Infinity)", () => {
    [true, "1e3", "500", null, undefined, NaN, Infinity, [5], {}].forEach((v) => {
      expect(validateValue("water", v)).toEqual({ error: "Value must be a number." });
    });
  });

  it("requires steps to be whole numbers but allows decimal water and sleep", () => {
    expect(validateValue("walk", 10.5).error).toMatch(/whole number/);
    expect(validateValue("water", 250.5)).toEqual({ numericValue: 250.5 });
    expect(validateValue("sleep", 7.25)).toEqual({ numericValue: 7.25 });
  });

  it("rejects sleep entries above 24 hours (the original 5,000-hour bug)", () => {
    expect(validateValue("sleep", 5000).error).toMatch(/24 hours/);
  });

  it("rejects zero and negative values", () => {
    expect(validateValue("water", 0).error).toBeTruthy();
    expect(validateValue("water", -5).error).toBeTruthy();
  });

  it("accepts the exact boundary values", () => {
    expect(validateValue("sleep", 0.25)).toEqual({ numericValue: 0.25 });
    expect(validateValue("sleep", 24)).toEqual({ numericValue: 24 });
  });

  it("rejects a value just past the boundary", () => {
    expect(validateValue("sleep", 24.01).error).toBeTruthy();
    expect(validateValue("walk", 50001).error).toBeTruthy();
  });
});

describe("validateDailyTotal", () => {
  it("caps walk at 50,000 steps cumulative per day, split across entries", () => {
    expect(validateDailyTotal("walk", 45000, 5000)).toEqual({});
    expect(validateDailyTotal("walk", 45000, 5001).error).toMatch(/50,000/);
  });

  it("caps water at 10,000ml cumulative per day, split across entries", () => {
    expect(validateDailyTotal("water", 8000, 2000)).toEqual({});
    expect(validateDailyTotal("water", 8000, 2001).error).toMatch(/10,000 ml/);
  });

  it("caps sleep at 24 hours cumulative per day, split across entries", () => {
    expect(validateDailyTotal("sleep", 16, 8)).toEqual({});
    expect(validateDailyTotal("sleep", 16, 8.01).error).toMatch(/24 hours/);
  });

  it("treats a missing/zero existing total as zero", () => {
    expect(validateDailyTotal("water", undefined, 5000)).toEqual({});
    expect(validateDailyTotal("water", 0, 10000)).toEqual({});
  });
});

describe("validateLoggedAt", () => {
  const TODAY = "2026-06-15";

  it("treats a missing date as 'use the database default'", () => {
    expect(validateLoggedAt(undefined, TODAY)).toEqual({ date: null });
    expect(validateLoggedAt(null, TODAY)).toEqual({ date: null });
  });

  it("accepts today, a past date, and a leap day", () => {
    expect(validateLoggedAt("2026-06-15", TODAY)).toEqual({ date: "2026-06-15" });
    expect(validateLoggedAt("2026-01-01", TODAY)).toEqual({ date: "2026-01-01" });
    expect(validateLoggedAt("2024-02-29", TODAY)).toEqual({ date: "2024-02-29" });
  });

  it("rejects malformed and non-calendar dates", () => {
    ["2026-6-5", "2026-02-30", "2025-02-29", "2026-04-31", "2026-00-10", "abc", "", "2026-06-15T00:00:00Z", 20260615, {}].forEach(
      (v) => expect(validateLoggedAt(v, TODAY).error).toMatch(/YYYY-MM-DD/)
    );
  });

  it("rejects future dates", () => {
    expect(validateLoggedAt("2026-06-16", TODAY).error).toMatch(/future/);
  });

  it("rejects dates more than 5 years old but allows exactly 5", () => {
    expect(validateLoggedAt("2021-06-15", TODAY)).toEqual({ date: "2021-06-15" });
    expect(validateLoggedAt("2021-06-14", TODAY).error).toMatch(/5 years/);
  });
});

describe("parseId", () => {
  it("accepts positive int32 ids", () => {
    expect(parseId("1")).toBe(1);
    expect(parseId("2147483647")).toBe(2147483647);
  });

  it("rejects everything else", () => {
    ["0", "-1", "1.5", "abc", "", "2147483648", "1e3", " 1", "00000000001x"].forEach((v) => expect(parseId(v)).toBeNull());
  });
});

describe("parseDays", () => {
  it("uses the default when absent", () => {
    expect(parseDays(undefined, 7)).toEqual({ days: 7 });
  });

  it("accepts integers 1-365", () => {
    expect(parseDays("1", 7)).toEqual({ days: 1 });
    expect(parseDays("365", 7)).toEqual({ days: 365 });
  });

  it("rejects garbage and out-of-range values", () => {
    ["0", "366", "-1", "1.5", "abc", "", "1e2", ["1", "2"]].forEach((v) => expect(parseDays(v, 7).error).toBeTruthy());
  });
});
