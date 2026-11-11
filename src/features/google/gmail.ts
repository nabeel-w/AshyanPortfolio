import "server-only";
import { expectOk } from "@/features/media/util";
import { googleAccessToken, googleAccountFor } from "./accounts";

/**
 * Send mail through the linked Gmail account (scope gmail.send), e.g. "new enquiry" notifications
 * to ourselves. No mail provider, no SMTP password: the message goes out from the real mailbox,
 * lands in its Sent folder, and replies go straight to the visitor (Reply-To).
 */

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

/** Header values must never carry a line break (header injection). */
function headerValue(v: string): string {
  return v.replace(/[\r\n]+/g, " ").trim();
}

/** RFC 2047 encoded-word when the value isn't plain ASCII. */
function encodeWord(v: string): string {
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

function address(v: string, what: string): string {
  const a = headerValue(v);
  if (!EMAIL.test(a)) throw new Error(`Invalid ${what} address`);
  return a;
}

/** An RFC 5322 message (text/plain, UTF-8, base64 body). Gmail fills in From with the mailbox. */
export function buildMime({ to, subject, text, replyTo }: MailMessage): string {
  const body = Buffer.from(text.replace(/\r?\n/g, "\r\n"), "utf8")
    .toString("base64")
    .replace(/.{76}/g, "$&\r\n");
  return [
    `To: ${address(to, "recipient")}`,
    ...(replyTo ? [`Reply-To: ${address(replyTo, "reply-to")}`] : []),
    `Subject: ${encodeWord(headerValue(subject))}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");
}

/** Send from a specific linked account. */
export async function sendGmail(accountId: string, message: MailMessage) {
  const token = await googleAccessToken(accountId);
  const raw = Buffer.from(buildMime(message), "utf8").toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  await expectOk(res, "Gmail send");
  return (await res.json()) as { id: string };
}

/**
 * Email the connected mailbox itself. Returns false (and does nothing) when no admin has
 * connected Gmail yet; the enquiry is still in Admin → Inbox either way.
 */
export async function notifySelf(message: Omit<MailMessage, "to">): Promise<boolean> {
  const account = await googleAccountFor("gmail");
  if (!account?.email) return false;
  await sendGmail(account.id, { ...message, to: account.email });
  return true;
}
