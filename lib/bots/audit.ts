import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { redactSecrets } from "@/lib/crypto";

export type AuditAction =
  | "BOT_CREATED"
  | "BOT_UPDATED"
  | "BOT_DELETED"
  | "BOT_PAUSED"
  | "BOT_RESUMED"
  | "TOKEN_VERIFIED"
  | "TOKEN_UPDATED"
  | "WEBHOOK_UPDATED"
  | "WEBHOOK_REMOVED"
  | "API_CONNECTED"
  | "API_KEY_UPDATED"
  | "AI_CONFIGURED"
  | "WEB_SEARCH_CONFIGURED"
  | "KNOWLEDGE_UPLOADED"
  | "KNOWLEDGE_DELETED"
  | "COMMANDS_UPDATED"
  | "BUTTONS_UPDATED"
  | "WORKFLOW_UPDATED"
  | "AUTOMATION_UPDATED"
  | "PLAN_APPLIED"
  /// Ish maydoni a'zosi qo'shildi, roli o'zgardi yoki chiqarildi (§21)
  | "WORKSPACE_MEMBER_UPDATED";

/**
 * Muhim amallarni yozib boradi. Audit yozuvi asosiy oqimni to'xtatmaydi —
 * xato bo'lsa faqat konsolga chiqadi.
 *
 * `metadata` `redactSecrets` dan o'tkaziladi: tasodifan token yoki API kalit
 * tushib qolsa ham bazaga ochiq holda yozilmaydi.
 */
export async function audit(
  action: AuditAction,
  opts: {
    botId?: string | null;
    actorId?: string | null;
    metadata?: Record<string, unknown>;
    ip?: string | null;
  } = {},
): Promise<void> {
  try {
    const metadata = opts.metadata
      ? (JSON.parse(redactSecrets(JSON.stringify(opts.metadata))) as Prisma.InputJsonValue)
      : undefined;

    await prisma.telegramBotAuditLog.create({
      data: {
        action,
        botId: opts.botId ?? null,
        actorId: opts.actorId ?? null,
        ip: opts.ip ?? null,
        metadata,
      },
    });
  } catch (error) {
    console.error("[audit] yozib bo'lmadi:", action, error);
  }
}

/**
 * Texnik hodisa (developer mode va analitika uchun): webhook, AI chaqiruvi,
 * tool ishlatilishi, xatolar.
 */
export async function recordEvent(
  botId: string,
  kind: "webhook" | "ai_request" | "web_search" | "tool_call" | "api_call" | "error",
  name: string,
  opts: { ok?: boolean; latencyMs?: number; detail?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    const detail = opts.detail
      ? (JSON.parse(redactSecrets(JSON.stringify(opts.detail))) as Prisma.InputJsonValue)
      : undefined;

    await prisma.telegramBotEvent.create({
      data: {
        botId,
        kind,
        name,
        ok: opts.ok ?? true,
        latencyMs: Math.round(opts.latencyMs ?? 0),
        detail,
      },
    });
  } catch (error) {
    console.error("[event] yozib bo'lmadi:", kind, name, error);
  }
}
