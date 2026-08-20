import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { WorkspaceError, type WorkspaceContext } from "@/lib/workspace";
import { automationSchema, type AutomationInput } from "@/lib/automation/types";

/**
 * Avtomat CRUD (§P4.1 PHASE 8–11, 24).
 *
 * HAR BIR amal `workspaceId` orqali tekshiriladi: begona ish maydonining
 * avtomat id'sini bilgan odam unga tegib ham, ko'rib ham bo'lmaydi.
 * Tekshiruv bazadagi `bot.workspaceId` bo'yicha — UI'ga ishonilmaydi.
 */

/** Bitta ish maydonida ko'pi bilan shuncha avtomat. */
export const MAX_AUTOMATIONS = 100;

export type AutomationStatus = "draft" | "published" | "disabled";

/** Avtomatni SHU ish maydoni ichidan topadi. */
async function requireAutomation(ctx: WorkspaceContext, id: string) {
  const row = await prisma.telegramBotAutomation.findFirst({
    where: { id, bot: { workspaceId: ctx.workspaceId } },
    select: { id: true, botId: true, status: true, name: true },
  });
  // Begona avtomat uchun ham «topilmadi» — mavjudligi oshkor bo'lmasin.
  if (!row) throw new WorkspaceError("Avtomat topilmadi", 404);
  return row;
}

/** Bot shu ish maydoniga tegishlimi. */
async function requireBot(ctx: WorkspaceContext, botId: string) {
  const bot = await prisma.telegramBot.findFirst({
    where: { id: botId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!bot) throw new WorkspaceError("Bot topilmadi", 404);
  return bot;
}

export async function listAutomations(ctx: WorkspaceContext) {
  const rows = await prisma.telegramBotAutomation.findMany({
    where: { bot: { workspaceId: ctx.workspaceId } },
    orderBy: { createdAt: "desc" },
    take: MAX_AUTOMATIONS,
    select: {
      id: true,
      name: true,
      trigger: true,
      status: true,
      lastRunAt: true,
      runCount: true,
      createdAt: true,
      bot: { select: { id: true, name: true } },
    },
  });

  // Muvaffaqiyat foizi bajarilish yozuvlaridan — taxmin qilinmaydi.
  const stats = await prisma.telegramBotAutomationRun.groupBy({
    by: ["automationId", "status"],
    where: { automation: { bot: { workspaceId: ctx.workspaceId } } },
    _count: { _all: true },
  });

  return rows.map((row) => {
    const mine = stats.filter((s) => s.automationId === row.id);
    const total = mine.reduce((sum, s) => sum + s._count._all, 0);
    const completed =
      mine.find((s) => s.status === "completed")?._count._all ?? 0;
    const failed = mine.find((s) => s.status === "failed")?._count._all ?? 0;
    const skipped = mine.find((s) => s.status === "skipped")?._count._all ?? 0;
    return {
      ...row,
      runs: total,
      completed,
      failed,
      skipped,
      // Bajarilish bo'lmasa foiz ko'rsatilmaydi — 0% chalg'ituvchi bo'lardi.
      successRate: total > 0 ? Math.round((completed / total) * 100) : null,
    };
  });
}

export async function getAutomation(ctx: WorkspaceContext, id: string) {
  await requireAutomation(ctx, id);
  return prisma.telegramBotAutomation.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      trigger: true,
      triggerConfig: true,
      conditions: true,
      actions: true,
      status: true,
      lastRunAt: true,
      runCount: true,
      createdAt: true,
      bot: { select: { id: true, name: true } },
      runs: {
        orderBy: { startedAt: "desc" },
        take: 25,
        select: {
          id: true,
          triggerEvent: true,
          status: true,
          actionsRun: true,
          failedAction: true,
          error: true,
          durationMs: true,
          startedAt: true,
        },
      },
    },
  });
}

export async function createAutomation(
  ctx: WorkspaceContext,
  botId: string,
  input: AutomationInput,
) {
  await requireBot(ctx, botId);

  const count = await prisma.telegramBotAutomation.count({
    where: { bot: { workspaceId: ctx.workspaceId } },
  });
  if (count >= MAX_AUTOMATIONS) {
    throw new WorkspaceError(`Ko'pi bilan ${MAX_AUTOMATIONS} ta avtomat`, 409);
  }

  const parsed = automationSchema.parse(input);
  return prisma.telegramBotAutomation.create({
    data: {
      botId,
      name: parsed.name,
      trigger: parsed.trigger,
      triggerConfig: parsed.triggerConfig as Prisma.InputJsonValue,
      conditions: parsed.conditions as Prisma.InputJsonValue,
      actions: parsed.actions as Prisma.InputJsonValue,
      // Yangi avtomat HAR DOIM qoralama — kutilmaganda ishga tushmasin.
      status: "draft",
      enabled: false,
    },
    select: { id: true, name: true, status: true },
  });
}

export async function updateAutomation(
  ctx: WorkspaceContext,
  id: string,
  input: AutomationInput,
) {
  await requireAutomation(ctx, id);
  const parsed = automationSchema.parse(input);

  return prisma.telegramBotAutomation.update({
    where: { id },
    data: {
      name: parsed.name,
      trigger: parsed.trigger,
      triggerConfig: parsed.triggerConfig as Prisma.InputJsonValue,
      conditions: parsed.conditions as Prisma.InputJsonValue,
      actions: parsed.actions as Prisma.InputJsonValue,
    },
    select: { id: true, name: true, status: true },
  });
}

/**
 * Holatni o'zgartirish.
 *
 * Nashrdan OLDIN server konfiguratsiyani QAYTA tekshiradi — UI validatsiyasi
 * yagona to'siq bo'lib qolmasin.
 */
export async function setStatus(
  ctx: WorkspaceContext,
  id: string,
  status: AutomationStatus,
) {
  const row = await requireAutomation(ctx, id);

  if (status === "published") {
    const full = await prisma.telegramBotAutomation.findUnique({
      where: { id: row.id },
      select: { name: true, trigger: true, triggerConfig: true, conditions: true, actions: true },
    });
    const check = automationSchema.safeParse(full);
    if (!check.success) {
      throw new WorkspaceError(
        "Avtomat to'liq emas — nashr to'xtatildi",
        422,
      );
    }
  }

  return prisma.telegramBotAutomation.update({
    where: { id },
    data: { status, enabled: status === "published" },
    select: { id: true, status: true },
  });
}

export async function duplicateAutomation(ctx: WorkspaceContext, id: string) {
  const row = await requireAutomation(ctx, id);
  const source = await prisma.telegramBotAutomation.findUnique({
    where: { id: row.id },
    select: {
      botId: true,
      name: true,
      trigger: true,
      triggerConfig: true,
      conditions: true,
      actions: true,
    },
  });
  if (!source) throw new WorkspaceError("Avtomat topilmadi", 404);

  return prisma.telegramBotAutomation.create({
    data: {
      botId: source.botId,
      name: `${source.name} (nusxa)`.slice(0, 80),
      trigger: source.trigger,
      // Baza `JsonValue` beradi, Prisma yozishda `InputJsonValue` kutadi.
      // `null` bo'lishi mumkin bo'lgan maydonlar standart qiymatga tushadi.
      triggerConfig: (source.triggerConfig ?? {}) as Prisma.InputJsonValue,
      conditions: (source.conditions ?? {}) as Prisma.InputJsonValue,
      actions: (source.actions ?? []) as Prisma.InputJsonValue,
      // Nusxa ham qoralama — asl nusxa nashr etilgan bo'lsa ham.
      status: "draft",
      enabled: false,
    },
    select: { id: true, name: true, status: true },
  });
}

/**
 * O'chirish.
 *
 * Bajarilish yozuvlari `onDelete: Cascade` bilan birga ketadi — ular aynan
 * shu avtomatga tegishli va boshqa hech qayerda ishlatilmaydi. Audit
 * jurnali (`telegram_bot_events`) esa alohida jadvalda va TEGILMAYDI.
 */
export async function deleteAutomation(ctx: WorkspaceContext, id: string) {
  const row = await requireAutomation(ctx, id);
  await prisma.telegramBotAutomation.delete({ where: { id: row.id } });
}
