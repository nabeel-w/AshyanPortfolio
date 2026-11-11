"use server";

import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { invalidate } from "@/features/content/invalidate";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

const settingsInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  role: z.string().trim().min(1, "Role is required").max(80),
  location: text(120),
  email: z.union([z.literal(""), z.email("Enter a valid email")]).transform((v) => v || null),
  whatsapp: text(30).refine((v) => !v || v.replace(/\D/g, "").length >= 8, "Include the country code, e.g. +91 …"),
  whatsappMessage: text(300),
  bio: text(600),
  socials: z
    .array(z.object({ label: z.string().trim().min(1, "Label required").max(40), href: z.url("Enter a full URL (https://…)") }))
    .max(20)
    .default([]),
});

export type SettingsInput = z.input<typeof settingsInput>;

export async function saveSettings(raw: SettingsInput) {
  await requireAdmin();
  const parsed = settingsInput.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[i.path.join(".")] ??= i.message;
    return { ok: false as const, errors };
  }
  const data = { ...parsed.data, socials: parsed.data.socials as Prisma.InputJsonValue };
  await db.siteSettings.upsert({ where: { id: "site" }, update: data, create: { id: "site", ...data } });
  invalidate.site();
  return { ok: true as const };
}

export async function setSubmissionRead(id: string, read: boolean) {
  await requireAdmin();
  await db.contactSubmission.update({ where: { id: z.string().min(1).parse(id) }, data: { read: z.boolean().parse(read) } });
}

export async function deleteSubmission(id: string) {
  await requireAdmin();
  await db.contactSubmission.delete({ where: { id: z.string().min(1).parse(id) } });
}
