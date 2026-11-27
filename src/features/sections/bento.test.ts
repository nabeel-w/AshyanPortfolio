import { describe, expect, it } from "vitest";
import { tileFor, tilesFor } from "./bento";

describe("tileFor (#29)", () => {
  const free = { featureTaken: false };

  it("follows the admin's card size first", () => {
    expect(tileFor({ orientation: "portrait", cardSize: "wide" }, free)).toBe("wide");
    expect(tileFor({ orientation: "landscape", cardSize: "square" }, free)).toBe("square");
    expect(tileFor({ cardSize: "feature" }, { featureTaken: true })).toBe("feature");
  });

  it("then the film's orientation: portrait → tall, square → square", () => {
    expect(tileFor({ orientation: "portrait", featured: true }, free)).toBe("tall");
    expect(tileFor({ orientation: "square" }, free)).toBe("square");
  });

  it("makes the first featured landscape film the feature, every other landscape film wide", () => {
    expect(tileFor({ orientation: "landscape", featured: true }, free)).toBe("feature");
    expect(tileFor({ orientation: "landscape", featured: true }, { featureTaken: true })).toBe("wide");
    expect(tileFor({ orientation: "landscape" }, free)).toBe("wide");
    expect(tileFor({}, free)).toBe("wide");
  });
});

describe("tilesFor", () => {
  it("has at most one automatic feature, skipping reels on the way", () => {
    expect(
      tilesFor([
        { orientation: "portrait", featured: true },
        { orientation: "landscape", featured: true },
        { orientation: "landscape", featured: true },
        { orientation: "square" },
        { orientation: "landscape", cardSize: "feature" },
      ]),
    ).toEqual(["tall", "feature", "wide", "square", "feature"]);
  });
});
