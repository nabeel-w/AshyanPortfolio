import "server-only";
import { randomBytes } from "node:crypto";
import { expectOk } from "@/features/media/util";
import { googleAccessToken, googleAccountFor } from "./accounts";

/**
 * Send mail through the linked Gmail account (scope gmail.send): enquiry notifications to ourselves
 * and confirmations to visitors. No mail provider, no SMTP password: messages go out from the real
 * mailbox and land in its Sent folder.
 */

export type MailMessage = {
  to: string;
  subject: string;
  /** Plain-text version (always sent; what text-only clients and previews show) */
  text: string;
  /** Optional HTML version (sent as multipart/alternative with the text) */
  html?: string;
  replyTo?: string;
  /** Display name for From. The address is always the connected mailbox (Gmail requires it). */
  fromName?: string;
};

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

/** Header values must never carry a line break (header injection). */
function headerValue(v: string): string {
  return v.replace(/[\r\n]+/g, " ").trim();
}

/** RFC 2047 encoded-word when the value isn't plain ASCII. */
function encodeWord(v: string): string {
  return /^[\x20-\x7e]*$/.test(v) && !/["\\]/.test(v)
    ? v
    : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

function address(v: string, what: string): string {
  const a = headerValue(v);
  if (!EMAIL.test(a)) throw new Error(`Invalid ${what} address`);
  return a;
}

/** Base64 body wrapped at 76 columns, CRLF line endings. */
function base64Body(content: string): string {
  return Buffer.from(content.replace(/\r?\n/g, "\r\n"), "utf8")
    .toString("base64")
    .replace(/.{76}/g, "$&\r\n");
}

/**
 * An RFC 5322 message, UTF-8 + base64. Text only → a single text/plain body; with `html` →
 * multipart/alternative (text first, HTML preferred by clients that render it).
 */
export function buildMime(
  { to, subject, text, html, replyTo, fromName }: MailMessage,
  fromEmail?: string,
): string {
  const headers = [
    ...(fromName && fromEmail
      ? [`From: ${encodeWord(headerValue(fromName))} <${address(fromEmail, "sender")}>`]
      : []),
    `To: ${address(to, "recipient")}`,
    ...(replyTo ? [`Reply-To: ${address(replyTo, "reply-to")}`] : []),
    `Subject: ${encodeWord(headerValue(subject))}`,
    "MIME-Version: 1.0",
  ];
  if (!html) {
    return [
      ...headers,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      base64Body(text),
    ].join("\r\n");
  }
  const boundary = `az-${randomBytes(12).toString("hex")}`;
  const part = (type: string, content: string) =>
    [
      `--${boundary}`,
      `Content-Type: ${type}; charset="UTF-8"`,
      "Content-Transfer-Encoding: base64",
      "",
      base64Body(content),
    ].join("\r\n");
  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    part("text/plain", text),
    part("text/html", html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** Send from a specific linked account (`fromEmail` = that account's address, for the From header). */
export async function sendGmail(accountId: string, message: MailMessage, fromEmail?: string) {
  const token = await googleAccessToken(accountId);
  const raw = Buffer.from(buildMime(message, fromEmail), "utf8").toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  await expectOk(res, "Gmail send");
  return (await res.json()) as { id: string };
}

/** The connected mailbox (any admin's), or null when nobody has connected Gmail. */
export async function gmailSender() {
  const account = await googleAccountFor("gmail");
  return account?.email ? { id: account.id, email: account.email } : null;
}

/**
 * Email the connected mailbox itself. Returns false (and does nothing) when no admin has
 * connected Gmail yet; the enquiry is still in Admin → Inbox either way.
 */
export async function notifySelf(message: Omit<MailMessage, "to">): Promise<boolean> {
  const sender = await gmailSender();
  if (!sender) return false;
  await sendGmail(sender.id, { ...message, to: sender.email }, sender.email);
  return true;
}
