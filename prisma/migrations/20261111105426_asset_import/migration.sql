-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "Asset" ALTER COLUMN "bytes" SET DATA TYPE BIGINT;

-- CreateTable
CREATE TABLE "AssetImport" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "bytesTotal" BIGINT NOT NULL,
    "bytesDone" BIGINT NOT NULL DEFAULT 0,
    "state" JSONB NOT NULL DEFAULT '{}',
    "status" "ImportStatus" NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetImport_assetId_key" ON "AssetImport"("assetId");

-- CreateIndex
CREATE INDEX "AssetImport_status_leaseUntil_idx" ON "AssetImport"("status", "leaseUntil");

-- AddForeignKey
ALTER TABLE "AssetImport" ADD CONSTRAINT "AssetImport_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
