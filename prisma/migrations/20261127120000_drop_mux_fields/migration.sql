-- v2 (#27, #28): drop the Mux film link, playback ids, the legacy Category and dead fields.
-- Apply AFTER this release is live in production (pnpm db:deploy): the previous release still reads
-- these columns. Hover loops already moved to Blob (pnpm media:loops-to-blob) and every project has a
-- YouTube film (filmUrl), so nothing user-visible depends on them. Category rows were copied to Label.

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_filmId_fkey";

-- AlterTable
ALTER TABLE "Asset" DROP COLUMN "playbackId";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "categoryId",
DROP COLUMN "filmId";

-- AlterTable
ALTER TABLE "Page" DROP COLUMN "ogImageUrl";

-- AlterTable
ALTER TABLE "SiteSettings" DROP COLUMN "tagline";

-- DropTable
DROP TABLE "Category";

