-- CreateTable
CREATE TABLE "onboarding_sessions" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT,
    "workspaceId" TEXT,
    "currentStep" TEXT NOT NULL DEFAULT 'welcome',
    "lang" TEXT NOT NULL DEFAULT 'uz',
    "businessType" TEXT,
    "businessDescription" TEXT,
    "businessStage" TEXT,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "blueprintId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_account_claims" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_account_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_sessions_telegramUserId_key" ON "onboarding_sessions"("telegramUserId");

-- CreateIndex
CREATE INDEX "onboarding_sessions_status_updatedAt_idx" ON "onboarding_sessions"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_account_claims_tokenHash_key" ON "telegram_account_claims"("tokenHash");

-- CreateIndex
CREATE INDEX "telegram_account_claims_telegramUserId_createdAt_idx" ON "telegram_account_claims"("telegramUserId", "createdAt");

-- CreateIndex
CREATE INDEX "telegram_account_claims_expiresAt_idx" ON "telegram_account_claims"("expiresAt");
