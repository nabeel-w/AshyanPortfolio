import "server-only";
import { getSite } from "@/features/content/queries";
import { gmailSender, sendGmail } from "@/features/google/gmail";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/site-url";
import { type EmailSite, type Enquiry, enquiryConfirmation, enquiryNotification } from "./emails";

export type { Enquiry } from "./emails";

/**
 * Confirmations go to an address a stranger typed in, so they're capped: at most this many per
 * rolling 24 h across the whole site (Gmail's own limit is ~500/day). The per-address limit lives
 * in submitContact (3 per 10 minutes).
 */
export const CONFIRMATION_DAILY_CAP = 100;

async function emailSite(): Promise<EmailSite> {
  const site = await getSite();
  return {
    name: site.name,
    role: site.role,
    location: site.location,
    email: site.email,
    socials: site.socials.map((s) => ({ label: s.label, href: s.href })),
    url: SITE_URL,
  };
}

/**
 * After a contact-form submission (runs in `after()`): email us the branded notification and send
 * the visitor a branded confirmation, both from the linked Gmail mailbox. Best effort: the enquiry
 * is already saved in Admin → Inbox, so failures are only logged and the two sends are independent.
 */
export async function notifyEnquiry(e: Enquiry) {
  try {
    const sender = await gmailSender();
    if (!sender) {
      console.info("[contact] Gmail not connected; enquiry saved to the inbox only.");
      return;
    }
    const site = await emailSite();

    const toUs = enquiryNotification(e, site);
    const toThem = enquiryConfirmation(e, site);
    const recent = await db.contactSubmission.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });

    const results = await Promise.allSettled([
      // To ourselves: From shows the visitor's name, Reply-To answers them.
      sendGmail(
        sender.id,
        { ...toUs, to: sender.email, fromName: `${e.name} via ${site.name}` },
        sender.email,
      ),
      recent <= CONFIRMATION_DAILY_CAP
        ? sendGmail(
            sender.id,
            // Replies go to the public contact address when one is set, else to the mailbox itself.
            {
              ...toThem,
              to: e.email,
              fromName: site.name,
              replyTo: toThem.replyTo ?? sender.email,
            },
            sender.email,
          )
        : Promise.reject(new Error(`daily confirmation cap (${CONFIRMATION_DAILY_CAP}) reached`)),
    ]);
    const [us, them] = results;
    if (us.status === "rejected") console.error("[contact] notification email failed:", us.reason);
    if (them.status === "rejected")
      console.warn("[contact] confirmation email not sent:", them.reason);
  } catch (err) {
    console.error("[contact] enquiry emails failed:", err);
  }
}
