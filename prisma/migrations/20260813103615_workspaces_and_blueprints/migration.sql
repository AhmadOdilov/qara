-- Workspaces, RBAC a'zoligi va AI blueprint qoralamalari (§56).
--
-- `telegram_bots.workspaceId` majburiy, lekin jadvalda allaqachon qatorlar bor.
-- Shuning uchun ustun avval NULL bilan qo'shiladi, mavjud botlar egasining
-- shaxsiy workspace'iga ko'chiriladi va faqat shundan keyin NOT NULL bo'ladi.
-- Workspace id'lari `ws_<userId>` shaklida deterministik — takrorlanmaydi va
-- backfill'ni bir marta bajarish kifoya.

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('owner', 'admin', 'editor', 'support', 'viewer');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_blueprints" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT,
    "prompt" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'rule_based',
    "templateId" TEXT,
    "plan" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "botId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspace_members_userId_createdAt_idx" ON "workspace_members"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "bot_blueprints_workspaceId_createdAt_idx" ON "bot_blueprints"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_blueprints" ADD CONSTRAINT "bot_blueprints_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Backfill: har bir mavjud foydalanuvchiga shaxsiy workspace ──────────────

INSERT INTO "workspaces" ("id", "name", "slug", "createdAt", "updatedAt")
SELECT 'ws_' || u."id",
       COALESCE(NULLIF(btrim(u."name"), ''), split_part(u."email", '@', 1)),
       'w-' || lower(u."id"),
       u."createdAt",
       CURRENT_TIMESTAMP
FROM "users" u;

INSERT INTO "workspace_members" ("id", "workspaceId", "userId", "role", "createdAt")
SELECT 'wm_' || u."id",
       'ws_' || u."id",
       u."id",
       'owner'::"WorkspaceRole",
       u."createdAt"
FROM "users" u;

-- ─── telegram_bots.workspaceId: nullable → backfill → NOT NULL ──────────────

-- AlterTable
ALTER TABLE "telegram_bots" ADD COLUMN "workspaceId" TEXT;

UPDATE "telegram_bots" SET "workspaceId" = 'ws_' || "ownerId" WHERE "workspaceId" IS NULL;

ALTER TABLE "telegram_bots" ALTER COLUMN "workspaceId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "telegram_bots_workspaceId_createdAt_idx" ON "telegram_bots"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "telegram_bots" ADD CONSTRAINT "telegram_bots_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
