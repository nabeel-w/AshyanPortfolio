import { describe, expect, it } from "vitest";
import { cleanProbe } from "./probe";

describe("cleanProbe", () => {
  it("keeps sane values", () => {
    expect(cleanProbe({ width: 1080, height: 1920, duration: 4.21234 })).toEqual({ width: 1080, height: 1920, duration: 4.212 });
  });

  it("drops dimensions unless both are valid, and out-of-range durations", () => {
    expect(cleanProbe({ width: 1080, height: 0, duration: 4 })).toEqual({ duration: 4 });
    expect(cleanProbe({ width: 8000, height: 4000 })).toEqual({});
    expect(cleanProbe({ width: 10.5, height: 20 })).toEqual({});
    expect(cleanProbe({ width: 1920, height: 1080, duration: 601 })).toEqual({ width: 1920, height: 1080 });
    expect(cleanProbe({ width: "1920", height: "1080", duration: Number.NaN })).toEqual({});
  });

  it("tolerates junk", () => {
    expect(cleanProbe(undefined)).toEqual({});
    expect(cleanProbe("nope")).toEqual({});
    expect(cleanProbe(null)).toEqual({});
  });
});
