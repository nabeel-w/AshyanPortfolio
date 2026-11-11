"use server";

import { z } from "zod";
import { invalidate } from "@/features/content/invalidate";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const clientRow = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(1, "Name is required").max(80),
  url: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
  logoId: z
    .string()
    .max(64)
    .nullish()
    .transform((v) => v || null),
  visible: z.boolean().default(true),
});

export type ClientRowInput = z.input<typeof clientRow>;

/**
 * Save the whole marquee in one go (order = array order). Rows missing from the list are deleted.
 * The public marquee uses these rows as soon as there is at least one visible client.
 */
export async function saveClients(rows: ClientRowInput[]) {
  await requireAdmin();
  const list = z.array(clientRow).max(200).parse(rows);
  const keep = list.map((r) => r.id).filter((x): x is string => Boolean(x));

  await db.$transaction(async (tx) => {
    await tx.client.deleteMany({ where: keep.length ? { id: { notIn: keep } } : {} });
    for (const [order, r] of list.entries()) {
      const data = { name: r.name, url: r.url, logoId: r.logoId, visible: r.visible, order };
      if (r.id) await tx.client.update({ where: { id: r.id }, data });
      else await tx.client.create({ data });
    }
  });
  invalidate.clients();
}
