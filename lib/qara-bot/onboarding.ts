import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { InlineKeyboard } from "@/lib/telegram";
import {
  BUSINESS_TYPES,
  CB,
  CHANNELS,
  GOALS,
  mark,
  say,
  type BotLang,
} from "@/lib/qara-bot/script";
import { planBot } from "@/lib/ai/planner";
import { featureLabel, type Blueprint } from "@/lib/ai/blueprint";
import { ensureAccount, createClaimUrl } from "@/lib/qara-bot/claim";
import { track } from "@/lib/analytics";

/**
 * Onboarding suhbati (§6–§9, §41).
 *
 * Holat bazada (`OnboardingSession`) turadi, `callback_data` da emas —
 * shunda kod 64 baytga sig'adi va unga hech qanday ma'lumot chiqmaydi (§57).
 *
 * Har qadam bitta narsa qaytaradi: ko'rsatiladigan matn va tugmalar.
 * Yuborishni router qiladi — shu sabab bu modul Telegram API'ni bilmaydi
 * va sinovda toza chaqiriladi.
 */

export type Answers = {
  goals?: string[];
  channels?: string[];
  hasProducts?: boolean;
  freeText?: string;
};

export type Step = {
  text: string;
  keyboard?: InlineKeyboard;
  /** Bosilgan tugmani javob bilan almashtirish o'rniga yangi xabar yuborish. */
  asNewMessage?: boolean;
};

type SessionRow = Prisma.OnboardingSessionGetPayload<object>;

/* ── Sessiya ─────────────────────────────────────────────────────────────── */

export async function loadSession(input: {
  telegramUserId: string;
  chatId: string;
  lang: BotLang;
}): Promise<SessionRow> {
  return prisma.onboardingSession.upsert({
    where: { telegramUserId: input.telegramUserId },
    update: { chatId: input.chatId },
    create: {
      telegramUserId: input.telegramUserId,
      chatId: input.chatId,
      lang: input.lang,
    },
  });
}

function answersOf(session: SessionRow): Answers {
  return (session.answers ?? {}) as Answers;
}

async function patch(
  session: SessionRow,
  data: Prisma.OnboardingSessionUpdateInput,
): Promise<SessionRow> {
  return prisma.onboardingSession.update({ where: { id: session.id }, data });
}

/* ── Savollar ────────────────────────────────────────────────────────────── */

/** 1-savol: biznes turi. */
export function askBusinessType(lang: BotLang): Step {
  return {
    text: `${say("q1", lang)}\n\n${say("q1Free", lang)}`,
    keyboard: {
      inline_keyboard: chunk(
        BUSINESS_TYPES.map((type) => ({
          text: type.label[lang],
          callback_data: CB.businessType(type.id),
        })),
        2,
      ),
    },
  };
}

/** 2-savol: maqsadlar (ko'p tanlovli, «Davom etish» bilan yakunlanadi). */
export function askGoals(lang: BotLang, selected: string[]): Step {
  const rows = chunk(
    GOALS.map((goal) => ({
      text: mark(goal.label[lang], selected.includes(goal.id)),
      callback_data: CB.goal(goal.id),
    })),
    2,
  );

  // Kamida bitta tanlanmaguncha davom etish tugmasi chiqmaydi — bo'sh
  // javob bilan o'tib ketilmasin.
  if (selected.length > 0) {
    rows.push([
      {
        text: lang === "ru" ? "➡️ Продолжить" : lang === "en" ? "➡️ Continue" : "➡️ Davom etish",
        callback_data: CB.goalsDone,
      },
    ]);
  }

  return { text: say("q2", lang), keyboard: { inline_keyboard: rows } };
}

/** 3-savol: joriy kanallar. */
export function askChannels(lang: BotLang): Step {
  return {
    text: say("q3", lang),
    keyboard: {
      inline_keyboard: chunk(
        CHANNELS.map((channel) => ({
          text: channel.label[lang],
          callback_data: CB.channel(channel.id),
        })),
        2,
      ),
    },
  };
}

/** 4-savol: mahsulot bormi. */
export function askHasProducts(lang: BotLang): Step {
  const yes = lang === "ru" ? "✅ Да" : lang === "en" ? "✅ Yes" : "✅ Ha";
  const no = lang === "ru" ? "➖ Нет" : lang === "en" ? "➖ Not yet" : "➖ Yo'q";
  return {
    text: say("q4", lang),
    keyboard: {
      inline_keyboard: [
        [
          { text: yes, callback_data: CB.hasProducts(true) },
          { text: no, callback_data: CB.hasProducts(false) },
        ],
      ],
    },
  };
}

/* ── Javoblarni qabul qilish ─────────────────────────────────────────────── */

export async function setBusinessType(
  session: SessionRow,
  typeId: string,
): Promise<{ session: SessionRow; next: Step }> {
  const type = BUSINESS_TYPES.find((item) => item.id === typeId);
  const updated = await patch(session, {
    businessType: type?.kind ?? "other",
    businessDescription: type?.label[session.lang as BotLang] ?? typeId,
    currentStep: "goals",
  });
  return { session: updated, next: askGoals(lang(updated), []) };
}

/** Erkin matn — ro'yxatda yo'q biznes turi. */
export async function setBusinessFromText(
  session: SessionRow,
  text: string,
): Promise<{ session: SessionRow; next: Step }> {
  const updated = await patch(session, {
    businessDescription: text.slice(0, 500),
    // Turini AI/qoida qatlami matndan o'zi aniqlaydi — bu yerda taxmin qilmaymiz.
    businessType: null,
    currentStep: "goals",
  });
  return { session: updated, next: askGoals(lang(updated), []) };
}

export async function toggleGoal(
  session: SessionRow,
  goalId: string,
): Promise<{ session: SessionRow; next: Step }> {
  const current = answersOf(session);
  const goals = new Set(current.goals ?? []);
  if (goals.has(goalId)) goals.delete(goalId);
  else goals.add(goalId);

  const updated = await patch(session, {
    answers: { ...current, goals: [...goals] } as Prisma.InputJsonValue,
  });
  return { session: updated, next: askGoals(lang(updated), [...goals]) };
}

export async function finishGoals(
  session: SessionRow,
): Promise<{ session: SessionRow; next: Step }> {
  const updated = await patch(session, { currentStep: "channels" });
  return { session: updated, next: askChannels(lang(updated)) };
}

export async function setChannel(
  session: SessionRow,
  channelId: string,
): Promise<{ session: SessionRow; next: Step }> {
  const current = answersOf(session);
  const updated = await patch(session, {
    answers: { ...current, channels: [channelId] } as Prisma.InputJsonValue,
    businessStage: channelId === "none" ? "idea" : "running",
    currentStep: "has_products",
  });
  return { session: updated, next: askHasProducts(lang(updated)) };
}

export async function setHasProducts(
  session: SessionRow,
  hasProducts: boolean,
): Promise<SessionRow> {
  const current = answersOf(session);
  return patch(session, {
    answers: { ...current, hasProducts } as Prisma.InputJsonValue,
    currentStep: "plan",
  });
}

/* ── Reja (§8) ───────────────────────────────────────────────────────────── */

/**
 * Yig'ilgan javoblardan bot rejasini tuzadi.
 *
 * Reja veb tomondagi bilan BIR XIL generator orqali o'tadi — Telegramda
 * boshlangan onboarding dashboardda tabiiy davom etadi.
 */
export async function buildPlan(session: SessionRow): Promise<{
  session: SessionRow;
  blueprint: Blueprint;
  source: string;
}> {
  const answers = answersOf(session);
  const prompt = describeBusiness(session, answers);

  const result = await planBot({
    prompt,
    templateId: session.businessType,
    language: lang(session),
  });

  // Hisob va ish maydoni faqat shu paytda yaratiladi: odam suhbatni
  // tugatgan, ya'ni haqiqiy niyat bor.
  const account = await ensureAccount({
    telegramUserId: session.telegramUserId,
    chatId: session.chatId,
    lang: lang(session),
  });

  const draft = await prisma.botBlueprint.create({
    data: {
      workspaceId: account.workspaceId,
      createdById: account.userId,
      prompt,
      source: result.source,
      templateId: session.businessType,
      plan: result.blueprint as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  const updated = await patch(session, {
    userId: account.userId,
    workspaceId: account.workspaceId,
    blueprintId: draft.id,
    status: "planned",
    currentStep: "plan",
  });

  await track("onboarding_plan_generated", account.userId, {
    via: "telegram",
    source: result.source,
    businessType: session.businessType ?? "auto",
  });

  return { session: updated, blueprint: result.blueprint, source: result.source };
}

/** Reja xulosasini Telegram xabari sifatida chiroyli yozadi (§8). */
export function renderPlan(blueprint: Blueprint, lang: BotLang): string {
  const featureLines = blueprint.features
    .map((id) => {
      const feature = featureLabel(id);
      return `${feature.emoji} ${feature.label}`;
    })
    .join("\n");

  const menuLines = blueprint.menu
    .map((item) => `${item.emoji} ${item.text}`.trim())
    .join("\n");

  const automationLines = blueprint.automations
    .map((automation) => `• ${automation.name}`)
    .join("\n");

  const headings =
    lang === "ru"
      ? { biz: "ВАШ БИЗНЕС", rec: "Рекомендуем", bot: "Telegram-бот", auto: "Автоматизации" }
      : lang === "en"
        ? { biz: "YOUR BUSINESS", rec: "Recommended", bot: "Telegram bot", auto: "Automations" }
        : { biz: "BIZNESINGIZ", rec: "Tavsiya etamiz", bot: "Telegram bot", auto: "Avtomatlashtirish" };

  const parts = [
    `📊 ${headings.biz}\n${blueprint.name}`,
    `✨ ${headings.rec}\n${featureLines}`,
    `🤖 ${headings.bot}\n/start\n${menuLines}`,
  ];
  if (automationLines) parts.push(`⚡ ${headings.auto}\n${automationLines}`);

  return parts.join("\n\n");
}

/** Reja tasdiqlash tugmalari (§9). */
export function planKeyboard(lang: BotLang): InlineKeyboard {
  const labels =
    lang === "ru"
      ? { build: "🚀 Создать всё", edit: "✏️ Изменить", cancel: "❌ Отмена" }
      : lang === "en"
        ? { build: "🚀 Build everything", edit: "✏️ Edit plan", cancel: "❌ Cancel" }
        : { build: "🚀 Hammasini yaratish", edit: "✏️ Tahrirlash", cancel: "❌ Bekor qilish" };

  return {
    inline_keyboard: [
      [{ text: labels.build, callback_data: CB.planBuild }],
      [
        { text: labels.edit, callback_data: CB.planEdit },
        { text: labels.cancel, callback_data: CB.planCancel },
      ],
    ],
  };
}

/**
 * Tasdiqlangandan keyin: dashboardga bir martalik havola (§10).
 * Havola tugma sifatida yuboriladi — matnda emas.
 */
export async function approvePlan(session: SessionRow): Promise<Step> {
  if (!session.userId || !session.blueprintId) {
    return { text: say("needAccount", lang(session)) };
  }

  const url = await createClaimUrl({
    userId: session.userId,
    telegramUserId: session.telegramUserId,
    chatId: session.chatId,
    next: `/build/${session.blueprintId}`,
  });

  await patch(session, { status: "approved", currentStep: "done" });
  await track("onboarding_completed", session.userId, { via: "telegram" });

  return {
    text: say("ready", lang(session)),
    keyboard: {
      inline_keyboard: [[{ text: say("openQara", lang(session)), url }]],
    },
    asNewMessage: true,
  };
}

/* ── Yordamchilar ────────────────────────────────────────────────────────── */

function lang(session: SessionRow): BotLang {
  return (session.lang as BotLang) ?? "uz";
}

/**
 * Javoblarni reja generatoriga tushunarli bitta tavsifga aylantiradi.
 * Shu matn blueprint'ning `prompt` maydonida ham saqlanadi — keyin
 * dashboardda "nima so'ralgan edi" ko'rinib turadi.
 */
function describeBusiness(session: SessionRow, answers: Answers): string {
  const parts: string[] = [];

  if (session.businessDescription) parts.push(session.businessDescription);

  if (answers.goals?.length) {
    const labels = answers.goals
      .map((id) => GOALS.find((goal) => goal.id === id)?.label.uz ?? id)
      .join(", ");
    parts.push(`Telegram orqali: ${labels}`);
  }

  if (answers.channels?.length) {
    const labels = answers.channels
      .map((id) => CHANNELS.find((channel) => channel.id === id)?.label.uz ?? id)
      .join(", ");
    parts.push(`Hozir ishlaydi: ${labels}`);
  }

  if (answers.hasProducts !== undefined) {
    parts.push(
      answers.hasProducts ? "Mahsulot/xizmat tayyor." : "Mahsulot hali tayyor emas.",
    );
  }

  if (answers.freeText) parts.push(answers.freeText);

  return parts.join(". ");
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}
