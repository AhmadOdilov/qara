import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { botScope, can, guardWorkspace } from "@/lib/workspace";
import { describeSecrets } from "@/lib/bots/secrets";
import {
  BotServiceError,
  deleteBot,
  replaceToken,
  requireBot,
  setBotPaused,
  updateBot,
} from "@/lib/bots/service";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ botId: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  description: z.string().trim().max(512).nullable().optional(),
  shortDescription: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().max(32).optional(),
  developerMode: z.boolean().optional(),
  // Alohida amallar — bir so'rovda faqat bittasi kutiladi.
  paused: z.boolean().optional(),
  token: z
    .string()
    .trim()
    .regex(/^\d{6,12}:[A-Za-z0-9_-]{30,}$/, "Token formati noto'g'ri")
    .optional(),
});

/** Bitta botning to'liq holati — sozlash sahifasi uchun. */
export async function GET(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:read" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  try {
    await requireBot(botId, botScope(auth.ctx));

    const [bot, commands, buttons, secrets] = await Promise.all([
      // `webhookSecret` ataylab tanlanmaydi — u faqat server tomonda kerak.
      prisma.telegramBot.findUniqueOrThrow({
        where: { id: botId },
        omit: { webhookSecret: true },
        include: { _count: { select: { botUsers: true, botMessages: true } } },
      }),
      prisma.telegramBotCommand.findMany({
        where: { botId },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.telegramBotButton.findMany({
        where: { botId },
        orderBy: { sortOrder: "asc" },
      }),
      describeSecrets(botId),
    ]);

    const { _count, ...safe } = bot;

    return ok({
      bot: safe,
      commands,
      buttons,
      secrets,
      stats: {
        userCount: _count.botUsers,
        messageCount: _count.botMessages,
      },
    });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

/** Profil maydonlari, to'xtatish/yoqish yoki tokenni almashtirish. */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  const parsed = await parseBody(request, patchSchema);
  if ("response" in parsed) return parsed.response;

  const { paused, token, ...fields } = parsed.data;
  const ip = clientIp(request);
  const scope = botScope(auth.ctx);

  try {
    if (token) {
      // Token — sir. `bot:edit` yetarli emas, alohida huquq talab qilinadi.
      if (!can(auth.ctx.role, "secret:write")) {
        return fail("Tokenni almashtirish uchun ruxsat yo'q", 403);
      }
      const { bot, webhook } = await replaceToken(botId, scope, token, ip);
      return ok({ bot: { id: bot.id, status: bot.status }, webhook });
    }

    if (paused !== undefined) {
      const bot = await setBotPaused(botId, scope, paused, ip);
      return ok({ bot: { id: bot.id, status: bot.status } });
    }

    if (Object.keys(fields).length === 0) {
      return fail("O'zgartirish uchun maydon berilmadi", 400);
    }

    const bot = await updateBot(botId, scope, fields, ip);
    return ok({ bot: { id: bot.id, name: bot.name, status: bot.status } });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

/** Botni butunlay o'chirish — Telegram'dagi webhook ham olib tashlanadi. */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:delete" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  try {
    await deleteBot(botId, botScope(auth.ctx), clientIp(request));
    return ok({ ok: true });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
