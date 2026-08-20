-- CreateTable
CREATE TABLE "telegram_update_receipts" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "updateId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_update_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telegram_update_receipts_createdAt_idx" ON "telegram_update_receipts"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_update_receipts_botId_updateId_key" ON "telegram_update_receipts"("botId", "updateId");

-- AddForeignKey
ALTER TABLE "telegram_update_receipts" ADD CONSTRAINT "telegram_update_receipts_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
