import type { Prisma } from "@prisma/client";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { audit } from "@/lib/bots/audit";
import { BotServiceError, requireBot } from "@/lib/bots/service";
import { updateButtonSchema } from "@/lib/bots/buttons/schema";
import { newCallbackId } from "@/lib/bots/buttons/types";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ botId: string; buttonId: string }> };

async function ownedButton(botId: string, buttonId: string) {
  const button = await prisma.telegramBotButton.findFirst({
    where: { id: buttonId, botId },
  });
  if (!button) throw new BotServiceError("Tugma topilmadi", 404);
  return button;
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId, buttonId } = await params;

  const parsed = await parseBody(request, updateButtonSchema);
  if ("response" in parsed) return parsed.response;
  const patch = parsed.data;

  try {
    await requireBot(botId, botScope(auth.ctx));
    const current = await ownedButton(botId, buttonId);

    // Tugma o'zining avlodiga ko'chirilsa daraxt halqaga aylanadi.
    if (patch.parentId !== undefined && patch.parentId !== null) {
      if (patch.parentId === buttonId) return fail("Tugma o'ziga bo'ysuna olmaydi", 422);
      if (await isDescendant(botId, patch.parentId, buttonId)) {
        return fail("Tugmani o'z ichki menyusiga ko'chirib bo'lmaydi", 422);
      }
    }

    const button = await prisma.telegramBotButton.update({
      where: { id: buttonId },
      data: {
        ...(patch.text !== undefined ? { text: patch.text } : {}),
        ...(patch.emoji !== undefined ? { emoji: patch.emoji } : {}),
        ...(patch.parentId !== undefined ? { parentId: patch.parentId } : {}),
        ...(patch.keyboardKind !== undefined ? { keyboardKind: patch.keyboardKind } : {}),
        ...(patch.buttonType !== undefined ? { buttonType: patch.buttonType } : {}),
        ...(patch.actionType !== undefined ? { actionType: patch.actionType } : {}),
        ...(patch.actionConfig !== undefined
          ? { actionConfig: patch.actionConfig as Prisma.InputJsonValue }
          : {}),
        ...(patch.rowIndex !== undefined ? { rowIndex: patch.rowIndex } : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        ...(patch.visibility !== undefined
          ? { visibility: patch.visibility as Prisma.InputJsonValue }
          : {}),
        ...(patch.conditions !== undefined
          ? { conditions: patch.conditions as Prisma.InputJsonValue }
          : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.adminOnly !== undefined ? { adminOnly: patch.adminOnly } : {}),
        // Eski yozuvlarda callback bo'lmasligi mumkin — shu yerda to'ldiramiz.
        ...(current.callbackId ? {} : { callbackId: newCallbackId() }),
      },
    });

    await audit("BUTTONS_UPDATED", {
      botId,
      actorId: auth.ctx.user.id,
      ip: clientIp(request),
      metadata: { updated: buttonId },
    });

    return ok({ button });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

/** Nusxalash (§19). Ichki menyusi bilan birga ko'chiriladi. */
export async function POST(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId, buttonId } = await params;

  if (new URL(request.url).searchParams.get("action") !== "duplicate") {
    return fail("action=duplicate bo'lishi kerak", 400);
  }

  try {
    await requireBot(botId, botScope(auth.ctx));
    const source = await ownedButton(botId, buttonId);

    const copyId = await copySubtree(botId, source, source.parentId, `${source.text} (nusxa)`);

    await audit("BUTTONS_UPDATED", {
      botId,
      actorId: auth.ctx.user.id,
      ip: clientIp(request),
      metadata: { duplicated: buttonId, into: copyId },
    });

    return ok({ id: copyId }, { status: 201 });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId, buttonId } = await params;

  try {
    await requireBot(botId, botScope(auth.ctx));
    await ownedButton(botId, buttonId);

    // Ichki tugmalar `onDelete: Cascade` bilan o'zi ketadi.
    await prisma.telegramBotButton.delete({ where: { id: buttonId } });

    await audit("BUTTONS_UPDATED", {
      botId,
      actorId: auth.ctx.user.id,
      ip: clientIp(request),
      metadata: { deleted: buttonId },
    });

    return ok({ ok: true });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

/* ── Yordamchilar ────────────────────────────────────────────────────────── */

/** `candidate` `ancestorId` ning avlodimi? Halqani oldini olish uchun. */
async function isDescendant(
  botId: string,
  candidate: string,
  ancestorId: string,
): Promise<boolean> {
  // Ilgari bu yerda halqa ichida so'rov bor edi — chuqurlikka qarab 20 tagacha
  // ketma-ket murojaat. Botning butun daraxti bitta so'rovda o'qiladi va
  // yurish xotirada bajariladi: menyu daraxti kichik (yuzlab tugma), lekin
  // so'rovlar soni endi chuqurlikka bog'liq emas.
  const rows = await prisma.telegramBotButton.findMany({
    where: { botId },
    select: { id: true, parentId: true },
  });
  const parentOf = new Map(rows.map((row) => [row.id, row.parentId]));

  let current: string | null = candidate;
  // Chegara saqlanadi: ma'lumot buzilib halqa hosil bo'lsa cheksiz aylanmasin.
  for (let depth = 0; current && depth < 20; depth += 1) {
    if (current === ancestorId) return true;
    current = parentOf.get(current) ?? null;
  }
  return false;
}

type ButtonRow = Awaited<ReturnType<typeof ownedButton>>;

/** Tugmani va uning butun ichki daraxtini yangi id'lar bilan nusxalaydi. */
async function copySubtree(
  botId: string,
  source: ButtonRow,
  parentId: string | null,
  textOverride?: string,
): Promise<string> {
  const last = await prisma.telegramBotButton.findFirst({
    where: { botId, parentId, rowIndex: source.rowIndex },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const copy = await prisma.telegramBotButton.create({
    data: {
      botId,
      parentId,
      text: (textOverride ?? source.text).slice(0, 64),
      emoji: source.emoji,
      keyboardKind: source.keyboardKind,
      buttonType: source.buttonType,
      actionType: source.actionType,
      actionConfig: source.actionConfig as Prisma.InputJsonValue,
      rowIndex: source.rowIndex,
      sortOrder: last ? last.sortOrder + 1 : 0,
      visibility: source.visibility as Prisma.InputJsonValue,
      conditions: source.conditions as Prisma.InputJsonValue,
      enabled: source.enabled,
      adminOnly: source.adminOnly,
      callbackId: newCallbackId(),
    },
  });

  const children = await prisma.telegramBotButton.findMany({
    where: { botId, parentId: source.id },
    orderBy: [{ rowIndex: "asc" }, { sortOrder: "asc" }],
  });
  for (const child of children) {
    await copySubtree(botId, child, copy.id);
  }

  return copy.id;
}
