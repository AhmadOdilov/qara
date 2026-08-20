-- CreateEnum
CREATE TYPE "MiniAppStatus" AS ENUM ('draft', 'published', 'unpublished');

-- AlterTable
ALTER TABLE "telegram_bot_users" ADD COLUMN     "photoUrl" TEXT;

-- CreateTable
CREATE TABLE "mini_apps" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MiniAppStatus" NOT NULL DEFAULT 'draft',
    "theme" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mini_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mini_app_pages" (
    "id" TEXT NOT NULL,
    "miniAppId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "isHome" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "components" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mini_app_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mini_app_deployments" (
    "id" TEXT NOT NULL,
    "miniAppId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "schema" JSONB NOT NULL,
    "summary" JSONB,
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mini_app_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mini_app_events" (
    "id" TEXT NOT NULL,
    "miniAppId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "pageSlug" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mini_app_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mini_apps_botId_key" ON "mini_apps"("botId");

-- CreateIndex
CREATE INDEX "mini_apps_workspaceId_idx" ON "mini_apps"("workspaceId");

-- CreateIndex
CREATE INDEX "mini_app_pages_miniAppId_sortOrder_idx" ON "mini_app_pages"("miniAppId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "mini_app_pages_miniAppId_slug_key" ON "mini_app_pages"("miniAppId", "slug");

-- CreateIndex
CREATE INDEX "mini_app_deployments_miniAppId_publishedAt_idx" ON "mini_app_deployments"("miniAppId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "mini_app_deployments_miniAppId_version_key" ON "mini_app_deployments"("miniAppId", "version");

-- CreateIndex
CREATE INDEX "mini_app_events_miniAppId_createdAt_idx" ON "mini_app_events"("miniAppId", "createdAt");

-- CreateIndex
CREATE INDEX "mini_app_events_miniAppId_eventType_idx" ON "mini_app_events"("miniAppId", "eventType");

-- AddForeignKey
ALTER TABLE "mini_apps" ADD CONSTRAINT "mini_apps_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_app_pages" ADD CONSTRAINT "mini_app_pages_miniAppId_fkey" FOREIGN KEY ("miniAppId") REFERENCES "mini_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_app_deployments" ADD CONSTRAINT "mini_app_deployments_miniAppId_fkey" FOREIGN KEY ("miniAppId") REFERENCES "mini_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_app_events" ADD CONSTRAINT "mini_app_events_miniAppId_fkey" FOREIGN KEY ("miniAppId") REFERENCES "mini_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
