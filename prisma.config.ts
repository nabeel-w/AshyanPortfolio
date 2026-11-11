import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Same env files as Next.js: .env.local wins over .env.
config({ path: [".env.local", ".env"], quiet: true });

/**
 * Migrations need Neon's DIRECT (unpooled) connection: PgBouncer in transaction mode
 * breaks the advisory locks `prisma migrate` uses. If DIRECT_URL is missing or was
 * pasted with the pooler host, derive the direct host by dropping "-pooler".
 * The app at runtime uses the pooled DATABASE_URL via the Neon driver adapter (src/lib/db.ts).
 */
function directUrl() {
  const raw = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];
  return raw?.replace("-pooler.", ".");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: directUrl(),
  },
});
