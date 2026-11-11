import "server-only";
import { z } from "zod";

/**
 * Server env, validated once at boot. Import `env` instead of reading process.env directly.
 * Storage provider keys are optional until a provider is chosen (docs/03-asset-storage.md).
 */
// Empty string = unset (the .env.example ships blank values). Keep the list in sync with media/providers.
const mediaProvider = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.enum(["local", "s3", "vercel-blob", "mux", "cloudflare-stream"]).optional(),
);

const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Database (Neon)
  DATABASE_URL: z.url(),
  DIRECT_URL: z.url().optional(),

  // Auth (Better Auth)
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),

  // Public site
  NEXT_PUBLIC_SITE_URL: z.url(),

  // Analytics
  ANALYTICS_SALT: z.string().min(16).optional(),
  /** Bearer token Vercel Cron sends to /api/cron/* (the route is closed while unset). */
  CRON_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),

  // Asset storage. Provider-specific vars are checked by each adapter (pnpm media:check),
  // so only the selectors are validated here. See src/features/media/providers.
  MEDIA_IMAGE_PROVIDER: mediaProvider,
  MEDIA_VIDEO_PROVIDER: mediaProvider,
  MEDIA_FILE_PROVIDER: mediaProvider,

  // Google (optional): link-only OAuth for Drive imports and Gmail notifications. docs/03 "Import sources".
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  /** Browser key restricted to the Picker API (public by design). */
  NEXT_PUBLIC_GOOGLE_PICKER_API_KEY: optional,
  /** Cloud project number, the Picker's setAppId (needed for drive.file). */
  NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER: optional,
});

export const env = schema.parse(process.env);
