import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  blueprintSchema,
  BUSINESS_KINDS,
  FEATURES,
  type Blueprint,
  type BlueprintMenuItem,
  type BusinessKind,
  type FeatureId,
} from "@/lib/ai/blueprint";
import { ACTION_TYPES } from "@/lib/bots/buttons/types";
import { BotServiceError, requireBot, type BotScope } from "@/lib/bots/service";
import { audit } from "@/lib/bots/audit";

/**
 * Botni KONFIGURATSIYADAN nusxalash (§28, §10).
 *
 * Nima uchun botning o'zi klonlanmaydi: Telegram bot identifikatori
 * (`telegramBotId`) — bitta BotFather tokeni bilan bog'langan yagona qiymat va
 * u bazada `@unique`. Ya'ni "ikkinchi nusxa bot" degan narsa Telegram
 * tomonida umuman mavjud emas: har bir bot uchun @BotFather'da alohida token
 * olinadi.
 *
 * Shuning uchun nusxalash mazmuni boshqacha: menyular, tugmalar, buyruqlar,
 * javob matnlari va AI sozlamasi YANGI QORALAMAGA ko'chiriladi, token esa
 * ko'chirilmaydi. Foydalanuvchi keyin o'zining yangi tokenini ulaydi va
 * qoralama jonli botga aylanadi.
 *
 * Amalda bu mavjud oqimning o'ziga tushadi: natija — `BotBlueprint` qoralamasi,
 * uni `/build/<planId>` sahifasi ochadi va `applyBlueprint` yozadi. Yangi
 * "tokensiz bot" holati o'ylab topilmaydi — yarim tayyor yozuvlar bo'lmaydi.
 */

const FEATURE_IDS = new Set<string>(FEATURES.map((f) => f.id));
const KINDS = new Set<string>(BUSINESS_KINDS);
const ACTIONS = new Set<string>(ACTION_TYPES);

/** Tugma yozuvidan reja bandiga: faqat rejada ma'noga ega maydonlar. */
type ButtonRow = {
  id: string;
  parentId: string | null;
  text: string;
  emoji: string | null;
  actionType: string;
  actionConfig: Prisma.JsonValue;
  sortOrder: number;
};

/** `actionConfig` dagi javob matni. Boshqa amallarda matn bo'lmasligi normal. */
function replyOf(config: Prisma.JsonValue): string {
  if (config && typeof config === "object" && !Array.isArray(config)) {
    const text = (config as Record<string, unknown>).text;
    if (typeof text === "string") return text.slice(0, 1024);
  }
  return "";
}

/**
 * Reja sxemasi faqat ma'lum amallarni biladi. Notanish amal `send_message` ga
 * tushiriladi — nusxa yarim buzuq bo'lgandan ko'ra soddaroq bo'lgani yaxshi.
 */
function actionOf(value: string): BlueprintMenuItem["actionType"] {
  return (
    ACTIONS.has(value) ? value : "send_message"
  ) as BlueprintMenuItem["actionType"];
}

/**
 * Bot menyusidan reja daraxtini yig'adi.
 *
 * Reja sxemasi ikki qatlam bilan cheklangan (`menu[].children[]`), jonli
 * daraxt esa chuqurroq bo'lishi mumkin. Chuqurroq shoxlar tushirib
 * qoldiriladi — chaqiruvchi buni foydalanuvchiga ochiq aytadi.
 */
export function buildMenuFromButtons(rows: ButtonRow[]): {
  menu: BlueprintMenuItem[];
  droppedDeeper: number;
} {
  const byParent = new Map<string | null, ButtonRow[]>();
  for (const row of rows) {
    const list = byParent.get(row.parentId) ?? [];
    list.push(row);
    byParent.set(row.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  let droppedDeeper = 0;
  const countDeeper = (parentId: string): number => {
    const kids = byParent.get(parentId) ?? [];
    return kids.reduce((total, kid) => total + 1 + countDeeper(kid.id), 0);
  };

  const roots = (byParent.get(null) ?? []).slice(0, 12);

  const menu: BlueprintMenuItem[] = roots.map((root) => {
    const children = (byParent.get(root.id) ?? []).slice(0, 10);

    for (const child of children) droppedDeeper += countDeeper(child.id);

    return {
      text: root.text.slice(0, 64),
      emoji: root.emoji ?? "",
      actionType: actionOf(root.actionType),
      reply: replyOf(root.actionConfig),
      children: children.map((child) => ({
        text: child.text.slice(0, 64),
        emoji: child.emoji ?? "",
        actionType: actionOf(child.actionType),
        reply: replyOf(child.actionConfig),
      })),
    };
  });

  return { menu, droppedDeeper };
}

export type DuplicateResult = {
  planId: string;
  /** Nusxaga tushmagan chuqur shoxlar soni — UI ogohlantirishi uchun. */
  droppedDeeper: number;
  buttonCount: number;
  commandCount: number;
};

/**
 * Botning joriy sozlamasidan yangi qoralama reja yasaydi.
 *
 * KO'CHIRILADI: nom, tavsif, kategoriya, funksiyalar, buyruqlar, menyu
 * daraxti, javob matnlari, AI sozlamasi.
 *
 * KO'CHIRILMAYDI: Telegram tokeni va boshqa sirlar, webhook sozlamasi,
 * bot foydalanuvchilari, xabarlar tarixi va analitika. Ular manba botga
 * tegishli va nusxaga o'tishi mumkin emas.
 */
export async function duplicateBotConfig(
  botId: string,
  scope: BotScope,
  opts: { name?: string } = {},
): Promise<DuplicateResult> {
  // Kirish huquqi shu yerda tekshiriladi: begona workspace boti uchun
  // `requireBot` 404 beradi va mavjudligini ham oshkor qilmaydi.
  const bot = await requireBot(botId, scope);

  const [commands, buttons, aiConfig] = await Promise.all([
    prisma.telegramBotCommand.findMany({
      where: { botId },
      orderBy: { sortOrder: "asc" },
      select: { command: true, description: true, actionConfig: true },
    }),
    prisma.telegramBotButton.findMany({
      where: { botId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        parentId: true,
        text: true,
        emoji: true,
        actionType: true,
        actionConfig: true,
        sortOrder: true,
      },
    }),
    prisma.telegramBotAiConfig.findUnique({ where: { botId } }),
  ]);

  const { menu, droppedDeeper } = buildMenuFromButtons(buttons);

  const planCommands = commands
    .filter((command) => /^[a-z][a-z0-9_]{0,30}$/.test(command.command))
    .slice(0, 20)
    .map((command) => ({
      command: command.command,
      description: command.description?.slice(0, 120) || command.command,
      reply: replyOf(command.actionConfig),
    }));

  const start = planCommands.find((command) => command.command === "start");
  const welcomeMessage =
    start?.reply?.trim() ||
    `👋 Assalomu alaykum! Men — ${bot.name}.\n\nQuyidagi menyudan kerakli bo'limni tanlang 👇`;

  const draft: Blueprint = {
    // Nomi ataylab o'zgaradi: ro'yxatda ikkita bir xil nom turmasin.
    name: (opts.name?.trim() || `${bot.name} (nusxa)`).slice(0, 64),
    description: bot.description?.slice(0, 512) ?? "",
    shortDescription: bot.shortDescription?.slice(0, 120) ?? "",
    businessKind: (KINDS.has(bot.category) ? bot.category : "other") as BusinessKind,
    language: "uz",
    welcomeMessage: welcomeMessage.slice(0, 1024),
    features: bot.features.filter((id): id is FeatureId => FEATURE_IDS.has(id)),
    commands: planCommands,
    menu,
    ai: {
      enabled: aiConfig?.enabled ?? false,
      systemPrompt: aiConfig?.systemPrompt?.slice(0, 4000) ?? "",
      personality: (["friendly", "professional", "concise", "playful"].includes(
        aiConfig?.personality ?? "",
      )
        ? aiConfig!.personality
        : "friendly") as Blueprint["ai"]["personality"],
      webSearch: false,
      knowledgeBase: false,
    },
    integrations: [],
    automations: [],
  };

  // Reja bazaga yozilishidan oldin O'ZIMIZNING sxemamiz bilan tekshiriladi:
  // jonli botda sxemaga sig'maydigan qiymat bo'lsa, u shu yerda ushlanadi va
  // buzuq qoralama saqlanmaydi.
  const parsed = blueprintSchema.safeParse(draft);
  if (!parsed.success) {
    throw new BotServiceError(
      "Bu botning sozlamasidan nusxa tayyorlab bo'lmadi. Menyuni tekshirib qaytadan urining.",
      422,
    );
  }

  const blueprint = await prisma.botBlueprint.create({
    data: {
      workspaceId: scope.workspaceId,
      createdById: scope.actorId,
      prompt: `«${bot.name}» botidan nusxa`,
      source: "rule_based",
      templateId: null,
      plan: parsed.data as unknown as Prisma.InputJsonValue,
      status: "draft",
    },
    select: { id: true },
  });

  await audit("BOT_UPDATED", {
    botId,
    actorId: scope.actorId,
    metadata: {
      event: "duplicated_config",
      planId: blueprint.id,
      buttonCount: buttons.length,
      commandCount: planCommands.length,
      droppedDeeper,
    },
  });

  return {
    planId: blueprint.id,
    droppedDeeper,
    buttonCount: buttons.length,
    commandCount: planCommands.length,
  };
}
