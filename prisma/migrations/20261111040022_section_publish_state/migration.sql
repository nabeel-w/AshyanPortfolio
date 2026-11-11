-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "publishedOrder" INTEGER,
ADD COLUMN     "publishedVisible" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Section_pageId_publishedVisible_publishedOrder_idx" ON "Section"("pageId", "publishedVisible", "publishedOrder");

-- Backfill: sections that were already published keep their current live position/visibility.
UPDATE "Section" SET "publishedOrder" = "order", "publishedVisible" = "visible" WHERE "publishedData" IS NOT NULL;
