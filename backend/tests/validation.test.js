const { validateValue, validateDailyTotal } = require("../lib/validation");

describe("validateValue", () => {
  it("accepts an in-range value for each metric", () => {
    expect(validateValue("walk", 4500)).toEqual({ numericValue: 4500 });
    expect(validateValue("water", 500)).toEqual({ numericValue: 500 });
    expect(validateValue("sleep", 7.5)).toEqual({ numericValue: 7.5 });
  });

  it("rejects a non-numeric value", () => {
    expect(validateValue("walk", "not-a-number")).toEqual({ error: "Value must be a number." });
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
