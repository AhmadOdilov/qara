-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "Lang" AS ENUM ('uz', 'ru', 'en');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('outgoing', 'incoming');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "lang" "Lang" NOT NULL DEFAULT 'uz',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notifyTelegram" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "quietHours" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_links" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "telegramChatId" TEXT,
    "username" TEXT,
    "firstName" TEXT,
    "languageCode" TEXT,
    "linkToken" TEXT NOT NULL,
    "linkTokenExp" TIMESTAMP(3) NOT NULL,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "telegramMsgId" INTEGER,
    "direction" "MessageDirection" NOT NULL,
    "fromUser" BOOLEAN NOT NULL,
    "content" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "status" "MessageStatus" NOT NULL DEFAULT 'sent',
    "error" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 1,
    "meta" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Salom! Qara bilan bog''landingiz.',
    "autoReply" TEXT,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 20,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_userId_key" ON "telegram_links"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_telegramUserId_key" ON "telegram_links"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_telegramChatId_key" ON "telegram_links"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_linkToken_key" ON "telegram_links"("linkToken");

-- CreateIndex
CREATE INDEX "messages_userId_timestamp_idx" ON "messages"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "messages_timestamp_idx" ON "messages"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "analytics_event_recordedAt_idx" ON "analytics"("event", "recordedAt");

-- CreateIndex
CREATE INDEX "analytics_recordedAt_idx" ON "analytics"("recordedAt");

-- AddForeignKey
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
