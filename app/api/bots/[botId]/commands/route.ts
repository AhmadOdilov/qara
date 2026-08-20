import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { audit } from "@/lib/bots/audit";
import { BotServiceError, requireBot, syncCommands } from "@/lib/bots/service";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ botId: string }> };

/**
 * Telegram cheklovi: buyruq 1–32 belgi, faqat kichik harf, raqam va pastki chiziq.
 * Slash bilan kiritilsa ham qabul qilamiz — saqlashda olib tashlanadi.
 */
const commandSchema = z.object({
  command: z
    .string()
    .trim()
    .transform((value) => value.replace(/^\//, "").toLowerCase())
    .pipe(
      z
        .string()
        .min(1, "Buyruq bo'sh bo'lmasin")
        .max(32)
        .regex(/^[a-z0-9_]+$/, "Faqat a-z, 0-9 va _ ishlatiladi"),
    ),
  description: z.string().trim().min(1).max(256),
  text: z.string().trim().min(1).max(4096),
  enabled: z.boolean().default(true),
});

const putSchema = z.object({
  commands: z.array(commandSchema).max(100),
});

/**
 * Buyruqlar ro'yxatini butunlay almashtiradi va Telegram menyusiga yozadi.
 *
 * To'liq almashtirish tanlandi: ro'yxat kichik va UI uni yaxlit tahrirlaydi,
 * shuning uchun har bir qatorni alohida sinxronlashdan ko'ra soddaroq.
 */
export async function PUT(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  const parsed = await parseBody(request, putSchema);
  if ("response" in parsed) return parsed.response;

  const { commands } = parsed.data;

  const seen = new Set<string>();
  for (const item of commands) {
    if (seen.has(item.command)) {
      return fail(`Buyruq takrorlanmoqda: /${item.command}`, 422);
    }
    seen.add(item.command);
  }

  try {
    await requireBot(botId, botScope(auth.ctx));

    await prisma.$transaction([
      prisma.telegramBotCommand.deleteMany({ where: { botId } }),
      prisma.telegramBotCommand.createMany({
        data: commands.map((item, index) => ({
          botId,
          command: item.command,
          description: item.description,
          enabled: item.enabled,
          actionType: "send_message",
          actionConfig: { text: item.text },
          sortOrder: index,
        })),
      }),
    ]);

    await syncCommands(botId);
    await audit("COMMANDS_UPDATED", {
      botId,
      actorId: auth.ctx.user.id,
      ip: clientIp(request),
      metadata: { count: commands.length },
    });

    const saved = await prisma.telegramBotCommand.findMany({
      where: { botId },
      orderBy: { sortOrder: "asc" },
    });
    return ok({ commands: saved });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
