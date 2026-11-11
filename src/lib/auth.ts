import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const googleConfigured = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/**
 * Admin-only auth. Email + password, and sign-up is restricted to ADMIN_EMAILS,
 * so the public can never create an account even though the endpoint exists.
 *
 * Google is a *linked service*, never a way in: a signed-in admin links it (`linkSocial`) to grant
 * Drive / Gmail scopes (features/google). Social sign-in is switched off at the router
 * (`disabledPaths`), the provider refuses sign-ups, and tokens are encrypted at rest.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
  },
  socialProviders: googleConfigured
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
          // Offline + consent so Google always returns a refresh token (background imports, emails).
          accessType: "offline",
          prompt: "consent",
          disableSignUp: true,
          disableIdTokenSignIn: true,
        },
      }
    : {},
  // The only routes that could turn a Google identity into a session.
  disabledPaths: ["/sign-in/social", "/sign-in/oauth2"],
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      // Never link on sign-in; only an explicit linkSocial() from a live admin session.
      disableImplicitLinking: true,
      // The Drive/Gmail mailbox may differ from the admin login email. Safe here because a linked
      // Google account can't be used to sign in (see disabledPaths).
      allowDifferentEmails: true,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "EDITOR", input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = user.email.toLowerCase();
          if (!env.ADMIN_EMAILS.includes(email)) {
            throw new APIError("FORBIDDEN", { message: "Sign-up is invite only." });
          }
          return { data: { ...user, role: "ADMIN" } };
        },
      },
    },
  },
  // Must be last: lets server actions set auth cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
