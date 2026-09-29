const { validateValue } = require("../lib/validation");

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
    expect(validateValue("walk", 100001).error).toBeTruthy();
  });
});
