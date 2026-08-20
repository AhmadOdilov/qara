import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/bots/audit";
import {
  BotServiceError,
  requireBot,
  requireBotToken,
  type BotScope,
} from "@/lib/bots/service";
import { setChatMenuButtonForBot, TelegramApiError } from "@/lib/bots/telegram-api";
import { invalidateTree } from "@/lib/bots/buttons/cache";
import { newCallbackId } from "@/lib/bots/buttons/types";
import { miniAppHostingAvailable, miniAppUrl, requireMiniApp } from "@/lib/mini-app/service";

/**
 * Mini App'ni botga ulash — «qayerdan ochiladi» degan savol (§8).
 *
 * Uch yo'l bor va ular BIR-BIRIDAN MUSTAQIL:
 *
 *   menu     — chatdagi «≡» menyu tugmasi. Telegram'da `setChatMenuButton`
 *              bilan o'rnatiladi, ya'ni HAQIQIY API chaqiruvi ketadi.
 *   inline   — xabar ostidagi inline tugma (`web_app` turi).
 *   keyboard — klaviaturadagi tugma.
 *
 * Inline va keyboard oddiy tugma yozuvi bo'lib `telegram_bot_buttons` ga
 * tushadi — ya'ni mavjud konstruktor, nashr va navigatsiya tizimidan
 * foydalanadi, alohida mexanizm qurilmaydi.
 */

/** Ildizdagi Mini App tugmasini shu belgi bo'yicha topamiz. */
const LAUNCH_MARKER = "miniApp";

export type LaunchState = {
  menu: boolean;
  menuText: string;
  inline: boolean;
  keyboard: boolean;
  url: string;
  /// Telegram HTTPS talab qiladi — lokal manzilda ulab bo'lmaydi
  available: boolean;
};

export async function readLaunchState(
  botId: string,
  scope: BotScope,
): Promise<LaunchState> {
  const app = await requireMiniApp(botId, scope);
  const bot = await prisma.telegramBot.findUniqueOrThrow({
    where: { id: botId },
    select: { menuButtonType: true, menuButtonText: true },
  });

  const buttons = await launchButtons(botId);

  return {
    menu: bot.menuButtonType === "web_app",
    menuText: bot.menuButtonText || "Ochish",
    inline: buttons.some((button) => button.keyboardKind === "inline"),
    keyboard: buttons.some((button) => button.keyboardKind === "reply"),
    url: miniAppUrl(app.id),
    available: miniAppHostingAvailable(),
  };
}

function launchButtons(botId: string) {
  return prisma.telegramBotButton.findMany({
    where: {
      botId,
      parentId: null,
      actionType: "open_mini_app",
      // Konstruktorda qo'lda qo'yilgan Mini App tugmalariga tegmaymiz —
      // faqat shu panel yaratgan yozuvlar boshqariladi.
      actionConfig: { path: ["source"], equals: LAUNCH_MARKER },
    },
  });
}

export type LaunchPatch = {
  menu?: boolean;
  menuText?: string;
  inline?: boolean;
  keyboard?: boolean;
};

/**
 * Ishga tushirish nuqtalarini yangilaydi.
 *
 * Menyu tugmasi Telegram'da darhol o'rnatiladi; inline/keyboard tugmalari esa
 * qoralamaga tushadi va odatdagidek «Nashr etish» bilan jonli botga chiqadi —
 * shu sababli natija foydalanuvchi uchun kutilgan bo'lib qoladi.
 */
export async function updateLaunch(
  botId: string,
  scope: BotScope,
  patch: LaunchPatch,
): Promise<LaunchState & { needsPublish: boolean }> {
  const bot = await requireBot(botId, scope);
  const app = await requireMiniApp(botId, scope);

  if (app.status !== "published") {
    throw new BotServiceError("Avval Mini App'ni nashr eting", 409);
  }
  if (!miniAppHostingAvailable()) {
    throw new BotServiceError(
      "Telegram Mini App'ni faqat HTTPS manzildan ochadi. APP_URL ni tunnel manziliga o'zgartiring.",
      409,
    );
  }

  const url = miniAppUrl(app.id);
  const text = (patch.menuText ?? bot.menuButtonText ?? "Ochish").trim().slice(0, 64) || "Ochish";
  let needsPublish = false;

  /* Menyu tugmasi — Telegram tomonida */
  if (patch.menu !== undefined) {
    const token = await requireBotToken(botId);
    try {
      await setChatMenuButtonForBot(
        token,
        patch.menu ? { type: "web_app", text, url } : { type: "commands" },
      );
    } catch (error) {
      const reason =
        error instanceof TelegramApiError ? error.message : "Telegram javob bermadi";
      throw new BotServiceError(`Menyu tugmasi o'rnatilmadi: ${reason}`, 502);
    }

    await prisma.telegramBot.update({
      where: { id: botId },
      data: {
        menuButtonType: patch.menu ? "web_app" : "commands",
        menuButtonText: patch.menu ? text : null,
        menuButtonUrl: patch.menu ? url : null,
        miniAppEnabled: patch.menu,
        miniAppName: patch.menu ? app.name : null,
        miniAppUrl: patch.menu ? url : null,
      },
    });
  }

  /* Inline va keyboard — qoralamadagi tugma yozuvlari */
  for (const kind of ["inline", "reply"] as const) {
    const wanted = kind === "inline" ? patch.inline : patch.keyboard;
    if (wanted === undefined) continue;

    const existing = (await launchButtons(botId)).filter(
      (button) => button.keyboardKind === kind,
    );

    if (wanted && existing.length === 0) {
      await prisma.telegramBotButton.create({
        data: {
          botId,
          parentId: null,
          text,
          emoji: "🚀",
          keyboardKind: kind,
          // Reply klaviaturada `mini_app` turi yo'q — u oddiy matn tugmasi
          // bo'lib chiqadi, amal esa o'zgarmaydi.
          buttonType: kind === "inline" ? "mini_app" : "text",
          actionType: "open_mini_app",
          actionConfig: { url, source: LAUNCH_MARKER } as Prisma.InputJsonValue,
          rowIndex: await nextRow(botId),
          sortOrder: 0,
          callbackId: newCallbackId(),
        },
      });
      needsPublish = true;
    }

    if (!wanted && existing.length > 0) {
      await prisma.telegramBotButton.deleteMany({
        where: { id: { in: existing.map((button) => button.id) } },
      });
      needsPublish = true;
    }

    // Manzil yoki yorliq o'zgargan bo'lsa mavjud tugma yangilanadi.
    if (wanted && existing.length > 0) {
      const stale = existing.filter(
        (button) =>
          (button.actionConfig as { url?: string })?.url !== url || button.text !== text,
      );
      if (stale.length > 0) {
        await prisma.telegramBotButton.updateMany({
          where: { id: { in: stale.map((button) => button.id) } },
          data: { text, actionConfig: { url, source: LAUNCH_MARKER } },
        });
        needsPublish = true;
      }
    }
  }

  if (needsPublish) invalidateTree(botId);

  await audit("BOT_UPDATED", {
    botId,
    actorId: scope.actorId,
    metadata: { miniAppLaunch: patch },
  });

  return { ...(await readLaunchState(botId, scope)), needsPublish };
}

async function nextRow(botId: string): Promise<number> {
  const last = await prisma.telegramBotButton.aggregate({
    where: { botId, parentId: null },
    _max: { rowIndex: true },
  });
  return last._max.rowIndex === null ? 0 : last._max.rowIndex + 1;
}
