import "server-only";
import { redactSecrets } from "@/lib/crypto";

/**
 * Bot konstruktori uchun Telegram Bot API klienti.
 *
 * `lib/telegram.ts` dan farqi: u bitta global tokenga bog'langan (Qara'ning
 * o'z boti), bu esa har bir chaqiruvda tokenni parametr sifatida oladi —
 * foydalanuvchilar yaratgan botlar ko'p va har birining o'z tokeni bor.
 *
 * Token hech qachon xato matniga tushmaydi: URL loglanmaydi, xabarlar
 * `redactSecrets` dan o'tkaziladi.
 */

const API_BASE = "https://api.telegram.org";

export class TelegramApiError extends Error {
  constructor(
    message: string,
    readonly method: string,
    readonly status: number,
    readonly description?: string,
  ) {
    super(redactSecrets(message));
    this.name = "TelegramApiError";
  }
}

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

export async function callBotApi<T>(
  token: string,
  method: string,
  params: Record<string, unknown> = {},
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);

  try {
    const response = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as TelegramResponse<T>;

    if (!payload.ok) {
      throw new TelegramApiError(
        payload.description ?? `HTTP ${response.status}`,
        method,
        response.status,
        payload.description,
      );
    }
    return payload.result as T;
  } catch (error) {
    if (error instanceof TelegramApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new TelegramApiError("Telegram javob bermadi (timeout)", method, 408);
    }
    throw new TelegramApiError(
      error instanceof Error ? error.message : "Noma'lum tarmoq xatosi",
      method,
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/* ── getMe ───────────────────────────────────────────────────────────────── */

export type BotIdentity = {
  id: number;
  username: string;
  firstName: string;
  canJoinGroups: boolean;
  canReadAllGroupMessages: boolean;
  supportsInlineQueries: boolean;
};

export async function getMe(token: string): Promise<BotIdentity> {
  const me = await callBotApi<{
    id: number;
    username?: string;
    first_name?: string;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
    supports_inline_queries?: boolean;
  }>(token, "getMe");

  return {
    id: me.id,
    username: me.username ?? "",
    firstName: me.first_name ?? "",
    canJoinGroups: me.can_join_groups ?? false,
    canReadAllGroupMessages: me.can_read_all_group_messages ?? false,
    supportsInlineQueries: me.supports_inline_queries ?? false,
  };
}

/* ── Xabar yuborish ──────────────────────────────────────────────────────── */

export type SentMessage = { message_id: number; date: number };

export async function sendBotMessage(
  token: string,
  chatId: string | number,
  text: string,
  opts: {
    replyMarkup?: unknown;
    silent?: boolean;
    parseMode?: "HTML" | "MarkdownV2";
  } = {},
): Promise<SentMessage> {
  return callBotApi<SentMessage>(token, "sendMessage", {
    chat_id: chatId,
    // Telegram bitta xabarda 4096 belgigacha qabul qiladi.
    text: text.slice(0, 4096),
    disable_notification: opts.silent ?? false,
    link_preview_options: { is_disabled: true },
    ...(opts.parseMode ? { parse_mode: opts.parseMode } : {}),
    ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
  });
}

/**
 * Mavjud xabarni joyida yangilaydi (§1).
 *
 * Menyu bo'ylab yurish uchun asosiy yo'l: chat yangi xabarlar bilan
 * to'lmaydi, foydalanuvchi bitta «ekran»da harakat qiladi.
 *
 * Qaytadigan qiymatlar:
 *   • `"edited"`      — xabar yangilandi;
 *   • `"unchanged"`   — matn va klaviatura aynan bir xil bo'lgan (Telegram
 *                       bunda xato qaytaradi, lekin bu xato emas);
 *   • `"unavailable"` — xabarni tahrirlab bo'lmaydi (o'chirilgan, 48 soatdan
 *                       oshgan, boshqa bot yuborgan) — chaqiruvchi yangi
 *                       xabar yuboradi.
 */
export async function editBotMessageText(
  token: string,
  chatId: string | number,
  messageId: number,
  text: string,
  opts: { replyMarkup?: unknown; parseMode?: "HTML" | "MarkdownV2" } = {},
): Promise<"edited" | "unchanged" | "unavailable"> {
  try {
    await callBotApi(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: text.slice(0, 4096),
      link_preview_options: { is_disabled: true },
      ...(opts.parseMode ? { parse_mode: opts.parseMode } : {}),
      // Klaviaturasi bo'lmagan menyu ham eski klaviaturani qoldirmasligi kerak.
      reply_markup: opts.replyMarkup ?? { inline_keyboard: [] },
    });
    return "edited";
  } catch (error) {
    if (!(error instanceof TelegramApiError)) throw error;
    const reason = (error.description ?? error.message).toLowerCase();
    if (reason.includes("not modified")) return "unchanged";
    return "unavailable";
  }
}

/** Faqat klaviaturani yangilash — matn o'zgarmaganda arzonroq yo'l. */
export async function editBotMessageMarkup(
  token: string,
  chatId: string | number,
  messageId: number,
  replyMarkup: unknown,
): Promise<"edited" | "unchanged" | "unavailable"> {
  try {
    await callBotApi(token, "editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup ?? { inline_keyboard: [] },
    });
    return "edited";
  } catch (error) {
    if (!(error instanceof TelegramApiError)) throw error;
    const reason = (error.description ?? error.message).toLowerCase();
    if (reason.includes("not modified")) return "unchanged";
    return "unavailable";
  }
}

export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await callBotApi(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text: text.slice(0, 200) } : {}),
  }).catch(() => undefined);
}

export async function sendChatAction(
  token: string,
  chatId: string | number,
  action = "typing",
): Promise<void> {
  await callBotApi(token, "sendChatAction", {
    chat_id: chatId,
    action,
  }).catch(() => undefined);
}

/* ── Polling (lokal ishlab chiqish) ──────────────────────────────────────── */

export type RawUpdate = { update_id: number } & Record<string, unknown>;

/**
 * Update'larni Telegram'dan so'rab oladi (long polling).
 *
 * Webhook o'rnatilgan bo'lsa Telegram bu metodni rad etadi (409) — ikkalasi
 * birga ishlamaydi. Shuning uchun chaqiruvchi avval webhook'ni olib tashlaydi.
 *
 * `offset` — oxirgi qayta ishlangan `update_id + 1`. Shu qiymat yuborilgach
 * Telegram undan oldingilarni tasdiqlangan deb hisoblab, o'chirib yuboradi.
 */
export async function getUpdates(
  token: string,
  offset: number,
  timeoutSec = 25,
): Promise<RawUpdate[]> {
  return callBotApi<RawUpdate[]>(
    token,
    "getUpdates",
    {
      offset,
      timeout: timeoutSec,
      allowed_updates: ["message", "edited_message", "callback_query"],
    },
    // Tarmoq timeout'i long polling muddatidan uzunroq bo'lishi shart.
    { timeoutMs: (timeoutSec + 10) * 1000 },
  );
}

/* ── Bot sozlamalari ─────────────────────────────────────────────────────── */

export async function setWebhookForBot(
  token: string,
  url: string,
  secret: string,
): Promise<void> {
  await callBotApi(token, "setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "edited_message", "callback_query", "inline_query"],
    drop_pending_updates: true,
    max_connections: 40,
  });
}

export async function deleteWebhookForBot(token: string): Promise<void> {
  await callBotApi(token, "deleteWebhook", { drop_pending_updates: false });
}

export async function getWebhookInfo(token: string): Promise<{
  url: string;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}> {
  return callBotApi(token, "getWebhookInfo");
}

export async function setMyCommandsForBot(
  token: string,
  commands: { command: string; description: string }[],
): Promise<void> {
  await callBotApi(token, "setMyCommands", {
    // Telegram cheklovi: buyruq 1–32 belgi, faqat a-z0-9_
    commands: commands.slice(0, 100).map((c) => ({
      command: c.command.replace(/^\//, "").toLowerCase().slice(0, 32),
      description: c.description.slice(0, 256) || "—",
    })),
  });
}

export async function setMyDescriptionForBot(
  token: string,
  description: string,
): Promise<void> {
  await callBotApi(token, "setMyDescription", {
    description: description.slice(0, 512),
  });
}

export async function setMyShortDescriptionForBot(
  token: string,
  shortDescription: string,
): Promise<void> {
  await callBotApi(token, "setMyShortDescription", {
    short_description: shortDescription.slice(0, 120),
  });
}

export async function setMyNameForBot(token: string, name: string): Promise<void> {
  await callBotApi(token, "setMyName", { name: name.slice(0, 64) });
}

/**
 * Menyu tugmasi. `web_app` varianti Mini App'ni ochadi, `commands` esa
 * standart buyruqlar ro'yxatini.
 */
export async function setChatMenuButtonForBot(
  token: string,
  button:
    | { type: "commands" }
    | { type: "default" }
    | { type: "web_app"; text: string; url: string },
): Promise<void> {
  const menu_button =
    button.type === "web_app"
      ? { type: "web_app", text: button.text.slice(0, 64), web_app: { url: button.url } }
      : { type: button.type };

  await callBotApi(token, "setChatMenuButton", { menu_button });
}

/** Inline mode uchun ko'rsatma matni (BotFather'siz o'rnatib bo'lmaydi — faqat placeholder). */
export async function answerInlineQuery(
  token: string,
  inlineQueryId: string,
  results: unknown[],
  opts: { cacheTime?: number; placeholder?: string } = {},
): Promise<void> {
  await callBotApi(token, "answerInlineQuery", {
    inline_query_id: inlineQueryId,
    results: results.slice(0, 50),
    cache_time: opts.cacheTime ?? 60,
    is_personal: true,
    ...(opts.placeholder ? { button: { text: opts.placeholder } } : {}),
  }).catch(() => undefined);
}
