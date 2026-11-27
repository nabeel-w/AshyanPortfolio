import { describe, expect, it, vi } from "vitest";
import { MediaConfigError } from "../types";
import { getProvider, providerFor, providerIdFor, providers } from ".";

describe("provider registry", () => {
  it("has unique ids and declares setup help for each provider", () => {
    const ids = providers.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of providers) {
      expect(p.setup.length).toBeGreaterThan(10);
      expect(p.kinds.length).toBeGreaterThan(0);
    }
  });

  it("throws a helpful error for unknown ids", () => {
    expect(() => getProvider("dropbox")).toThrow(
      /Unknown media provider "dropbox". Known: local, vercel-blob/,
    );
  });
});

describe("providerIdFor (routing)", () => {
  it("falls back to local in development when nothing is configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(providerIdFor("VIDEO")).toBe("local");
    expect(providerIdFor("IMAGE")).toBe("local");
  });

  it("treats empty strings (from .env.example) as unset", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MEDIA_VIDEO_PROVIDER", "");
    vi.stubEnv("MEDIA_IMAGE_PROVIDER", "");
    expect(providerIdFor("VIDEO")).toBe("local");
  });

  it("routes each kind to its configured provider", () => {
    vi.stubEnv("MEDIA_VIDEO_PROVIDER", "local");
    vi.stubEnv("MEDIA_IMAGE_PROVIDER", "vercel-blob");
    expect(providerIdFor("VIDEO")).toBe("local");
    expect(providerIdFor("IMAGE")).toBe("vercel-blob");
    // files default to the image provider
    expect(providerIdFor("DOCUMENT")).toBe("vercel-blob");
    expect(providerIdFor("AUDIO")).toBe("vercel-blob");
  });

  it("lets files use their own provider", () => {
    vi.stubEnv("MEDIA_IMAGE_PROVIDER", "local");
    vi.stubEnv("MEDIA_FILE_PROVIDER", "vercel-blob");
    expect(providerIdFor("DOCUMENT")).toBe("vercel-blob");
  });

  it("video falls back to the image provider when not set", () => {
    vi.stubEnv("MEDIA_IMAGE_PROVIDER", "vercel-blob");
    expect(providerIdFor("VIDEO")).toBe("vercel-blob");
  });

  it("refuses to guess in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => providerIdFor("IMAGE")).toThrow(MediaConfigError);
    expect(() => providerIdFor("IMAGE")).toThrow(/MEDIA_IMAGE_PROVIDER/);
  });
});

describe("providerFor (validation)", () => {
  it("lists exactly which env vars are missing", () => {
    vi.stubEnv("MEDIA_IMAGE_PROVIDER", "vercel-blob");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    expect(() => providerFor("IMAGE")).toThrow(/missing env: BLOB_READ_WRITE_TOKEN./);
  });

  it("returns the provider when fully configured, for every kind (Blob holds images and loops)", () => {
    vi.stubEnv("MEDIA_IMAGE_PROVIDER", "vercel-blob");
    vi.stubEnv("MEDIA_VIDEO_PROVIDER", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_x");
    expect(providerFor("IMAGE").id).toBe("vercel-blob");
    expect(providerFor("VIDEO").id).toBe("vercel-blob");
  });
});
