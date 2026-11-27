-- CreateTable
CREATE TABLE "Label" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "previousSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLabel" (
    "projectId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectLabel_pkey" PRIMARY KEY ("projectId","labelId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Label_slug_key" ON "Label"("slug");

-- CreateIndex
CREATE INDEX "Label_order_idx" ON "Label"("order");

-- CreateIndex
CREATE INDEX "ProjectLabel_labelId_idx" ON "ProjectLabel"("labelId");

-- CreateIndex
CREATE INDEX "ProjectLabel_projectId_order_idx" ON "ProjectLabel"("projectId", "order");

-- AddForeignKey
ALTER TABLE "ProjectLabel" ADD CONSTRAINT "ProjectLabel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLabel" ADD CONSTRAINT "ProjectLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: every Category becomes a Label (same id, slug and order), and each project's category becomes
-- its primary label. Category / Project.categoryId stay until this is verified (dropped in a follow-up).
INSERT INTO "Label" ("id", "name", "slug", "order", "updatedAt")
SELECT c."id", c."name", c."slug", c."order", CURRENT_TIMESTAMP
FROM "Category" c
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "ProjectLabel" ("projectId", "labelId", "order")
SELECT p."id", l."id", 0
FROM "Project" p
JOIN "Category" c ON c."id" = p."categoryId"
JOIN "Label" l ON l."slug" = c."slug"
ON CONFLICT DO NOTHING;
