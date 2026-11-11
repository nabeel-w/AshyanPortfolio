/**
 * Seeds site settings and the home / work / about / contact pages from the placeholder content.
 * Run: pnpm db:seed   (after `pnpm db:migrate`)
 *
 * The first admin account is NOT seeded. Create it with (email must be in ADMIN_EMAILS):
 *   pnpm admin:create <email> "<Full Name>"
 */
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { pageSections, site } from "../src/content/fallback";

config({ path: [".env.local", ".env"], quiet: true });

const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  await db.siteSettings.upsert({
    where: { id: "site" },
    update: {},
    create: {
      id: "site",
      name: site.name,
      role: site.role,
      location: site.location,
      email: site.email,
      bio: site.description,
      socials: site.socials,
      whatsapp: site.whatsapp,
      whatsappMessage: site.whatsappMessage,
    },
  });

  // Backfill settings added after the first seed (never overwrites admin edits).
  const settings = await db.siteSettings.findUniqueOrThrow({ where: { id: "site" } });
  if (settings.whatsapp == null && site.whatsapp) {
    await db.siteSettings.update({
      where: { id: "site" },
      data: { whatsapp: site.whatsapp, whatsappMessage: site.whatsappMessage },
    });
  }

  // Pages: create any that are missing, with their placeholder sections already published.
  let created = 0;
  for (const [slug, sections] of Object.entries(pageSections)) {
    const page = await db.page.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title: slug === "home" ? "Home" : slug[0]!.toUpperCase() + slug.slice(1),
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    if ((await db.section.count({ where: { pageId: page.id } })) > 0) continue;
    await db.section.createMany({
      data: sections.map((s, order) => ({
        pageId: page.id,
        type: s.type,
        order,
        visible: s.visible,
        publishedOrder: order,
        publishedVisible: s.visible,
        data: s.data,
        publishedData: s.data,
      })),
    });
    created += sections.length;
  }

  console.log(`Seeded site settings; created ${created} sections across ${Object.keys(pageSections).length} pages.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
