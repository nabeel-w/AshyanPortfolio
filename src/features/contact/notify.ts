import "server-only";
import { notifySelf } from "@/features/google/gmail";

export type Enquiry = {
  name: string;
  email: string;
  company?: string;
  projectType?: string;
  message: string;
  source?: string | null;
};

/** The "new enquiry" email. Reply-To is the visitor, so hitting Reply in Gmail answers them directly. */
export function enquiryEmail(e: Enquiry, siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "") {
  const lines = [
    `${e.name} <${e.email}>`,
    e.company ? `Company: ${e.company}` : null,
    e.projectType ? `Project: ${e.projectType}` : null,
    e.source ? `Sent from: ${e.source}` : null,
    "",
    e.message,
    "",
    "—",
    `Reply to this email to answer ${e.name.split(" ")[0]}, or open the inbox: ${siteUrl.replace(/\/$/, "")}/admin/inbox`,
  ];
  return {
    subject: `New enquiry · ${e.name}${e.company ? ` (${e.company})` : ""}`,
    text: lines.filter((l) => l !== null).join("\n"),
    replyTo: e.email,
  };
}

/** Best effort: the enquiry is already saved in the inbox, so a mail failure is only logged. */
export async function notifyEnquiry(e: Enquiry) {
  try {
    const sent = await notifySelf(enquiryEmail(e));
    if (!sent) console.info("[contact] Gmail not connected; enquiry saved to the inbox only.");
  } catch (err) {
    console.error("[contact] enquiry notification failed:", err);
  }
}
