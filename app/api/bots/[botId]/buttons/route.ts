import type { Prisma } from "@prisma/client";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { audit } from "@/lib/bots/audit";
import { BotServiceError, requireBot } from "@/lib/bots/service";
import { createButtonSchema } from "@/lib/bots/buttons/schema";
import { loadBuilderState } from "@/lib/bots/buttons/store";
import { newCallbackId } from "@/lib/bots/buttons/types";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ botId: string }> };

/** Konstruktor uchun to'liq holat: qoralama, nashr farqi va analitika. */
export async function GET(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:read" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  try {
    await requireBot(botId, botScope(auth.ctx));
    return ok(await loadBuilderState(botId));
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

/** Yangi tugma. Callback identifikatorini har doim server beradi. */
export async function POST(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  const parsed = await parseBody(request, createButtonSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  try {
    await requireBot(botId, botScope(auth.ctx));

    if (input.parentId) {
      const parent = await prisma.telegramBotButton.findFirst({
        where: { id: input.parentId, botId },
        select: { id: true },
      });
      if (!parent) return fail("Ota tugma topilmadi", 422);
    }

    // Yangi tugma o'z qatorining oxiriga tushadi.
    const last = await prisma.telegramBotButton.findFirst({
      where: { botId, parentId: input.parentId ?? null, rowIndex: input.rowIndex },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const button = await prisma.telegramBotButton.create({
      data: {
        botId,
        parentId: input.parentId ?? null,
        text: input.text,
        emoji: input.emoji ?? null,
        keyboardKind: input.keyboardKind,
        buttonType: input.buttonType,
        actionType: input.actionType,
        actionConfig: input.actionConfig as Prisma.InputJsonValue,
        rowIndex: input.rowIndex,
        sortOrder: last ? last.sortOrder + 1 : 0,
        visibility: input.visibility as Prisma.InputJsonValue,
        conditions: input.conditions as Prisma.InputJsonValue,
        enabled: input.enabled,
        adminOnly: input.adminOnly,
        callbackId: newCallbackId(),
      },
    });

    await audit("BUTTONS_UPDATED", {
      botId,
      actorId: auth.ctx.user.id,
      ip: clientIp(request),
      metadata: { created: button.id, text: button.text },
    });

    return ok({ button }, { status: 201 });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
