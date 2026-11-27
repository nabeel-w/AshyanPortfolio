-- CreateEnum
CREATE TYPE "VideoOrientation" AS ENUM ('LANDSCAPE', 'PORTRAIT', 'SQUARE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "filmAspect" DOUBLE PRECISION,
ADD COLUMN     "filmDuration" DOUBLE PRECISION,
ADD COLUMN     "filmOrientation" "VideoOrientation" NOT NULL DEFAULT 'LANDSCAPE',
ADD COLUMN     "filmUrl" TEXT,
ADD COLUMN     "filmYoutubeId" TEXT;

-- CreateIndex
CREATE INDEX "Project_filmYoutubeId_idx" ON "Project"("filmYoutubeId");

-- Backfill: projects with a (Mux) film keep its shape and runtime, so nothing changes visually
-- when playback moves to YouTube (#24). The YouTube URL itself is set per project afterwards.
UPDATE "Project" p
SET "filmAspect" = (a."meta"->>'aspectRatio')::double precision,
    "filmOrientation" = CASE
      WHEN (a."meta"->>'aspectRatio')::double precision < 0.9 THEN 'PORTRAIT'::"VideoOrientation"
      WHEN (a."meta"->>'aspectRatio')::double precision <= 1.1 THEN 'SQUARE'::"VideoOrientation"
      ELSE 'LANDSCAPE'::"VideoOrientation"
    END
FROM "Asset" a
WHERE p."filmId" = a."id" AND a."meta"->>'aspectRatio' IS NOT NULL;

UPDATE "Project" p
SET "filmDuration" = a."duration"
FROM "Asset" a
WHERE p."filmId" = a."id" AND a."duration" IS NOT NULL;
