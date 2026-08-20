import "server-only";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/api";
import { track } from "@/lib/analytics";
import {
  answerCallback,
  editMessage,
  sendMessage,
  type InlineKeyboard,
  type TelegramCallbackQuery,
  type TelegramMessage,
} from "@/lib/telegram";
import { langFromTelegram } from "@/lib/i18n/dictionaries";
import { CB, say, type BotLang } from "@/lib/qara-bot/script";
import {
  approvePlan,
  askBusinessType,
  buildPlan,
  finishGoals,
  loadSession,
  planKeyboard,
  renderPlan,
  setBusinessFromText,
  setBusinessType,
  setChannel,
  setHasProducts,
  toggleGoal,
  type Step,
} from "@/lib/qara-bot/onboarding";
import { createClaimUrl } from "@/lib/qara-bot/claim";

/**
 * Rasmiy Qara botining marshrutlagichi (§5, §29, §63).
 *
 * Ikki kirish nuqtasi bor: matnli xabar va tugma bosilishi. Ikkalasi ham
 * `OnboardingSession` holatiga qarab keyingi qadamni tanlaydi.
 *
 * Telegram webhookdan tez javob kutadi, shuning uchun bu yerda og'ir ish
 * qilinmaydi — AI chaqiruvi faqat foydalanuvchi «reja tuz» deganda bo'ladi
 * va u paytda avval "o'ylayapman" xabari yuboriladi (§56).
 */

/* ── Bosh menyu (§5) ─────────────────────────────────────────────────────── */

function mainMenu(lang: BotLang): InlineKeyboard {
  const labels =
    lang === "ru"
      ? {
          create: "✨ Создать бизнес",
          bot: "🤖 Создать AI-бота",
          store: "🛍 Telegram-магазин",
          automation: "⚡ Автоматизация",
          demo: "🎨 Посмотреть демо",
          ai: "💬 Qara AI",
        }
      : lang === "en"
        ? {
            create: "✨ Build my business",
            bot: "🤖 Create AI bot",
            store: "🛍 Telegram Store",
            automation: "⚡ Automation",
            demo: "🎨 See a demo",
            ai: "💬 Qara AI",
          }
        : {
            create: "✨ Biznesimni yaratish",
            bot: "🤖 AI Bot yaratish",
            store: "🛍 Telegram Store",
            automation: "⚡ Automation",
            demo: "🎨 Demo ko'rish",
            ai: "💬 Qara AI",
          };

  return {
    inline_keyboard: [
      [{ text: labels.create, callback_data: CB.onboardStart }],
      [
        { text: labels.bot, callback_data: CB.createBot },
        { text: labels.store, callback_data: CB.createStore },
      ],
      [
        { text: labels.automation, callback_data: CB.automation },
        { text: labels.demo, callback_data: CB.demo },
      ],
      [{ text: labels.ai, callback_data: CB.ai }],
    ],
  };
}

/* ── Matnli xabar ────────────────────────────────────────────────────────── */

export async function routeMessage(message: TelegramMessage): Promise<void> {
  const from = message.from;
  if (!from || from.is_bot) return;

  const chatId = String(message.chat.id);
  const telegramUserId = String(from.id);
  const lang = langFromTelegram(from.language_code) as BotLang;
  const text = (message.text ?? "").trim();

  // Bir odam botni to'ldirib yubormasin.
  const limit = rateLimit(`qara-bot:${telegramUserId}`, 30, 60_000);
  if (!limit.allowed) return;

  const session = await loadSession({ telegramUserId, chatId, lang });

  // /start [payload] — deep link marshrutlari (§24)
  if (text.startsWith("/start")) {
    const payload = text.split(/\s+/)[1]?.trim() ?? "";
    await handleStart(telegramUserId, chatId, session.lang as BotLang, payload);
    return;
  }

  if (text.startsWith("/create")) {
    await send(chatId, await startOnboarding(telegramUserId, chatId, lang));
    return;
  }

  if (text.startsWith("/help")) {
    await sendMessage(chatId, say("help", session.lang as BotLang));
    return;
  }

  if (text.startsWith("/bots") || text.startsWith("/settings")) {
    await sendOpenDashboard(session.id, telegramUserId, chatId, session.lang as BotLang);
    return;
  }

  if (text.startsWith("/ai")) {
    await sendMessage(chatId, say("aiSoon", session.lang as BotLang), {
      replyMarkup: mainMenu(session.lang as BotLang),
    });
    return;
  }

  // Onboarding «biznes turi» qadamida erkin matn ham qabul qilinadi (§40):
  // ro'yxatda yo'q biznesni odam o'z so'zi bilan yozadi.
  if (session.currentStep === "business_type" && text.length > 1) {
    const { next } = await setBusinessFromText(session, text);
    await send(chatId, next);
    return;
  }

  // Boshqa har qanday matn — menyuga qaytaramiz. Jim qolmaymiz.
  await sendMessage(chatId, say("menuTitle", session.lang as BotLang), {
    replyMarkup: mainMenu(session.lang as BotLang),
  });
}

async function handleStart(
  telegramUserId: string,
  chatId: string,
  lang: BotLang,
  payload: string,
): Promise<void> {
  await track("telegram_started", null, { payload: payload || "none" });

  // Deep link payloadlari (§24). Hech qanday sir kutilmaydi — faqat
  // qisqa, oldindan ma'lum kalit so'zlar.
  if (payload === "onboarding" || payload === "bot" || payload === "store") {
    await send(chatId, await startOnboarding(telegramUserId, chatId, lang));
    return;
  }

  if (payload === "demo") {
    await sendMessage(chatId, say("demoSoon", lang), { replyMarkup: mainMenu(lang) });
    return;
  }

  await sendMessage(chatId, say("welcome", lang), { replyMarkup: mainMenu(lang) });
}

/* ── Tugma bosilishi ─────────────────────────────────────────────────────── */

export async function routeCallback(query: TelegramCallbackQuery): Promise<void> {
  const from = query.from;
  const chatId = String(query.message?.chat.id ?? from.id);
  const telegramUserId = String(from.id);
  const messageId = query.message?.message_id;
  const data = query.data ?? "";

  // Telegram tugmani darhol "bo'shatishini" kutadi.
  await answerCallback(query.id);

  const limit = rateLimit(`qara-bot:${telegramUserId}`, 30, 60_000);
  if (!limit.allowed) return;

  const lang = langFromTelegram(from.language_code) as BotLang;
  let session = await loadSession({ telegramUserId, chatId, lang });
  const active = session.lang as BotLang;

  /* Onboarding boshlanishi */
  if (data === CB.onboardStart || data === CB.createBot || data === CB.createStore) {
    await replace(chatId, messageId, await startOnboarding(telegramUserId, chatId, active));
    return;
  }

  /* 1-savol javobi */
  if (data.startsWith("ob:biz:")) {
    const result = await setBusinessType(session, data.slice("ob:biz:".length));
    await replace(chatId, messageId, result.next);
    return;
  }

  /* 2-savol: ko'p tanlovli */
  if (data.startsWith("ob:goal:")) {
    const result = await toggleGoal(session, data.slice("ob:goal:".length));
    await replace(chatId, messageId, result.next);
    return;
  }

  if (data === CB.goalsDone) {
    const result = await finishGoals(session);
    await replace(chatId, messageId, result.next);
    return;
  }

  /* 3-savol */
  if (data.startsWith("ob:ch:")) {
    const result = await setChannel(session, data.slice("ob:ch:".length));
    await replace(chatId, messageId, result.next);
    return;
  }

  /* 4-savol → reja */
  if (data.startsWith("ob:prod:")) {
    session = await setHasProducts(session, data.endsWith(":y"));

    // AI chaqiruvi sekin bo'lishi mumkin — avval holatni ko'rsatamiz (§56).
    await replace(chatId, messageId, { text: say("thinking", active) });

    const { blueprint } = await buildPlan(session);
    await sendMessage(
      chatId,
      `${say("understood", active)}\n\n${say("planIntro", active)}\n\n${renderPlan(
        blueprint,
        active,
      )}\n\n${say("planAsk", active)}`,
      { replyMarkup: planKeyboard(active) },
    );
    return;
  }

  /* Reja qarorlari (§9) */
  if (data === CB.planBuild) {
    await send(chatId, await approvePlan(session));
    return;
  }

  if (data === CB.planEdit) {
    await sendMessage(chatId, say("editHint", active));
    await send(chatId, await approvePlan(session));
    return;
  }

  if (data === CB.planCancel) {
    await prisma.onboardingSession.update({
      where: { id: session.id },
      data: { status: "abandoned" },
    });
    await replace(chatId, messageId, {
      text: say("cancelled", active),
      keyboard: mainMenu(active),
    });
    return;
  }

  /* Menyu bo'limlari */
  if (data === CB.demo) {
    await replace(chatId, messageId, {
      text: say("demoSoon", active),
      keyboard: mainMenu(active),
    });
    return;
  }

  if (data === CB.ai) {
    await replace(chatId, messageId, {
      text: say("aiSoon", active),
      keyboard: mainMenu(active),
    });
    return;
  }

  if (data === CB.automation) {
    await sendOpenDashboard(session.id, telegramUserId, chatId, active);
    return;
  }

  if (data === CB.menu) {
    await replace(chatId, messageId, {
      text: say("menuTitle", active),
      keyboard: mainMenu(active),
    });
  }
}

/* ── Yordamchilar ────────────────────────────────────────────────────────── */

async function startOnboarding(
  telegramUserId: string,
  chatId: string,
  lang: BotLang,
): Promise<Step> {
  const session = await loadSession({ telegramUserId, chatId, lang });
  await prisma.onboardingSession.update({
    where: { id: session.id },
    data: { currentStep: "business_type", status: "active" },
  });
  await track("onboarding_started", session.userId, { via: "telegram" });
  return askBusinessType(session.lang as BotLang);
}

/**
 * Hisobi bor odamni dashboardga yuboradi; yo'q bo'lsa avval onboarding.
 * Havola har safar yangi va bir martalik (§10).
 */
async function sendOpenDashboard(
  sessionId: string,
  telegramUserId: string,
  chatId: string,
  lang: BotLang,
): Promise<void> {
  const session = await prisma.onboardingSession.findUnique({ where: { id: sessionId } });

  if (!session?.userId) {
    await sendMessage(chatId, say("needAccount", lang));
    await send(chatId, await startOnboarding(telegramUserId, chatId, lang));
    return;
  }

  const url = await createClaimUrl({
    userId: session.userId,
    telegramUserId,
    chatId,
    next: "/dashboard",
  });

  await sendMessage(chatId, say("openQara", lang), {
    replyMarkup: { inline_keyboard: [[{ text: say("openQara", lang), url }]] },
  });
}

async function send(chatId: string, step: Step): Promise<void> {
  await sendMessage(chatId, step.text, { replyMarkup: step.keyboard });
}

/** Bosilgan xabarni o'rniga yangilaydi; imkoni bo'lmasa yangisini yuboradi. */
async function replace(
  chatId: string,
  messageId: number | undefined,
  step: Step,
): Promise<void> {
  if (messageId && !step.asNewMessage) {
    try {
      await editMessage(chatId, messageId, step.text, { replyMarkup: step.keyboard });
      return;
    } catch {
      // Xabar juda eski yoki o'zgarmagan bo'lishi mumkin — yangisini yuboramiz.
    }
  }
  await send(chatId, step);
}
