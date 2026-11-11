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
      /Unknown media provider "dropbox". Known: local, s3/,
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
    vi.stubEnv("MEDIA_VIDEO_PROVIDER", "mux");
    vi.stubEnv("MEDIA_IMAGE_PROVIDER", "s3");
    expect(providerIdFor("VIDEO")).toBe("mux");
    expect(providerIdFor("IMAGE")).toBe("s3");
    // files default to the image provider
    expect(providerIdFor("DOCUMENT")).toBe("s3");
    expect(providerIdFor("AUDIO")).toBe("s3");
  });

  it("lets files use their own provider", () => {
    vi.stubEnv("MEDIA_IMAGE_PROVIDER", "s3");
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
  it("rejects a provider that can't hold the kind", () => {
    vi.stubEnv("MEDIA_IMAGE_PROVIDER", "mux");
    expect(() => providerFor("IMAGE")).toThrow(/"mux" can't store IMAGE files/);
  });

  it("lists exactly which env vars are missing", () => {
    vi.stubEnv("MEDIA_VIDEO_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "id");
    vi.stubEnv("MUX_TOKEN_SECRET", "");
    expect(() => providerFor("VIDEO")).toThrow(/missing env: MUX_TOKEN_SECRET\./);
  });

  it("returns the provider when fully configured", () => {
    vi.stubEnv("MEDIA_VIDEO_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "id");
    vi.stubEnv("MUX_TOKEN_SECRET", "secret");
    expect(providerFor("VIDEO").id).toBe("mux");
  });
});
