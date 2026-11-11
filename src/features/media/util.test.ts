import { describe, expect, it, vi } from "vitest";
import {
  freshTimestamp,
  hmac,
  kindFromMime,
  makeKey,
  maxBytes,
  parseSigHeader,
  safeEqualHex,
} from "./util";

describe("kindFromMime", () => {
  it.each([
    ["image/jpeg", "IMAGE"],
    ["image/webp", "IMAGE"],
    ["image/svg+xml", "IMAGE"],
    ["video/mp4", "VIDEO"],
    ["video/quicktime", "VIDEO"],
    ["audio/mpeg", "AUDIO"],
    ["application/pdf", "DOCUMENT"],
  ])("%s → %s", (mime, kind) => {
    expect(kindFromMime(mime)).toBe(kind);
  });

  it.each(["application/x-msdownload", "text/html", "image/tiff", "", "video/mp4; evil"])(
    "rejects %j",
    (mime) => {
      expect(kindFromMime(mime)).toBeNull();
    },
  );
});

describe("maxBytes", () => {
  it("uses sensible defaults per kind", () => {
    expect(maxBytes("IMAGE")).toBe(50 * 1024 * 1024);
    expect(maxBytes("VIDEO")).toBe(10_000 * 1024 * 1024);
  });

  it("can be overridden per kind via env", () => {
    vi.stubEnv("MEDIA_MAX_IMAGE_MB", "5");
    expect(maxBytes("IMAGE")).toBe(5 * 1024 * 1024);
  });
});

describe("makeKey", () => {
  const now = new Date("2026-03-07T10:00:00Z");

  it("builds kind/yyyy/mm/slug-random.ext", () => {
    expect(makeKey("IMAGE", "Hero Still.WEBP", now)).toMatch(
      /^image\/2026\/03\/hero-still-[0-9a-f]{8}\.webp$/,
    );
  });

  it("strips accents and unsafe characters", () => {
    expect(makeKey("VIDEO", "Résonance — Final (v2)!.mov", now)).toMatch(
      /^video\/2026\/03\/resonance-final-v2-[0-9a-f]{8}\.mov$/,
    );
  });

  it("never produces path traversal segments", () => {
    const key = makeKey("DOCUMENT", "../../etc/passwd.pdf", now);
    expect(key).not.toContain("..");
    expect(key.split("/")).toHaveLength(4);
  });

  it("falls back for names without an extension or usable characters", () => {
    expect(makeKey("AUDIO", "???", now)).toMatch(/^audio\/2026\/03\/file-[0-9a-f]{8}\.bin$/);
  });

  it("is unique for the same filename", () => {
    expect(makeKey("IMAGE", "a.png", now)).not.toBe(makeKey("IMAGE", "a.png", now));
  });
});

describe("signature helpers", () => {
  it("parses provider signature headers", () => {
    expect(parseSigHeader("t=123,v1=abc")).toEqual({ t: "123", v1: "abc" });
    expect(parseSigHeader("time=9, sig1=ff")).toEqual({ time: "9", sig1: "ff" });
    expect(parseSigHeader(null)).toEqual({});
    expect(parseSigHeader("garbage")).toEqual({});
  });

  it("compares hex digests in constant time and rejects mismatches", () => {
    const a = hmac("secret", "payload");
    expect(safeEqualHex(a, a)).toBe(true);
    expect(safeEqualHex(a, hmac("other", "payload"))).toBe(false);
    expect(safeEqualHex(a, a.slice(0, 10))).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });

  it("accepts timestamps inside the replay window only", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(freshTimestamp(String(now))).toBe(true);
    expect(freshTimestamp(String(now - 299))).toBe(true);
    expect(freshTimestamp(String(now - 600))).toBe(false);
    expect(freshTimestamp(undefined)).toBe(false);
    expect(freshTimestamp("abc")).toBe(false);
  });
});
