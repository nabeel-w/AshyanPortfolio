import { describe, expect, it } from "vitest";
import { neighbours, relatedWork } from "./neighbours";

const item = (slug: string, ...labels: string[]) => ({ slug, labels: labels.map((l) => ({ slug: l })) });
const list = [
  item("a", "fashion", "reels"),
  item("b", "commercial"),
  item("c", "fashion"),
  item("d", "reels"),
  item("e", "documentary"),
];

describe("neighbours (prev / next in grid order)", () => {
  it("wraps around at both ends", () => {
    expect(neighbours(list, "a")).toEqual({ prev: list[4], next: list[1] });
    expect(neighbours(list, "e")).toEqual({ prev: list[3], next: list[0] });
  });

  it("shows a lone other film once, and nothing for one film or an unknown slug", () => {
    expect(neighbours(list.slice(0, 2), "a")).toEqual({ next: list[1] });
    expect(neighbours(list.slice(0, 1), "a")).toEqual({});
    expect(neighbours(list, "zzz")).toEqual({});
  });
});

describe("relatedWork ('More in <label>')", () => {
  it("prefers the primary label, then any shared label, then the rest; never itself", () => {
    expect(relatedWork(list, "a", ["fashion", "reels"]).map((p) => p.slug)).toEqual(["c", "d", "b"]);
  });

  it("fills from the latest films when nothing is shared, and caps at n", () => {
    expect(relatedWork(list, "e", ["documentary"]).map((p) => p.slug)).toEqual(["a", "b", "c"]);
    expect(relatedWork(list, "b", [], 2).map((p) => p.slug)).toEqual(["a", "c"]);
  });
});

describe("project layout and share card by orientation (#30)", () => {
  it("portrait and square films get the side-by-side layout and the split card; landscape / no film keep the hero", async () => {
    const { projectLayout, projectOgTemplate } = await import("./neighbours");
    expect(projectLayout({ film: { orientation: "portrait" } })).toBe("portrait");
    expect(projectLayout({ film: { orientation: "square" } })).toBe("portrait");
    expect(projectLayout({ film: { orientation: "landscape" } })).toBe("landscape");
    expect(projectLayout({})).toBe("landscape");
    expect(projectOgTemplate({ film: { orientation: "portrait" } })).toBe("portrait");
    expect(projectOgTemplate({})).toBe("still");
  });
});
