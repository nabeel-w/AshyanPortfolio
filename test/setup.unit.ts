import { vi } from "vitest";

// Minimal, valid env so modules that validate env at import (src/lib/env.ts) can load.
// Individual tests override with vi.stubEnv.
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-1234";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";

// next/cache APIs only work inside a Next render; in unit tests they're inert spies.
vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
}));
