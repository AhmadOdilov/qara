import "server-only";
import type { Prisma, TelegramBot } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { newWebhookSecret } from "@/lib/crypto";
import { deleteSecret, readSecret, writeSecret } from "@/lib/bots/secrets";
import { audit } from "@/lib/bots/audit";
import { invalidateTree } from "@/lib/bots/buttons/cache";
import {
  deleteWebhookForBot,
  getMe,
  getWebhookInfo,
  setMyCommandsForBot,
  setWebhookForBot,
  TelegramApiError,
  type BotIdentity,
} from "@/lib/bots/telegram-api";
import { log } from "@/lib/log";

/**
 * Bot konstruktorining hayot tsikli: yaratish, o'qish, yangilash, o'chirish
 * va webhook boshqaruvi.
 *
 * API route'lar bu yerdagi funksiyalarni chaqiradi va faqat HTTP tomonini
 * (guard, validatsiya, javob shakli) o'z zimmasiga oladi — bir xil mantiq
 * webhook, simulyator va sahifalardan ham ishlatiladi.
 */

/** Chaqiruvchiga tayyor HTTP status bilan qaytadigan kutilgan xato. */
export class BotServiceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "BotServiceError";
  }
}

/* ── Webhook manzili ─────────────────────────────────────────────────────── */

export function botWebhookUrl(botId: string): string {
  return `${env.appUrl}/api/telegram/bots/${botId}`;
}

/**
 * Telegram webhook uchun faqat HTTPS qabul qiladi. Lokal ishlashda
 * (`http://localhost`) webhook o'rnatib bo'lmaydi — buning o'rniga
 * `/api/bots/[botId]/simulate` orqali aynan o'sha qayta ishlash yo'li sinaladi.
 */
export function webhookAvailable(): boolean {
  return env.appUrl.startsWith("https://");
}

/* ── Ro'yxat va o'qish ───────────────────────────────────────────────────── */

/** Ro'yxat kartalari uchun kerakli maydonlar — sirlar hech qachon bu yerda yo'q. */
const BOT_SUMMARY_SELECT = {
  id: true,
  username: true,
  name: true,
  description: true,
  category: true,
  status: true,
  avatarUrl: true,
  lastError: true,
  lastActiveAt: true,
  webhookSetAt: true,
  developerMode: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TelegramBotSelect;

export type BotSummary = Prisma.TelegramBotGetPayload<{
  select: typeof BOT_SUMMARY_SELECT;
}> & {
  userCount: number;
  messageCount: number;
};

/**
 * Amalni bajarayotgan tomon: qaysi ish maydonida va kim nomidan.
 * `workspaceId` kirish huquqini, `actorId` esa audit yozuvini belgilaydi.
 */
export type BotScope = { workspaceId: string; actorId: string };

export async function listBots(workspaceId: string): Promise<BotSummary[]> {
  const bots = await prisma.telegramBot.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      ...BOT_SUMMARY_SELECT,
      _count: { select: { botUsers: true, botMessages: true } },
    },
  });

  return bots.map(({ _count, ...bot }) => ({
    ...bot,
    userCount: _count.botUsers,
    messageCount: _count.botMessages,
  }));
}

/**
 * Botni ish maydoni tekshiruvi bilan oladi. Topilmasa ham, boshqa
 * workspace'niki bo'lsa ham bir xil xato qaytadi — mavjudligi oshkor
 * bo'lmasin.
 */
export async function requireBot(
  botId: string,
  scope: BotScope,
): Promise<TelegramBot> {
  const bot = await prisma.telegramBot.findFirst({
    where: { id: botId, workspaceId: scope.workspaceId },
  });
  if (!bot) throw new BotServiceError("Bot topilmadi", 404);
  return bot;
}

/** Bot tokenini o'qiydi. Sir yo'q bo'lsa — sozlash tugallanmagan. */
export async function requireBotToken(botId: string): Promise<string> {
  const token = await readSecret(botId, "telegram_token");
  if (!token) {
    throw new BotServiceError(
      "Bot tokeni topilmadi yoki ochilmadi. Tokenni qaytadan kiriting.",
      409,
    );
  }
  return token;
}

/* ── Token tekshiruvi ────────────────────────────────────────────────────── */

/**
 * Tokenni Telegram'da tekshiradi. Xato matni foydalanuvchiga tushunarli
 * shaklga o'giriladi — `TelegramApiError` allaqachon sirlarni tozalagan.
 */
export async function verifyToken(token: string): Promise<BotIdentity> {
  try {
    const identity = await getMe(token);
    if (!identity.username) {
      throw new BotServiceError("Bot username'i aniqlanmadi", 502);
    }
    return identity;
  } catch (error) {
    if (error instanceof BotServiceError) throw error;
    if (error instanceof TelegramApiError) {
      if (error.status === 401) {
        throw new BotServiceError(
          "Token noto'g'ri. @BotFather bergan tokenni to'liq nusxalang.",
          400,
        );
      }
      if (error.status === 408) {
        throw new BotServiceError("Telegram javob bermadi. Qayta urinib ko'ring.", 504);
      }
      throw new BotServiceError(`Telegram xatosi: ${error.message}`, 502);
    }
    throw new BotServiceError("Telegram bilan bog'lanib bo'lmadi", 502);
  }
}

/* ── Yaratish ────────────────────────────────────────────────────────────── */

/**
 * Yangi botga beriladigan boshlang'ich buyruqlar — bot darhol javob bersin.
 *
 * `/start` javobi salomlashuv va menyuga ishora bo'ladi; `/menu` va `/help`
 * matn saqlamaydi, chunki ularni runtime tizim ekrani bilan ochadi va u
 * har doim tugmali, chiqish yo'li bor ekran bo'ladi.
 */
function defaultCommands(botName: string) {
  return [
    {
      command: "start",
      description: "Botni ishga tushirish",
      actionType: "send_message",
      actionConfig: {
        text:
          `👋 Assalomu alaykum! Men — ${botName}.\n\n` +
          "Quyidagi menyudan kerakli bo'limni tanlang 👇",
      } as Prisma.InputJsonValue,
      sortOrder: 0,
    },
    {
      command: "menu",
      description: "Bosh menyu",
      actionType: "send_message",
      actionConfig: {} as Prisma.InputJsonValue,
      sortOrder: 1,
    },
    {
      command: "help",
      description: "Yordam",
      actionType: "send_message",
      actionConfig: {} as Prisma.InputJsonValue,
      sortOrder: 2,
    },
  ];
}

export async function createBot(input: {
  workspaceId: string;
  ownerId: string;
  token: string;
  name?: string;
  description?: string;
  category?: string;
  ip?: string | null;
}): Promise<{ bot: TelegramBot; webhook: WebhookResult }> {
  const identity = await verifyToken(input.token);
  const telegramBotId = String(identity.id);

  const existing = await prisma.telegramBot.findUnique({
    where: { telegramBotId },
    select: { workspaceId: true },
  });
  if (existing) {
    throw new BotServiceError(
      existing.workspaceId === input.workspaceId
        ? "Bu bot allaqachon qo'shilgan"
        : "Bu bot boshqa hisobga bog'langan",
      409,
    );
  }

  const name = input.name?.trim() || identity.firstName || identity.username;

  const bot = await prisma.telegramBot.create({
    data: {
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      telegramBotId,
      username: identity.username,
      name,
      description: input.description?.trim() || null,
      category: input.category?.trim() || "other",
      webhookSecret: newWebhookSecret(),
      status: "setup_required",
      canJoinGroups: identity.canJoinGroups,
      canReadAllGroupMessages: identity.canReadAllGroupMessages,
      supportsInlineQueries: identity.supportsInlineQueries,
      commands: { create: defaultCommands(name) },
      aiConfig: { create: { enabled: false } },
    },
  });

  // Token darhol shifrlanadi — qoralamada ham, javobda ham ochiq turmaydi.
  await writeSecret(bot.id, "telegram_token", input.token);

  await audit("BOT_CREATED", {
    botId: bot.id,
    actorId: input.ownerId,
    ip: input.ip,
    metadata: { username: identity.username, telegramBotId },
  });
  await audit("TOKEN_VERIFIED", {
    botId: bot.id,
    actorId: input.ownerId,
    ip: input.ip,
  });

  // Webhook'ni darhol o'rnatishga urinamiz: HTTPS bo'lsa bot shu zahoti ishlaydi.
  const webhook = await applyWebhook(bot.id, input.ownerId, input.ip);
  const fresh = await prisma.telegramBot.findUniqueOrThrow({ where: { id: bot.id } });

  return { bot: fresh, webhook };
}

/* ── Yangilash ───────────────────────────────────────────────────────────── */

export type BotUpdate = {
  name?: string;
  description?: string | null;
  shortDescription?: string | null;
  category?: string;
  developerMode?: boolean;
};

export async function updateBot(
  botId: string,
  scope: BotScope,
  patch: BotUpdate,
  ip?: string | null,
): Promise<TelegramBot> {
  await requireBot(botId, scope);

  const bot = await prisma.telegramBot.update({
    where: { id: botId },
    data: patch,
  });

  await audit("BOT_UPDATED", {
    botId,
    actorId: scope.actorId,
    ip,
    metadata: { fields: Object.keys(patch) },
  });
  return bot;
}

/** Botni to'xtatish yoki qaytadan yoqish. To'xtatilganda webhook olib tashlanadi. */
export async function setBotPaused(
  botId: string,
  scope: BotScope,
  paused: boolean,
  ip?: string | null,
): Promise<TelegramBot> {
  await requireBot(botId, scope);

  if (paused) {
    await removeWebhook(botId, scope.actorId, ip);
    const bot = await prisma.telegramBot.update({
      where: { id: botId },
      data: { status: "disabled" },
    });
    await audit("BOT_PAUSED", { botId, actorId: scope.actorId, ip });
    return bot;
  }

  await applyWebhook(botId, scope.actorId, ip);
  await audit("BOT_RESUMED", { botId, actorId: scope.actorId, ip });
  return prisma.telegramBot.findUniqueOrThrow({ where: { id: botId } });
}

/**
 * Tokenni almashtirish (BotFather'da qayta generatsiya qilingan bo'lsa).
 * Yangi token boshqa botniki bo'lib qolmasligi tekshiriladi.
 */
export async function replaceToken(
  botId: string,
  scope: BotScope,
  token: string,
  ip?: string | null,
): Promise<{ bot: TelegramBot; webhook: WebhookResult }> {
  const bot = await requireBot(botId, scope);
  const identity = await verifyToken(token);

  if (bot.telegramBotId && String(identity.id) !== bot.telegramBotId) {
    throw new BotServiceError(
      "Bu token boshqa botga tegishli. Shu bot uchun token kiriting.",
      409,
    );
  }

  await writeSecret(botId, "telegram_token", token);
  await prisma.telegramBot.update({
    where: { id: botId },
    data: {
      telegramBotId: String(identity.id),
      username: identity.username,
      canJoinGroups: identity.canJoinGroups,
      canReadAllGroupMessages: identity.canReadAllGroupMessages,
      supportsInlineQueries: identity.supportsInlineQueries,
      lastError: null,
    },
  });

  await audit("TOKEN_UPDATED", { botId, actorId: scope.actorId, ip });

  // Token almashgach webhook'ni qayta o'rnatish kerak — eskisi bekor bo'ladi.
  const webhook = await applyWebhook(botId, scope.actorId, ip);
  const fresh = await prisma.telegramBot.findUniqueOrThrow({ where: { id: botId } });
  return { bot: fresh, webhook };
}

/* ── O'chirish ───────────────────────────────────────────────────────────── */

export async function deleteBot(
  botId: string,
  scope: BotScope,
  ip?: string | null,
): Promise<void> {
  const bot = await requireBot(botId, scope);

  // Telegram tomonidagi webhook'ni ham tozalaymiz, aks holda bot o'chirilgach
  // ham update'lar kelaverib 404 oladi. Xato bo'lsa o'chirishni to'xtatmaymiz.
  const token = await readSecret(botId, "telegram_token");
  if (token) {
    await deleteWebhookForBot(token).catch(() => undefined);
  }

  await prisma.telegramBot.delete({ where: { id: botId } });

  // Nashr surati keshda qolib ketmasin: bot id'si qayta ishlatilmasa ham
  // yozuv TTL tugagunicha xotirani band qilib turardi.
  invalidateTree(botId);

  // Audit yozuvi botga `onDelete: Cascade` bilan bog'langan — botId'siz yozamiz.
  await audit("BOT_DELETED", {
    actorId: scope.actorId,
    ip,
    metadata: { username: bot.username, botId },
  });
}

/* ── Webhook ─────────────────────────────────────────────────────────────── */

export type WebhookResult =
  | { ok: true; url: string }
  | { ok: false; reason: string; needsHttps: boolean };

/**
 * Webhook'ni Telegram'da ro'yxatdan o'tkazadi va bot holatini yangilaydi.
 * Xato bo'lsa ham istisno tashlamaydi: natijani chaqiruvchi ko'rsatadi, bot esa
 * `error` holatida qoladi va sababi `lastError`da saqlanadi.
 */
export async function applyWebhook(
  botId: string,
  actorId: string,
  ip?: string | null,
): Promise<WebhookResult> {
  if (!webhookAvailable()) {
    const reason =
      "Webhook uchun HTTPS manzil kerak. APP_URL ni tunnel manziliga o'zgartiring (ngrok, localtunnel).";
    await prisma.telegramBot.update({
      where: { id: botId },
      data: { status: "setup_required", lastError: reason },
    });
    return { ok: false, reason, needsHttps: true };
  }

  try {
    const bot = await prisma.telegramBot.findUniqueOrThrow({
      where: { id: botId },
      select: { webhookSecret: true },
    });
    const token = await requireBotToken(botId);
    const url = botWebhookUrl(botId);

    await setWebhookForBot(token, url, bot.webhookSecret);
    await syncCommands(botId, token);

    await prisma.telegramBot.update({
      where: { id: botId },
      data: { status: "active", webhookSetAt: new Date(), lastError: null },
    });
    await audit("WEBHOOK_UPDATED", {
      botId,
      actorId,
      ip,
      metadata: { url },
    });
    return { ok: true, url };
  } catch (error) {
    const reason =
      error instanceof BotServiceError || error instanceof TelegramApiError
        ? error.message
        : "Webhook o'rnatilmadi";
    await prisma.telegramBot.update({
      where: { id: botId },
      data: { status: "error", lastError: reason },
    });
    return { ok: false, reason, needsHttps: false };
  }
}

export async function removeWebhook(
  botId: string,
  actorId: string,
  ip?: string | null,
): Promise<void> {
  const token = await readSecret(botId, "telegram_token");
  if (token) {
    await deleteWebhookForBot(token).catch(() => undefined);
  }
  await prisma.telegramBot.update({
    where: { id: botId },
    data: { webhookSetAt: null },
  });
  await audit("WEBHOOK_REMOVED", { botId, actorId, ip });
}

/** Telegram tomonidagi haqiqiy webhook holati — diagnostika uchun. */
export async function webhookStatus(botId: string): Promise<{
  url: string;
  pendingUpdates: number;
  lastErrorMessage: string | null;
  lastErrorAt: Date | null;
}> {
  const token = await requireBotToken(botId);
  const info = await getWebhookInfo(token);
  return {
    url: info.url,
    pendingUpdates: info.pending_update_count,
    lastErrorMessage: info.last_error_message ?? null,
    lastErrorAt: info.last_error_date ? new Date(info.last_error_date * 1000) : null,
  };
}

/* ── Buyruqlar ───────────────────────────────────────────────────────────── */

/**
 * Yoqilgan buyruqlarni Telegram menyusiga yozadi.
 * Xato bo'lsa asosiy oqim to'xtamaydi — buyruqlar bazada baribir saqlanadi.
 */
export async function syncCommands(botId: string, token?: string): Promise<void> {
  const commands = await prisma.telegramBotCommand.findMany({
    where: { botId, enabled: true },
    orderBy: { sortOrder: "asc" },
    select: { command: true, description: true },
  });

  const botToken = token ?? (await readSecret(botId, "telegram_token"));
  if (!botToken) return;

  await setMyCommandsForBot(botToken, commands).catch((error) => {
    log.error("bots: setMyCommands bajarilmadi", {
      reason: error instanceof Error ? error.message : "noma'lum",
    });
  });
}

/* ── Sirni o'chirish (bot o'chirilmasdan) ────────────────────────────────── */

export async function forgetToken(botId: string, scope: BotScope): Promise<void> {
  await requireBot(botId, scope);
  await deleteSecret(botId, "telegram_token");
  await prisma.telegramBot.update({
    where: { id: botId },
    data: { status: "setup_required", webhookSetAt: null },
  });
}
