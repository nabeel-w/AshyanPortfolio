-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "share" JSONB;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "share" JSONB;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "share" JSONB;
