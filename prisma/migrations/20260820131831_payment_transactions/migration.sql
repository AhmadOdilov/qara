-- CreateTable
CREATE TABLE "telegram_bot_payment_transactions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telegram_bot_payment_transactions_orderId_createdAt_idx" ON "telegram_bot_payment_transactions"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "telegram_bot_payment_transactions_botId_status_idx" ON "telegram_bot_payment_transactions"("botId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bot_payment_transactions_provider_providerTransact_key" ON "telegram_bot_payment_transactions"("provider", "providerTransactionId");

-- CreateIndex
CREATE INDEX "telegram_bot_payments_botId_status_idx" ON "telegram_bot_payments"("botId", "status");

-- AddForeignKey
ALTER TABLE "telegram_bot_payment_transactions" ADD CONSTRAINT "telegram_bot_payment_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "telegram_bot_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
