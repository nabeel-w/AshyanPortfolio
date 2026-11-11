import { describe, expect, it, vi } from "vitest";

/**
 * Google is a linked service (Drive, Gmail), never a way into the admin. These run requests through
 * the real Better Auth router with Google configured.
 */

vi.mock("@/lib/db", () => ({ db: {} }));
process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "test-secret";

const { auth } = await import("./auth");

const post = (path: string, body: object) =>
  auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify(body),
    }),
  );

describe("Google is link-only", () => {
  it("social sign-in routes don't exist", async () => {
    expect(
      (await post("/sign-in/social", { provider: "google", callbackURL: "/admin" })).status,
    ).toBe(404);
    expect(
      (await post("/sign-in/social", { provider: "google", idToken: { token: "x" } })).status,
    ).toBe(404);
  });

  it("linking needs a signed-in session", async () => {
    expect(
      (await post("/link-social", { provider: "google", callbackURL: "/connected" })).status,
    ).toBe(401);
  });

  it("the provider refuses sign-ups and id-token sign-in, and asks for a refresh token", () => {
    const google = auth.options.socialProviders?.google;
    expect(google).toMatchObject({
      disableSignUp: true,
      disableIdTokenSignIn: true,
      accessType: "offline",
      prompt: "consent",
    });
    expect(auth.options.account?.encryptOAuthTokens).toBe(true);
    expect(auth.options.account?.accountLinking?.disableImplicitLinking).toBe(true);
  });
});
