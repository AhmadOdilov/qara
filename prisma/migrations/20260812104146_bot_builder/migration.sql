-- CreateEnum
CREATE TYPE "BotStatus" AS ENUM ('active', 'setup_required', 'error', 'disabled');

-- CreateEnum
CREATE TYPE "BotSecretType" AS ENUM ('telegram_token', 'ai_api_key', 'web_search_api_key', 'integration_secret');

-- CreateTable
CREATE TABLE "telegram_bots" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "telegramBotId" TEXT,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shortDescription" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "avatarUrl" TEXT,
    "status" "BotStatus" NOT NULL DEFAULT 'setup_required',
    "webhookSecret" TEXT NOT NULL,
    "webhookSetAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastActiveAt" TIMESTAMP(3),
    "canJoinGroups" BOOLEAN NOT NULL DEFAULT false,
    "canReadAllGroupMessages" BOOLEAN NOT NULL DEFAULT false,
    "supportsInlineQueries" BOOLEAN NOT NULL DEFAULT false,
    "menuButtonType" TEXT NOT NULL DEFAULT 'commands',
    "menuButtonText" TEXT,
    "menuButtonUrl" TEXT,
    "miniAppEnabled" BOOLEAN NOT NULL DEFAULT false,
    "miniAppName" TEXT,
    "miniAppUrl" TEXT,
    "miniAppButtonText" TEXT,
    "inlineEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inlinePlaceholder" TEXT,
    "inlineSource" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "developerMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_secrets" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "secretType" "BotSecretType" NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'default',
    "encryptedValue" TEXT NOT NULL,
    "maskedHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_ai_configs" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "provider" TEXT NOT NULL DEFAULT 'openai_compatible',
    "baseUrl" TEXT,
    "model" TEXT NOT NULL DEFAULT '',
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 1024,
    "knowledgeText" TEXT,
    "personality" TEXT NOT NULL DEFAULT 'friendly',
    "langMode" TEXT NOT NULL DEFAULT 'auto',
    "responseStyle" TEXT NOT NULL DEFAULT 'normal',
    "memoryMode" TEXT NOT NULL DEFAULT 'short',
    "memoryLimit" INTEGER NOT NULL DEFAULT 20,
    "toolWebSearch" BOOLEAN NOT NULL DEFAULT false,
    "toolKnowledge" BOOLEAN NOT NULL DEFAULT false,
    "toolApi" BOOLEAN NOT NULL DEFAULT false,
    "toolDatabase" BOOLEAN NOT NULL DEFAULT false,
    "toolPayments" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_web_search" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'tavily',
    "baseUrl" TEXT,
    "depth" TEXT NOT NULL DEFAULT 'basic',
    "maxResults" INTEGER NOT NULL DEFAULT 5,
    "searchLang" TEXT NOT NULL DEFAULT 'auto',
    "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "totalLatency" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_web_search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_commands" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionType" TEXT NOT NULL DEFAULT 'send_message',
    "actionConfig" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_buttons" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "parentId" TEXT,
    "text" TEXT NOT NULL,
    "emoji" TEXT,
    "actionType" TEXT NOT NULL DEFAULT 'send_message',
    "actionConfig" JSONB NOT NULL DEFAULT '{}',
    "keyboardKind" TEXT NOT NULL DEFAULT 'reply',
    "columns" INTEGER NOT NULL DEFAULT 1,
    "adminOnly" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_buttons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_integrations" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'rest_api',
    "baseUrl" TEXT,
    "authType" TEXT NOT NULL DEFAULT 'none',
    "authHeader" TEXT NOT NULL DEFAULT 'Authorization',
    "headers" JSONB NOT NULL DEFAULT '{}',
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "allowedMethods" TEXT[] DEFAULT ARRAY['GET']::TEXT[],
    "endpoints" JSONB NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_workflows" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "triggerValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_knowledge_sources" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "lastIndexedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_knowledge_chunks" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_bot_knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_users" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "languageCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "pendingState" JSONB,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_messages" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "botUserId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_bot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_automations" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "triggerConfig" JSONB NOT NULL DEFAULT '{}',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_payments" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "orderId" TEXT,
    "providerPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_events" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_bot_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_audit_logs" (
    "id" TEXT NOT NULL,
    "botId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_bot_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_drafts" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL DEFAULT '{}',
    "botId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bots_telegramBotId_key" ON "telegram_bots"("telegramBotId");

-- CreateIndex
CREATE INDEX "telegram_bots_ownerId_createdAt_idx" ON "telegram_bots"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bot_secrets_botId_secretType_scope_key" ON "telegram_bot_secrets"("botId", "secretType", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bot_ai_configs_botId_key" ON "telegram_bot_ai_configs"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bot_web_search_botId_key" ON "telegram_bot_web_search"("botId");

-- CreateIndex
CREATE INDEX "telegram_bot_commands_botId_sortOrder_idx" ON "telegram_bot_commands"("botId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bot_commands_botId_command_key" ON "telegram_bot_commands"("botId", "command");

-- CreateIndex
CREATE INDEX "telegram_bot_buttons_botId_parentId_sortOrder_idx" ON "telegram_bot_buttons"("botId", "parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "telegram_bot_integrations_botId_idx" ON "telegram_bot_integrations"("botId");

-- CreateIndex
CREATE INDEX "telegram_bot_workflows_botId_idx" ON "telegram_bot_workflows"("botId");

-- CreateIndex
CREATE INDEX "telegram_bot_knowledge_sources_botId_idx" ON "telegram_bot_knowledge_sources"("botId");

-- CreateIndex
CREATE INDEX "telegram_bot_knowledge_chunks_botId_idx" ON "telegram_bot_knowledge_chunks"("botId");

-- CreateIndex
CREATE INDEX "telegram_bot_knowledge_chunks_sourceId_ordinal_idx" ON "telegram_bot_knowledge_chunks"("sourceId", "ordinal");

-- CreateIndex
CREATE INDEX "telegram_bot_users_botId_lastActiveAt_idx" ON "telegram_bot_users"("botId", "lastActiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bot_users_botId_telegramUserId_key" ON "telegram_bot_users"("botId", "telegramUserId");

-- CreateIndex
CREATE INDEX "telegram_bot_messages_botId_createdAt_idx" ON "telegram_bot_messages"("botId", "createdAt");

-- CreateIndex
CREATE INDEX "telegram_bot_messages_botUserId_createdAt_idx" ON "telegram_bot_messages"("botUserId", "createdAt");

-- CreateIndex
CREATE INDEX "telegram_bot_automations_botId_idx" ON "telegram_bot_automations"("botId");

-- CreateIndex
CREATE INDEX "telegram_bot_payments_botId_createdAt_idx" ON "telegram_bot_payments"("botId", "createdAt");

-- CreateIndex
CREATE INDEX "telegram_bot_events_botId_kind_createdAt_idx" ON "telegram_bot_events"("botId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "telegram_bot_events_botId_createdAt_idx" ON "telegram_bot_events"("botId", "createdAt");

-- CreateIndex
CREATE INDEX "telegram_bot_audit_logs_botId_createdAt_idx" ON "telegram_bot_audit_logs"("botId", "createdAt");

-- CreateIndex
CREATE INDEX "telegram_bot_audit_logs_actorId_createdAt_idx" ON "telegram_bot_audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "telegram_bot_drafts_ownerId_updatedAt_idx" ON "telegram_bot_drafts"("ownerId", "updatedAt");

-- AddForeignKey
ALTER TABLE "telegram_bots" ADD CONSTRAINT "telegram_bots_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_secrets" ADD CONSTRAINT "telegram_bot_secrets_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_ai_configs" ADD CONSTRAINT "telegram_bot_ai_configs_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_web_search" ADD CONSTRAINT "telegram_bot_web_search_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_commands" ADD CONSTRAINT "telegram_bot_commands_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_buttons" ADD CONSTRAINT "telegram_bot_buttons_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_buttons" ADD CONSTRAINT "telegram_bot_buttons_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "telegram_bot_buttons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_integrations" ADD CONSTRAINT "telegram_bot_integrations_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_workflows" ADD CONSTRAINT "telegram_bot_workflows_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_knowledge_sources" ADD CONSTRAINT "telegram_bot_knowledge_sources_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_knowledge_chunks" ADD CONSTRAINT "telegram_bot_knowledge_chunks_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "telegram_bot_knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_users" ADD CONSTRAINT "telegram_bot_users_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_messages" ADD CONSTRAINT "telegram_bot_messages_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_messages" ADD CONSTRAINT "telegram_bot_messages_botUserId_fkey" FOREIGN KEY ("botUserId") REFERENCES "telegram_bot_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_automations" ADD CONSTRAINT "telegram_bot_automations_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_payments" ADD CONSTRAINT "telegram_bot_payments_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_events" ADD CONSTRAINT "telegram_bot_events_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_audit_logs" ADD CONSTRAINT "telegram_bot_audit_logs_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_audit_logs" ADD CONSTRAINT "telegram_bot_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_drafts" ADD CONSTRAINT "telegram_bot_drafts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
