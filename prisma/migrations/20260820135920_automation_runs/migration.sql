-- AlterTable
ALTER TABLE "telegram_bot_automations" ADD COLUMN     "conditions" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft';

-- CreateTable
CREATE TABLE "telegram_bot_automation_runs" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "depth" INTEGER NOT NULL DEFAULT 0,
    "actionsRun" INTEGER NOT NULL DEFAULT 0,
    "failedAction" TEXT,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "telegram_bot_automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telegram_bot_automation_runs_botId_startedAt_idx" ON "telegram_bot_automation_runs"("botId", "startedAt");

-- CreateIndex
CREATE INDEX "telegram_bot_automation_runs_automationId_status_idx" ON "telegram_bot_automation_runs"("automationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bot_automation_runs_automationId_dedupeKey_key" ON "telegram_bot_automation_runs"("automationId", "dedupeKey");

-- CreateIndex
CREATE INDEX "telegram_bot_automations_botId_status_trigger_idx" ON "telegram_bot_automations"("botId", "status", "trigger");

-- AddForeignKey
ALTER TABLE "telegram_bot_automation_runs" ADD CONSTRAINT "telegram_bot_automation_runs_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "telegram_bot_automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
