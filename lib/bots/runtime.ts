import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { rateLimit, sanitizeText } from "@/lib/api";
import { recordEvent } from "@/lib/bots/audit";
import { readSecret } from "@/lib/bots/secrets";
import { dispatch } from "@/lib/automation/dispatch";
import { TelegramApiError } from "@/lib/bots/telegram-api";
import { telegramTransport, type BotTransport } from "@/lib/bots/transport";
import { rootView } from "@/lib/bots/buttons/navigation";
import { loadPublished } from "@/lib/bots/buttons/store";
import {
  routeCallback,
  routePendingInput,
  routeSharedData,
  routeText,
  sendRootMenu,
  sendScreen,
  type RouterContext,
} from "@/lib/bots/buttons/router";
import { botText } from "@/lib/bots/buttons/strings";
import type { ViewerContext } from "@/lib/bots/buttons/visibility";

/**
 * Foydalanuvchi yaratgan bitta botga kelgan update'ni qayta ishlaydi.
 *
 * Webhook (`/api/telegram/bots/[botId]`), polling (`npm run bot:poll`) va
 * sinov simulyatori — uchalasi shu funksiyani chaqiradi. Tugmalar mantig'i
 * `buttons/` moduliga topshirilgan: bu yerda faqat update'ni ochish, kontekst
 * yig'ish va yo'nalish tanlash qoladi.
 */

export { telegramTransport, captureTransport } from "@/lib/bots/transport";
export type { BotTransport } from "@/lib/bots/transport";

/* ── Update shakli ───────────────────────────────────────────────────────── */

export type BotUpdateMessage = {
  message_id: number;
  date: number;
  text?: string;
  caption?: string;
  photo?: { file_id: string }[];
  document?: { file_id: string; file_name?: string };
  voice?: { file_id: string };
  sticker?: { emoji?: string };
  location?: { latitude: number; longitude: number };
  contact?: { phone_number: string };
  /**
   * Mini App `Telegram.WebApp.sendData()` bilan qaytargan ma'lumot.
   *
   * Faqat reply klaviaturadagi `web_app` tugmasidan ochilgan Mini App shu
   * yo'l bilan javob qaytaradi (inline tugmadan ochilgani `answerWebAppQuery`
   * ishlatadi). Maydon o'qilmasa xabar «qo'llab-quvvatlanmaydigan» bo'lib
   * tushadi va foydalanuvchi to'ldirgan forma yo'qoladi.
   */
  web_app_data?: { data: string; button_text?: string };
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

export type BotUpdate = {
  update_id: number;
  message?: BotUpdateMessage;
  edited_message?: BotUpdateMessage;
  callback_query?: {
    id: string;
    data?: string;
    from: BotUpdateMessage["from"];
    message?: BotUpdateMessage;
  };
};

/**
 * Buyruq bilan ochiladigan tizim ekranlari (§21).
 *
 * Bazadagi buyruq yozuvi bor bo'lsa egasining sozlamasi ustun turadi; yo'q
 * bo'lsa shu jadval ishlaydi. Shu sababli har bir bot `/start` dan tashqari
 * `/menu`, `/cart`, `/help` kabi buyruqlarga ham javob beradi — foydalanuvchi
 * yozgan buyruq javobsiz qolmaydi.
 */
const BUILT_IN_SCREENS: Record<string, "cart" | "orders" | "favorites" | "profile" | "help"> =
  {
    cart: "cart",
    savat: "cart",
    savatcha: "cart",
    korzina: "cart",
    orders: "orders",
    buyurtmalar: "orders",
    myorders: "orders",
    favorites: "favorites",
    sevimlilar: "favorites",
    profile: "profile",
    profil: "profile",
    help: "help",
    yordam: "help",
  };

/* ── Kirish nuqtasi ──────────────────────────────────────────────────────── */

export async function handleBotUpdate(
  botId: string,
  update: BotUpdate,
  opts: { transport?: BotTransport } = {},
): Promise<void> {
  const started = Date.now();

  const bot = await prisma.telegramBot.findUnique({
    where: { id: botId },
    select: { id: true, status: true },
  });
  if (!bot) return;

  if (bot.status === "disabled") {
    await recordEvent(botId, "webhook", "skipped_disabled", { ok: true });
    return;
  }

  const message = update.message ?? update.edited_message;
  const callback = update.callback_query;
  const from = message?.from ?? callback?.from;
  if (!from || from.is_bot) return;

  const chatId = String(message?.chat.id ?? callback?.message?.chat.id ?? from.id);

  let transport = opts.transport;
  if (!transport) {
    const token = await readSecret(botId, "telegram_token");
    if (!token) {
      await recordEvent(botId, "error", "token_missing", { ok: false });
      return;
    }
    transport = telegramTransport(token);
  }

  const botUser = await upsertBotUser(botId, chatId, from);
  if (botUser.blocked) return;

  // Har bir bot foydalanuvchisi uchun alohida chelak — bitta odam botni
  // to'ldirib yuborsa boshqalarga ta'sir qilmasin.
  const limit = rateLimit(`botuser:${botId}:${from.id}`, 20, 60_000);
  if (!limit.allowed) {
    await recordEvent(botId, "webhook", "rate_limited", { ok: false });
    return;
  }

  const ctx: RouterContext = {
    botId,
    botUserId: botUser.id,
    chatId,
    telegramUserId: String(from.id),
    transport,
    viewer: {
      telegramUserId: String(from.id),
      username: botUser.username,
      languageCode: botUser.languageCode,
      phone: botUser.phone,
      email: botUser.email,
      tags: botUser.tags,
      messageCount: botUser.messageCount,
      // Admin belgisi teg orqali beriladi: bot egasining Telegram hisobini
      // bilmaymiz, shuning uchun egasi kerakli odamga `admin` tegini qo'yadi.
      isAdmin: botUser.tags.includes("admin"),
    } satisfies ViewerContext,
    replyOptions: {},
    // Callback qaysi xabardan kelgani — menyuni joyida tahrirlash uchun (§1).
    ...(callback?.message?.message_id !== undefined
      ? { messageId: callback.message.message_id }
      : {}),
  };

  // Hodisadan avtomatlarga. Update id — takrorlanmas kalit, shuning uchun
  // bitta update bitta avtomatni ikki marta ishga tushira olmaydi.
  const eventKey = String(update.update_id ?? `${chatId}:${started}`);
  const automationContext = {
    user: {
      telegramUserId: ctx.telegramUserId,
      username: botUser.username,
      languageCode: botUser.languageCode,
      phone: botUser.phone,
      messageCount: botUser.messageCount,
      tags: botUser.tags,
    },
    ...(message?.text ? { message: { text: message.text } } : {}),
  };

  const fireAutomation = (trigger: Parameters<typeof dispatch>[0]["trigger"]) =>
    dispatch({
      botId,
      trigger,
      dedupeKey: `${trigger}:${eventKey}`,
      context: { event: { name: trigger }, ...automationContext },
      transport,
      chatId,
      botUserId: botUser.id,
    });

  if (botUser.isNew) await fireAutomation("user_joined");

  try {
    if (callback) {
      await routeCallback(ctx, callback.id, callback.data ?? "");
    } else if (message) {
      await handleMessage(ctx, message);
      const text = (message.text ?? "").trim();
      if (text.startsWith("/start")) {
        await fireAutomation("user_started");
      } else if (text) {
        await fireAutomation("message_received");
      }
    }
    await recordEvent(botId, "webhook", "handled", {
      ok: true,
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    const reason =
      error instanceof TelegramApiError || error instanceof Error
        ? error.message
        : "Noma'lum xato";
    await recordEvent(botId, "error", "handler_failed", {
      ok: false,
      latencyMs: Date.now() - started,
      detail: { reason },
    });
    await prisma.telegramBot.update({
      where: { id: botId },
      data: { lastError: reason.slice(0, 500) },
    });
  }

  // Faqat ko'rsatkich: update qayta ishlangandan keyin bot o'chirilgan bo'lsa
  // ham bu yozuv butun oqimni yiqitmasligi kerak.
  await prisma.telegramBot
    .update({ where: { id: botId }, data: { lastActiveAt: new Date() } })
    .catch(() => undefined);
}

/* ── Matnli xabar ────────────────────────────────────────────────────────── */

async function handleMessage(ctx: RouterContext, message: BotUpdateMessage): Promise<void> {
  const { content, kind } = extractContent(message);
  const text = (message.text ?? "").trim();

  await logMessage(ctx, "in", kind, content, { messageId: message.message_id });

  // 1. Mini App forma ma'lumotini qaytardi (`Telegram.WebApp.sendData()`).
  //    Ma'lumot yuqorida jurnalga `web_app_data` turi bilan yozildi, shuning
  //    uchun u yo'qolmaydi. Foydalanuvchiga qabul qilinganini aytamiz va
  //    menyuga qaytaramiz — «Tushunmadim» javobi noto'g'ri bo'lardi.
  if (message.web_app_data) {
    await replyWithRootMenu(ctx, botText(ctx.viewer.languageCode, "webAppReceived"));
    return;
  }

  // 2. Telegram so'ralgan kontakt yoki joylashuvni qaytardi.
  if (message.contact || message.location) {
    await routeSharedData(ctx, {
      phone: message.contact?.phone_number,
      latitude: message.location?.latitude,
      longitude: message.location?.longitude,
    });
    return;
  }

  // 3. Bot ismi/emailini kutayotgan bo'lsa — javob shu yerga tegishli.
  if (text && (await routePendingInput(ctx, text))) return;

  // 4. Buyruqlar.
  if (text.startsWith("/") && (await runCommand(ctx, text))) return;

  // 5. Reply klaviaturasidagi tugma.
  if (text && (await routeText(ctx, text))) return;

  // 6. Hech narsaga mos kelmadi — jim qolmaymiz va menyuni ko'rsatamiz (§14).
  await replyWithRootMenu(ctx, botText(ctx.viewer.languageCode, "notUnderstood"));
}

/* ── Buyruqlar ───────────────────────────────────────────────────────────── */

/**
 * Buyruqni bajaradi.
 *
 * Tartib: avval egasi sozlagan yozuv, so'ng ichki buyruqlar. Shu sababli
 * mavjud botlarning javoblari o'zgarmaydi, sozlanmagan buyruqlar esa endi
 * to'g'ri ekranni ochadi.
 */
async function runCommand(ctx: RouterContext, text: string): Promise<boolean> {
  // «/help@mening_botim arg» → «help»
  const raw = text.slice(1).split(/\s+/)[0] ?? "";
  const name = raw.split("@")[0].toLowerCase();
  if (!name) return false;

  const command = await prisma.telegramBotCommand.findUnique({
    where: { botId_command: { botId: ctx.botId, command: name } },
  });

  if (command?.enabled) {
    await prisma.telegramBotCommand.update({
      where: { id: command.id },
      data: { usageCount: { increment: 1 } },
    });

    const config = (command.actionConfig ?? {}) as { text?: string };
    const owner = config.text?.trim();

    // Egasi yozgan yordam matni ham tugmali ekranda chiqadi — yalang'och
    // matndan ko'ra tushunarli va undan chiqish yo'li bor.
    const screen = BUILT_IN_SCREENS[name];
    if (screen === "help") {
      await sendScreen(ctx, "help", owner);
      return true;
    }

    const reply = owner || welcomeText(ctx);

    // `/start` va `/menu` menyuni boshidan ko'rsatadi — tugma tarixi ham
    // tozalanadi, foydalanuvchi aniq nuqtadan boshlaydi.
    if ((name === "start" || name === "menu") && (await sendRootMenu(ctx, reply))) {
      return true;
    }

    await replyWithRootMenu(ctx, reply);
    return true;
  }
  if (command) return false;

  if (name === "start" || name === "menu") {
    if (await sendRootMenu(ctx, welcomeText(ctx))) return true;
    await replyWithRootMenu(ctx, welcomeText(ctx));
    return true;
  }

  const screen = BUILT_IN_SCREENS[name];
  if (screen) {
    await sendScreen(ctx, screen);
    return true;
  }

  return false;
}

/** `/start` javobi: egasi matn yozmagan bo'lsa tizim salomlashuvi. */
function welcomeText(ctx: RouterContext): string {
  return botText(ctx.viewer.languageCode, "welcome");
}

/**
 * Javobni yuboradi va ildiz menyusini biriktiradi.
 *
 * Menyu hali nashr etilmagan bo'lsa foydalanuvchi bo'sh ekranda qolmasligi
 * kerak: javobga botning holati ham qo'shiladi (§14).
 */
async function replyWithRootMenu(ctx: RouterContext, text: string): Promise<void> {
  const buttons = await loadPublished(ctx.botId);
  const clean = sanitizeText(text).slice(0, 4096);
  const view = rootView(buttons, {
    viewer: ctx.viewer,
    replyOptions: ctx.replyOptions,
    rootText: clean,
  });

  const hasMenu = view.visible.length > 0;
  const body = hasMenu
    ? clean
    : `${clean}\n\n${botText(ctx.viewer.languageCode, "notConfigured")}`.slice(0, 4096);

  const sent = await ctx.transport.send(ctx.chatId, body, {
    replyMarkup: hasMenu ? view.markup : undefined,
  });
  await logMessage(ctx, "out", "text", body, { messageId: sent.message_id });
}

/* ── Bot foydalanuvchisi va jurnal ───────────────────────────────────────── */

async function upsertBotUser(
  botId: string,
  chatId: string,
  from: NonNullable<BotUpdateMessage["from"]>,
) {
  const profile = {
    chatId,
    username: from.username ?? null,
    lastName: from.last_name ?? null,
    languageCode: from.language_code ?? null,
  };

  // `upsert` yozuv YANGI yaratilganini aytmaydi, `user_joined` triggeri esa
  // aynan shuni bilishi kerak.
  //
  // Shuning uchun avval qaraymiz (indeks bo'yicha, arzon), topilmasa
  // yaratamiz. Yaratish paytida poyga bo'lsa unikal cheklov ushlaydi —
  // ya'ni aniqlik yo'qolmaydi, lekin QAYTGAN foydalanuvchi uchun ortiqcha
  // xato logi ham chiqmaydi.
  const existing = await prisma.telegramBotUser.findUnique({
    where: { botId_telegramUserId: { botId, telegramUserId: String(from.id) } },
    select: { id: true },
  });

  if (!existing) {
    try {
      const created = await prisma.telegramBotUser.create({
        data: {
          botId,
          telegramUserId: String(from.id),
          firstName: from.first_name ?? null,
          ...profile,
        },
      });
      return { ...created, isNew: true };
    } catch (error) {
      // Bir vaqtda kelgan ikkinchi update — quyida yangilaymiz.
      if (!isUniqueViolation(error)) throw error;
    }
  }

  const updated = await prisma.telegramBotUser.update({
    where: { botId_telegramUserId: { botId, telegramUserId: String(from.id) } },
    // `firstName` yangilanmaydi: `collect_name` bilan kiritilgan ism
    // Telegram profilidagi qiymat bilan qayta yozilib ketmasin.
    data: { ...profile, lastActiveAt: new Date() },
  });
  return { ...updated, isNew: false };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function logMessage(
  ctx: RouterContext,
  direction: "in" | "out",
  messageType: string,
  content: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await prisma.telegramBotMessage.create({
    data: {
      botId: ctx.botId,
      botUserId: ctx.botUserId,
      telegramUserId: ctx.telegramUserId,
      direction,
      messageType,
      content: content.slice(0, 4096),
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  if (direction === "in") {
    await prisma.telegramBotUser.update({
      where: { id: ctx.botUserId },
      data: { messageCount: { increment: 1 } },
    });
  }
}

/** Kelgan xabardan matn ajratib olish — media uchun qisqa tavsif. */
function extractContent(message: BotUpdateMessage): {
  content: string;
  kind: string;
} {
  if (message.text) return { content: message.text, kind: "text" };
  // Mini App javobi matndan oldin tekshiriladi: u ham matn, lekin alohida
  // tur — jurnalda forma ma'lumoti sifatida ajralib tursin.
  if (message.web_app_data) {
    return { content: message.web_app_data.data, kind: "web_app_data" };
  }
  if (message.photo) return { content: message.caption || "[rasm]", kind: "photo" };
  if (message.document) {
    return {
      content: message.caption || `[hujjat: ${message.document.file_name ?? "fayl"}]`,
      kind: "document",
    };
  }
  if (message.voice) return { content: "[ovozli xabar]", kind: "voice" };
  if (message.sticker) {
    return { content: message.sticker.emoji || "[stiker]", kind: "sticker" };
  }
  if (message.location) {
    return {
      content: `[joylashuv: ${message.location.latitude}, ${message.location.longitude}]`,
      kind: "location",
    };
  }
  if (message.contact) return { content: "[kontakt]", kind: "contact" };
  return { content: "[qo'llab-quvvatlanmaydigan xabar]", kind: "unsupported" };
}
