import "server-only";
import { z } from "zod";

/**
 * Server env, validated once at boot. Import `env` instead of reading process.env directly.
 * Storage provider keys are optional until a provider is chosen (docs/03-asset-storage.md).
 */
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
    .transform((v) => v.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)),

  // Public site
  NEXT_PUBLIC_SITE_URL: z.url(),

  // Analytics
  ANALYTICS_SALT: z.string().min(16).optional(),

  // Asset storage — fill whichever provider is chosen
  MUX_TOKEN_ID: z.string().optional(),
  MUX_TOKEN_SECRET: z.string().optional(),
  MUX_WEBHOOK_SECRET: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.url().optional(),
});

export const env = schema.parse(process.env);
