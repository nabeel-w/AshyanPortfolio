import { describe, expect, it } from "vitest";
import { countryName, num, pct, signedPct } from "./format";
import { delta, eachDay, resolveRange } from "./range";

const today = new Date("2026-11-11T15:00:00Z");

describe("resolveRange", () => {
  it("defaults to 30 days ending today, with the previous 30 for deltas", () => {
    expect(resolveRange({}, today)).toEqual({
      preset: "30d",
      from: "2026-10-13",
      to: "2026-11-11",
      days: 30,
      previous: { from: "2026-09-13", to: "2026-10-12" },
    });
  });

  it("supports presets and ignores unknown ones", () => {
    expect(resolveRange({ range: "7d" }, today)).toMatchObject({ from: "2026-11-05", to: "2026-11-11", days: 7, previous: { from: "2026-10-29", to: "2026-11-04" } });
    expect(resolveRange({ range: "90d" }, today).days).toBe(90);
    expect(resolveRange({ range: "999d" }, today).preset).toBe("30d");
  });

  it("clamps custom ranges to today, orders them and caps them at a year", () => {
    expect(resolveRange({ range: "custom", from: "2026-11-01", to: "2027-01-01" }, today)).toMatchObject({ preset: "custom", from: "2026-11-01", to: "2026-11-11", days: 11 });
    expect(resolveRange({ range: "custom", from: "2026-11-10", to: "2026-11-02" }, today)).toMatchObject({ from: "2026-11-02", to: "2026-11-02", days: 1 });
    expect(resolveRange({ range: "custom", from: "2020-01-01" }, today).days).toBe(366);
    expect(resolveRange({ range: "custom", from: "garbage" }, today).preset).toBe("30d");
  });

  it("lists days and computes deltas", () => {
    expect(eachDay("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(delta(150, 100)).toBe(0.5);
    expect(delta(5, 0)).toBeNull();
    expect(delta(0, 0)).toBe(0);
  });
});

describe("format", () => {
  it("formats numbers and percentages", () => {
    expect(num(1284)).toBe("1,284");
    expect(num(12_900)).toBe("12.9K");
    expect(pct(0.1234)).toBe("12%");
    expect(pct(0.0123)).toBe("1.2%");
    expect(pct(null)).toBe("—");
    expect(signedPct(0.25)).toBe("+25%");
    expect(signedPct(-0.1)).toBe("−10%");
    expect(signedPct(null)).toBe("new");
    expect(countryName("AE")).toBe("United Arab Emirates");
    expect(countryName("unknown")).toBe("Unknown");
  });
});
