import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createElement, type ImgHTMLAttributes } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { mockMatchMedia } from "./dom-utils";

// Same minimal env as unit tests, for components that (indirectly) import server modules.
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-1234";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";

// Server Actions are tested in the unit project; components get an inert stub.
vi.mock("@/features/contact/actions", () => ({ submitContact: vi.fn(async () => ({ status: "idle" })) }));

afterEach(() => cleanup());
beforeEach(() => mockMatchMedia((q) => q.includes("pointer: fine")));

// next/image needs the Next runtime; render a plain <img> with the same src/alt and record
// Next-only props as data attributes so tests can assert on them.
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    preload,
    fill,
    quality,
    fetchPriority,
    ...rest
  }: ImgHTMLAttributes<HTMLImageElement> & {
    src: string;
    preload?: boolean;
    fill?: boolean;
    quality?: number;
  }) =>
    createElement("img", {
      src,
      alt,
      "data-preload": preload ? "true" : undefined,
      "data-fill": fill ? "true" : undefined,
      "data-quality": quality,
      "data-fetchpriority": fetchPriority,
      className: rest.className,
      sizes: rest.sizes,
      loading: rest.loading,
    }),
}));

// Default: fine pointer (mouse), motion allowed. Tests override with mockMatchMedia.
mockMatchMedia((q) => q.includes("pointer: fine"));
