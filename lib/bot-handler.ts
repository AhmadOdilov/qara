import "server-only";
import { prisma } from "@/lib/db";
import { sanitizeText, rateLimit } from "@/lib/api";
import { track } from "@/lib/analytics";
import {
  extractContent,
  sendMessage,
  type TelegramMessage,
  type TelegramUpdate,
} from "@/lib/telegram";
import {
  dictionaries,
  fill,
  langFromTelegram,
  LANG_LABELS,
} from "@/lib/i18n/dictionaries";
import { routeCallback, routeMessage } from "@/lib/qara-bot/router";

async function botSettings() {
  return prisma.botSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

/**
 * Botga kelgan bitta update'ni qayta ishlaydi.
 * Webhook ham, mock simulyator ham shu funksiyani chaqiradi — bot mantig'i
 * bitta joyda turadi va ikki yo'l bir xil natija beradi.
 */
export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  // Tugma bosilishi — butunlay yangi Qara boti oqimiga tegishli.
  if (update.callback_query) {
    await routeCallback(update.callback_query);
    return;
  }

  const message = update.message ?? update.edited_message;
  if (!message?.from || message.from.is_bot) return;

  const chatId = String(message.chat.id);
  const telegramUserId = String(message.from.id);
  const lang = langFromTelegram(message.from.language_code);
  const settings = await botSettings();

  if (settings.maintenanceMode) {
    await sendMessage(chatId, dictionaries[lang].bot.maintenance);
    return;
  }

  const text = (message.text ?? "").trim();

  const link = await prisma.telegramLink.findUnique({
    where: { telegramChatId: chatId },
    include: { user: true },
  });

  /*
    Ikkita oqim bitta botda yashaydi:

    1. BOG'LANGAN hisob — eski xatti-harakat saqlanadi: matn veb chatga
       uzatiladi, /help, /settings, /unlink ishlaydi. Bu Qara Chat'ning
       ishlashi uchun zarur va buzilmasligi kerak.

    2. BOG'LANMAGAN chat — yangi onboarding boti. Ilgari bu holatda bot
       "avval hisobingizni bog'lang" deb to'xtatib qo'yardi; endi u yerdan
       biznes yaratish suhbati boshlanadi.
  */
  if (!link) {
    // `/start <token>` — veb-ilovadagi «Telegramni bog'lash» havolasi.
    // Bog'lash onboarding botidan USTUN turadi: aks holda foydalanuvchi
    // havolani bosgani bilan hisob hech qachon bog'lanmasdi, chunki
    // bog'lanmagan chat to'g'ridan-to'g'ri onboardingga ketardi.
    if (text.startsWith("/start") && (await linkAccount(message, chatId, telegramUserId))) {
      return;
    }
    await routeMessage(message);
    return;
  }

  if (text.startsWith("/start")) {
    await sendMessage(chatId, dictionaries[link.user.lang].bot.alreadyLinked);
    return;
  }

  if (text.startsWith("/help")) {
    await sendMessage(chatId, dictionaries[link.user.lang].bot.help);
    return;
  }

  if (text.startsWith("/settings")) {
    const dict = dictionaries[link.user.lang];
    await sendMessage(
      chatId,
      fill(dict.bot.settings, {
        lang: LANG_LABELS[link.user.lang],
        quiet: link.user.quietHours ? dict.common.on : dict.common.off,
      }),
    );
    return;
  }

  if (text.startsWith("/unlink")) {
    const userLang = link.user.lang;
    await prisma.telegramLink.delete({ where: { id: link.id } });
    await track("telegram_unlinked", link.userId, { via: "bot" });
    await sendMessage(chatId, dictionaries[userLang].bot.unlinked);
    return;
  }

  const limit = rateLimit(
    `bot:${chatId}`,
    settings.rateLimitPerMin,
    60_000,
  );
  if (!limit.allowed) {
    await sendMessage(chatId, dictionaries[link.user.lang].bot.rateLimited);
    return;
  }

  const { content, kind } = extractContent(message);
  await prisma.message.create({
    data: {
      userId: link.userId,
      telegramUserId,
      telegramMsgId: message.message_id,
      direction: "incoming",
      fromUser: false, // Telegram tomonidan kelgan xabar
      content: sanitizeText(content).slice(0, 4096),
      kind,
      status: "sent",
      timestamp: new Date(message.date * 1000),
    },
  });
  await track("message_received", link.userId, { kind });

  if (settings.autoReply) {
    await sendMessage(chatId, settings.autoReply, {
      silent: link.user.quietHours,
    });
  }
}

/**
 * `/start <token>` — deep link orqali hisobni bog'lash.
 *
 * Token bir martalik: ishlatilgach yangisi bilan almashtiriladi.
 *
 * Bog'lash amalga oshsa `true`, payload bog'lash tokeni bo'lmasa `false`
 * qaytaradi. `false` bo'lganda chaqiruvchi chatni onboarding botiga uzatadi —
 * shu sababli `?start=demo` kabi marketing havolalari ham ishlayveradi va
 * bo'sh `/start` yangi odamni suhbat boshiga olib boradi.
 */
async function linkAccount(
  message: TelegramMessage,
  chatId: string,
  telegramUserId: string,
): Promise<boolean> {
  const payload = (message.text ?? "").trim().split(/\s+/)[1]?.trim();
  if (!payload) return false;

  const pending = await prisma.telegramLink.findUnique({
    where: { linkToken: payload },
    include: { user: true },
  });

  if (!pending || pending.linkTokenExp < new Date() || pending.connectedAt) {
    return false;
  }

  const settings = await botSettings();
  const userLang = pending.user.lang;

  await prisma.telegramLink.update({
    where: { id: pending.id },
    data: {
      telegramChatId: chatId,
      telegramUserId,
      username: message.from?.username ?? null,
      firstName: message.from?.first_name ?? null,
      languageCode: message.from?.language_code ?? null,
      connectedAt: new Date(),
      // Ishlatilgan token qayta yaramasin.
      linkToken: `used_${pending.id}_${Date.now()}`,
      linkTokenExp: new Date(),
    },
  });

  await track("telegram_linked", pending.userId, { chatId });

  const welcome = settings.welcomeMessage?.trim()
    ? settings.welcomeMessage
    : fill(dictionaries[userLang].bot.welcome, { name: pending.user.name });

  const sent = await sendMessage(chatId, welcome);

  // Salomlashish xabari chat tarixida ham ko'rinsin. Vaqt Telegram
  // qaytargan `date`dan olinadi — kiruvchi xabarlar bilan bir xil manba,
  // shunda tartib sekund aniqligida ham to'g'ri chiqadi.
  await prisma.message.create({
    data: {
      userId: pending.userId,
      telegramUserId,
      telegramMsgId: sent.message_id,
      direction: "incoming",
      fromUser: false,
      content: welcome,
      kind: "text",
      status: "sent",
      ...(sent.date ? { timestamp: new Date(sent.date * 1000) } : {}),
    },
  });

  return true;
}
