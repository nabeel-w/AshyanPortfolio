-- AlterTable
ALTER TABLE "AnalyticsDaily" ADD COLUMN     "progress25" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "progress50" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "progress75" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sessions" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AnalyticsDailyDim" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "dim" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AnalyticsDailyDim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsDailyDim_day_dim_idx" ON "AnalyticsDailyDim"("day", "dim");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsDailyDim_day_dim_key_key" ON "AnalyticsDailyDim"("day", "dim", "key");
