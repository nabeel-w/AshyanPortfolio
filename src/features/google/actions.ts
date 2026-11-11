"use server";

import { z } from "zod";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/session";
import {
  disconnectGoogle,
  googleAccessToken,
  googleAccountFor,
  googleConfigured,
  listGoogleAccounts,
  pickerConfigured,
} from "./accounts";
import { enquiryConfirmation, enquiryNotification } from "@/features/contact/emails";
import { getSite } from "@/features/content/queries";
import { SITE_URL } from "@/lib/site-url";
import { sendGmail } from "./gmail";
import type { GoogleStatus } from "./scopes";

/** Admin entry points for the linked Google account (Drive imports, Gmail notifications). */

export async function googleStatusAction(): Promise<GoogleStatus> {
  const session = await requireAdmin();
  return {
    configured: googleConfigured(),
    pickerConfigured: pickerConfigured(),
    accounts: googleConfigured() ? await listGoogleAccounts(session.user.id) : [],
  };
}

/** Everything the Google Picker needs: a short-lived access token (drive.file) + the public key and app id. */
export async function drivePickerAction() {
  const session = await requireAdmin();
  if (!pickerConfigured())
    throw new Error("Google Drive isn't configured (see docs/03, Import sources).");
  const account = await googleAccountFor("drive", session.user.id);
  if (!account) throw new Error("Connect Google Drive first.");
  return {
    accessToken: await googleAccessToken(account.id),
    apiKey: env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY!,
    appId: env.NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER!,
  };
}

export async function disconnectGoogleAction(accountId: string) {
  const session = await requireAdmin();
  await disconnectGoogle(z.string().min(1).max(100).parse(accountId), session.user.id);
}

/**
 * Proves the Gmail connection end to end and previews both branded templates: the "new enquiry"
 * notification and the visitor confirmation, filled with sample data, sent to the mailbox itself.
 */
export async function sendTestEmailAction(): Promise<{ to: string }> {
  const session = await requireAdmin();
  const account = await googleAccountFor("gmail", session.user.id);
  if (!account?.email) throw new Error("Connect Gmail first.");
  const site = await getSite();
  const emailSite = { ...site, url: SITE_URL };
  const sample = {
    name: "Priya Shah",
    email: account.email,
    company: "Northlight Films",
    projectType: "Commercial",
    message:
      "Hi Ashyan, we are cutting a 60s spot for a spring launch and love the pacing in your reel. Shoot wraps on the 20th; could you take the offline edit?\n\nThis is a test enquiry from Admin → Settings.",
    source: "/contact",
  };
  const toUs = enquiryNotification(sample, emailSite);
  const toThem = enquiryConfirmation(sample, emailSite);
  await sendGmail(
    account.id,
    {
      ...toUs,
      subject: `[Test] ${toUs.subject}`,
      to: account.email,
      fromName: `${sample.name} via ${site.name}`,
    },
    account.email,
  );
  await sendGmail(
    account.id,
    { ...toThem, subject: `[Test] ${toThem.subject}`, to: account.email, fromName: site.name },
    account.email,
  );
  return { to: account.email };
}
