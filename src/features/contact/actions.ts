"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { recordServerEvent } from "@/features/analytics/ingest";
import { db } from "@/lib/db";

export type ContactState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<"name" | "email" | "message", string>> };

const schema = z.object({
  name: z.string().trim().min(2, "Please tell me your name").max(120),
  email: z.email("That email doesn't look right").max(200),
  company: z.string().trim().max(120).optional(),
  projectType: z.string().trim().max(60).optional(),
  message: z.string().trim().min(10, "A few more words about the project, please").max(5000),
});

const RATE_LIMIT = { max: 3, windowMs: 10 * 60 * 1000 };

/** Public enquiry form. Validated, honeypot-protected and rate-limited per email address. */
export async function submitContact(_prev: ContactState, form: FormData): Promise<ContactState> {
  // Honeypot: real people never see or fill this field.
  if (String(form.get("website") ?? "").length > 0) return { status: "success" };

  const parsed = schema.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    company: form.get("company") || undefined,
    projectType: form.get("projectType") || undefined,
    message: form.get("message"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Please check the highlighted fields.", fieldErrors };
  }

  const { name, email, company, projectType, message } = parsed.data;
  const recent = await db.contactSubmission.count({
    where: { email, createdAt: { gte: new Date(Date.now() - RATE_LIMIT.windowMs) } },
  });
  if (recent >= RATE_LIMIT.max) {
    return { status: "error", message: "You've sent a few messages already — I'll be in touch soon." };
  }

  const h = await headers();
  const referer = h.get("referer");
  const path = referer ? new URL(referer).pathname : null;
  await db.contactSubmission.create({
    data: {
      name,
      email,
      company,
      budget: projectType, // stored in `budget` until a dedicated column is needed
      message,
      source: path,
    },
  });
  await recordServerEvent({ type: "CONTACT_SUBMIT", path: path ?? "/contact" }, h);
  // TODO(#13): email notification once a mail provider is chosen.
  return { status: "success" };
}
