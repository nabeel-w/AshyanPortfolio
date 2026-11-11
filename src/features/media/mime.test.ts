import { describe, expect, it } from "vitest";
import { ACCEPTED_MIME, kindFromMime, mimeTypesForAccept } from "./mime";

describe("mimeTypesForAccept (Google Picker filter)", () => {
  it("expands wildcards into the exact accepted types", () => {
    expect(mimeTypesForAccept("video/*")).toEqual([...ACCEPTED_MIME.VIDEO]);
    expect(mimeTypesForAccept("image/*, application/pdf")).toEqual([
      ...ACCEPTED_MIME.IMAGE,
      "application/pdf",
    ]);
    expect(mimeTypesForAccept("image/*,video/*,application/pdf")).not.toContain("audio/mpeg");
  });

  it("ignores types the server would reject anyway", () => {
    expect(mimeTypesForAccept("application/zip,text/*")).toEqual([]);
  });

  it("matches the server's kind rules", () => {
    for (const type of mimeTypesForAccept("image/*,video/*,audio/*,application/pdf"))
      expect(kindFromMime(type)).not.toBeNull();
  });
});
