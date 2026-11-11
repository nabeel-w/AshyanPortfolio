import { beforeEach, describe, expect, it, vi } from "vitest";

/** Linked Google account helpers, Gmail MIME + send, and the enquiry notification. */

const db = vi.hoisted(() => ({
  account: { findMany: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

const getAccessToken = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ auth: { api: { getAccessToken } } }));

const { GOOGLE_SCOPES, hasFeature, parseScopes } = await import("./scopes");
const { disconnectGoogle, emailFromIdToken, googleAccessToken, googleAccountFor } =
  await import("./accounts");
const { buildMime, notifySelf, sendGmail } = await import("./gmail");

const idToken = (claims: object) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
const both = `openid,email,profile,${GOOGLE_SCOPES.drive},${GOOGLE_SCOPES.gmail}`;

/** Decode a base64 MIME body back to text. */
const bodyOf = (mime: string) =>
  Buffer.from(mime.split("\r\n\r\n")[1]!.replace(/\r\n/g, ""), "base64").toString("utf8");

beforeEach(() => {
  db.account.findUnique.mockResolvedValue({ userId: "u1", providerId: "google" });
  getAccessToken.mockResolvedValue({ accessToken: "ya29.token" });
});

describe("scopes", () => {
  it("reads Better Auth's comma-joined and Google's space-joined scopes", () => {
    expect(parseScopes(`openid,${GOOGLE_SCOPES.drive}`)).toEqual(["openid", GOOGLE_SCOPES.drive]);
    expect(parseScopes(`openid ${GOOGLE_SCOPES.gmail}`)).toEqual(["openid", GOOGLE_SCOPES.gmail]);
    expect(hasFeature(both, "gmail")).toBe(true);
    expect(hasFeature("openid,email", "drive")).toBe(false);
    // A longer scope that merely contains the drive scope must not count
    expect(hasFeature(`${GOOGLE_SCOPES.drive}.readonly`, "drive")).toBe(false);
    expect(hasFeature(null, "drive")).toBe(false);
  });
});

describe("linked accounts", () => {
  it("reads the account email from the stored id token", () => {
    expect(emailFromIdToken(idToken({ email: "ashyan@gmail.com" }))).toBe("ashyan@gmail.com");
    expect(emailFromIdToken("not-a-jwt")).toBeNull();
    expect(emailFromIdToken(null)).toBeNull();
  });

  it("picks the newest account that actually granted the feature", async () => {
    db.account.findMany.mockResolvedValue([
      {
        id: "a-drive-only",
        userId: "u1",
        scope: `openid,${GOOGLE_SCOPES.drive}.readonly`,
        idToken: null,
      },
      { id: "a-gmail", userId: "u1", scope: both, idToken: idToken({ email: "studio@gmail.com" }) },
    ]);
    await expect(googleAccountFor("gmail")).resolves.toEqual({
      id: "a-gmail",
      userId: "u1",
      email: "studio@gmail.com",
      drive: true,
      gmail: true,
    });
    // Without a user (public contact form) only ADMIN users' accounts are considered
    expect(db.account.findMany.mock.calls[0]![0].where).toMatchObject({
      providerId: "google",
      user: { role: "ADMIN" },
    });

    await googleAccountFor("drive", "u1");
    expect(db.account.findMany.mock.calls[1]![0].where).toMatchObject({ userId: "u1" });
  });

  it("gets tokens through Better Auth with the owning user, and explains failures", async () => {
    await expect(googleAccessToken("acc1")).resolves.toBe("ya29.token");
    expect(getAccessToken).toHaveBeenCalledWith({ body: { accountId: "acc1", userId: "u1" } });

    getAccessToken.mockRejectedValueOnce(new Error("FAILED_TO_GET_ACCESS_TOKEN"));
    await expect(googleAccessToken("acc1")).rejects.toThrow(/Reconnect Google/);

    db.account.findUnique.mockResolvedValueOnce({ userId: "u1", providerId: "credential" });
    await expect(googleAccessToken("acc1")).rejects.toThrow(/no longer connected/);
  });

  it("disconnect revokes at Google and deletes only this user's Google link", async () => {
    const fetchMock = vi.fn(async () => new Response(null));
    vi.stubGlobal("fetch", fetchMock);
    await disconnectGoogle("acc1", "u1");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/revoke");
    expect(String(init.body)).toBe("token=ya29.token");
    expect(db.account.deleteMany).toHaveBeenCalledWith({
      where: { id: "acc1", userId: "u1", providerId: "google" },
    });
  });
});

describe("gmail", () => {
  it("builds a UTF-8 message with Reply-To and an encoded subject", () => {
    const mime = buildMime({
      to: "studio@gmail.com",
      replyTo: "client@brand.co",
      subject: "New enquiry · Zoë",
      text: "Hello\nthere",
    });
    const [head] = mime.split("\r\n\r\n");
    expect(head).toContain("To: studio@gmail.com");
    expect(head).toContain("Reply-To: client@brand.co");
    expect(head).toContain(
      `Subject: =?UTF-8?B?${Buffer.from("New enquiry · Zoë").toString("base64")}?=`,
    );
    expect(head).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(bodyOf(mime)).toBe("Hello\r\nthere");
  });

  it("can't be used for header injection", () => {
    const mime = buildMime({
      to: "studio@gmail.com",
      subject: "Hi\r\nBcc: victim@x.com",
      text: "x",
    });
    expect(mime.split("\r\n").filter((l) => l.startsWith("Bcc:"))).toEqual([]);
    expect(() =>
      buildMime({
        to: "studio@gmail.com",
        replyTo: "a@b.co\r\nBcc: v@x.com",
        subject: "s",
        text: "x",
      }),
    ).toThrow(/reply-to/);
    expect(() => buildMime({ to: "not an email", subject: "s", text: "x" })).toThrow(/recipient/);
  });

  it("sends the raw message through the Gmail API with the account's token", async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: "m1" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendGmail("acc1", { to: "studio@gmail.com", subject: "Test", text: "Body" }),
    ).resolves.toEqual({ id: "m1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer ya29.token");
    const raw = Buffer.from(JSON.parse(init.body as string).raw, "base64url").toString("utf8");
    expect(raw).toContain("To: studio@gmail.com");
    expect(bodyOf(raw)).toBe("Body");
  });

  it("notifySelf emails the connected mailbox, or does nothing when Gmail isn't connected", async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: "m1" }));
    vi.stubGlobal("fetch", fetchMock);
    db.account.findMany.mockResolvedValueOnce([]);
    await expect(notifySelf({ subject: "s", text: "t" })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    db.account.findMany.mockResolvedValueOnce([
      { id: "a", userId: "u1", scope: both, idToken: idToken({ email: "studio@gmail.com" }) },
    ]);
    await expect(notifySelf({ subject: "s", text: "t", replyTo: "c@brand.co" })).resolves.toBe(
      true,
    );
    const raw = Buffer.from(
      JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
        .raw,
      "base64url",
    ).toString();
    expect(raw).toContain("To: studio@gmail.com");
    expect(raw).toContain("Reply-To: c@brand.co");
  });
});
