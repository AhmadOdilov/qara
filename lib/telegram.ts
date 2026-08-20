import "server-only";
import { env, telegramMockMode } from "@/lib/env";

const API_BASE = "https://api.telegram.org";

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

/**
 * Inline tugma bosilganda keladigan hodisa.
 *
 * `data` — 64 baytgacha. Unga HECH QACHON sir yoki shaxsiy ma'lumot
 * qo'yilmaydi (§57): faqat qisqa marshrut kodi, masalan `ob:goal:sell`.
 */
export type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from: NonNullable<TelegramMessage["from"]>;
  message?: TelegramMessage;
};

export type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; web_app: { url: string } };

export type InlineKeyboard = { inline_keyboard: InlineButton[][] };

export type TelegramMessage = {
  message_id: number;
  date: number;
  text?: string;
  caption?: string;
  photo?: { file_id: string }[];
  document?: { file_id: string; file_name?: string };
  sticker?: { emoji?: string };
  chat: { id: number; type: string };
  from?: {
    id: number;
    is_bot: boolean;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
};

type TelegramResponse<T> = { ok: boolean; result?: T; description?: string };

/**
 * Bot API chaqiruvi. Token bo'lmasa MOCK rejim: tarmoqqa chiqmaymiz,
 * mos keladigan soxta natija qaytariladi — shunda ilovaning butun oqimini
 * (bog'lash, xabar yuborish, javob olish) tokensiz ham sinab ko'rish mumkin.
 */
export async function callTelegram<T>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  if (telegramMockMode) {
    return mockResponse<T>(method, params);
  }

  const response = await fetch(`${API_BASE}/bot${env.telegram.token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });

  const payload = (await response.json()) as TelegramResponse<T>;
  if (!payload.ok) {
    throw new Error(
      `Telegram ${method} xatosi: ${payload.description ?? response.status}`,
    );
  }
  return payload.result as T;
}

let mockMessageId = 1000;

function mockResponse<T>(method: string, params: Record<string, unknown>): T {
  switch (method) {
    case "sendMessage":
      return {
        message_id: ++mockMessageId,
        date: Math.floor(Date.now() / 1000),
        text: String(params.text ?? ""),
        chat: { id: Number(params.chat_id ?? 0), type: "private" },
      } as T;
    case "getMe":
      return {
        id: 0,
        is_bot: true,
        first_name: "Qara (mock)",
        username: env.telegram.username,
      } as T;
    case "editMessageText":
      return {
        message_id: Number(params.message_id ?? ++mockMessageId),
        date: Math.floor(Date.now() / 1000),
        text: String(params.text ?? ""),
        chat: { id: Number(params.chat_id ?? 0), type: "private" },
      } as T;
    case "setWebhook":
    case "deleteWebhook":
    case "answerCallbackQuery":
    case "setMyCommands":
      return true as T;
    default:
      return {} as T;
  }
}

/**
 * Foydalanuvchiga xabar yuborish.
 * `silent` — PDF'da aytilgan disable_notification: xabar keladi, lekin
 * telefonda ovoz/tebranish bo'lmaydi ("tinch bildirishnoma").
 */
export async function sendMessage(
  chatId: string,
  text: string,
  opts: { silent?: boolean; replyMarkup?: unknown } = {},
): Promise<TelegramMessage> {
  return callTelegram<TelegramMessage>("sendMessage", {
    chat_id: chatId,
    text,
    disable_notification: opts.silent ?? false,
    link_preview_options: { is_disabled: true },
    ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
  });
}

/**
 * Tugma bosilishini tasdiqlash. Telegram buni kutadi — aks holda tugmada
 * "soat" belgisi qotib qoladi va bot javob bermayotgandek ko'rinadi.
 */
export async function answerCallback(
  callbackId: string,
  text?: string,
): Promise<boolean> {
  return callTelegram<boolean>("answerCallbackQuery", {
    callback_query_id: callbackId,
    ...(text ? { text, show_alert: false } : {}),
  });
}

/**
 * Mavjud xabarni o'rniga yangilash — savoldan savolga o'tishda chat
 * eskilari bilan to'lib ketmasin.
 */
export async function editMessage(
  chatId: string,
  messageId: number,
  text: string,
  opts: { replyMarkup?: unknown } = {},
): Promise<TelegramMessage> {
  return callTelegram<TelegramMessage>("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    link_preview_options: { is_disabled: true },
    ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
  });
}

/** Telegram menyusidagi buyruqlar ro'yxati (§63). */
export async function setBotCommands(
  commands: { command: string; description: string }[],
): Promise<boolean> {
  return callTelegram<boolean>("setMyCommands", { commands });
}

/** Deep link: bosilganda Telegram botni ochib /start <payload> yuboradi. */
export function deepLink(token: string): string {
  return `https://t.me/${env.telegram.username}?start=${token}`;
}

export function webhookUrl(): string {
  return `${env.appUrl}/api/telegram/webhook`;
}

export async function setWebhook(): Promise<boolean> {
  return callTelegram<boolean>("setWebhook", {
    url: webhookUrl(),
    secret_token: env.telegram.webhookSecret,
    allowed_updates: ["message", "edited_message", "callback_query"],
    drop_pending_updates: true,
  });
}

export async function deleteWebhook(): Promise<boolean> {
  return callTelegram<boolean>("deleteWebhook", { drop_pending_updates: true });
}

/** Kelgan xabardan matn ajratib olish (rasm/hujjat uchun tavsif). */
export function extractContent(message: TelegramMessage): {
  content: string;
  kind: string;
} {
  if (message.text) return { content: message.text, kind: "text" };
  if (message.photo) {
    return { content: message.caption || "[rasm]", kind: "photo" };
  }
  if (message.document) {
    return {
      content: message.caption || `[hujjat: ${message.document.file_name ?? "fayl"}]`,
      kind: "document",
    };
  }
  if (message.sticker) {
    return { content: message.sticker.emoji || "[stiker]", kind: "sticker" };
  }
  return { content: "[qo'llab-quvvatlanmaydigan kontent]", kind: "unknown" };
}
