-- AlterTable
ALTER TABLE "telegram_bot_buttons" ADD COLUMN     "buttonType" TEXT NOT NULL DEFAULT 'text',
ADD COLUMN     "callbackId" TEXT,
ADD COLUMN     "conditions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rowIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "visibility" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "telegram_bot_button_events" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "buttonId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_bot_button_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_button_versions" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "tree" JSONB NOT NULL,
    "summary" JSONB,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_bot_button_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telegram_bot_button_events_botId_createdAt_idx" ON "telegram_bot_button_events"("botId", "createdAt");

-- CreateIndex
CREATE INDEX "telegram_bot_button_events_buttonId_eventType_createdAt_idx" ON "telegram_bot_button_events"("buttonId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "telegram_bot_button_versions_botId_publishedAt_idx" ON "telegram_bot_button_versions"("botId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bot_button_versions_botId_version_key" ON "telegram_bot_button_versions"("botId", "version");

-- CreateIndex
CREATE INDEX "telegram_bot_buttons_botId_rowIndex_sortOrder_idx" ON "telegram_bot_buttons"("botId", "rowIndex", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bot_buttons_botId_callbackId_key" ON "telegram_bot_buttons"("botId", "callbackId");

-- AddForeignKey
ALTER TABLE "telegram_bot_button_events" ADD CONSTRAINT "telegram_bot_button_events_buttonId_fkey" FOREIGN KEY ("buttonId") REFERENCES "telegram_bot_buttons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_button_versions" ADD CONSTRAINT "telegram_bot_button_versions_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

