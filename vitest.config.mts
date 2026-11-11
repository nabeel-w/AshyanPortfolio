import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Two projects:
 *   unit        — node env, *.test.ts  (lib, features, providers, queries)
 *   components  — jsdom env, *.test.tsx (React components, browser helpers)
 * Async Server Components aren't supported by Vitest; cover their data via the query tests
 * and their rendering via E2E later (Next.js testing guide).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true, // "@/…" imports, same as Next
    alias: {
      // `server-only` throws outside the react-server condition; it's a no-op marker in tests.
      "server-only": path.resolve(import.meta.dirname, "test/stubs/empty.ts"),
    },
  },
  test: {
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
          setupFiles: ["test/setup.unit.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["test/setup.dom.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/generated/**",
        "src/components/ui/**",
        "src/**/*.test.*",
        "src/app/**/layout.tsx",
      ],
      reporter: ["text-summary", "html"],
    },
  },
});
