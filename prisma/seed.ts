/**
 * Seeds site settings and the "home" page sections from the placeholder content.
 * Run: pnpm db:seed   (after `pnpm db:migrate`)
 *
 * The first admin account is NOT seeded. Create it with (email must be in ADMIN_EMAILS):
 *   pnpm admin:create <email> "<Full Name>"
 */
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { homeSections, site } from "../src/content/fallback";

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
    },
  });

  const page = await db.page.upsert({
    where: { slug: "home" },
    update: {},
    create: { slug: "home", title: "Home", status: "PUBLISHED", publishedAt: new Date() },
  });

  const existing = await db.section.count({ where: { pageId: page.id } });
  if (existing === 0) {
    await db.section.createMany({
      data: homeSections.map((s, order) => ({
        pageId: page.id,
        type: s.type,
        order,
        visible: s.visible,
        data: s.data,
        publishedData: s.data,
      })),
    });
  }

  console.log(`Seeded site settings and ${homeSections.length} home sections.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
