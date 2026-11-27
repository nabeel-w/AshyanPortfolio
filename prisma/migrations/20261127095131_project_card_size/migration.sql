-- CreateEnum
CREATE TYPE "CardSize" AS ENUM ('AUTO', 'FEATURE', 'WIDE', 'TALL', 'SQUARE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "cardSize" "CardSize" NOT NULL DEFAULT 'AUTO';
