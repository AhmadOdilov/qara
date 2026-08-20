import { z } from "zod";
import { clientIp, fail, ok, parseBody, rateLimit } from "@/lib/api";
import { can, guardWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { blueprintSchema } from "@/lib/ai/blueprint";
import { applyBlueprint } from "@/lib/ai/apply";
import { BotServiceError, createBot } from "@/lib/bots/service";

type Params = { params: Promise<{ planId: string }> };

const schema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{6,12}:[A-Za-z0-9_-]{30,}$/, "Token formati noto'g'ri"),
});

/**
 * Qoralama rejani jonli botga aylantirish (§52 5-qadam).
 *
 * Bu — butun oqimdagi yagona joy, u yerda Telegram'ga chiqiladi va bot
 * yaratiladi. Shu paytgacha hech narsa tashqariga ketmagan.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:create" });
  if ("response" in auth) return auth.response;
  const { ctx } = auth;

  // Token yozish — alohida huquq (§57).
  if (!can(ctx.role, "secret:write")) {
    return fail("Bot tokenini kiritish uchun ruxsat yo'q", 403);
  }

  const { planId } = await params;

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  const limit = rateLimit(`ai:apply:${ctx.user.id}`, 10, 60_000);
  if (!limit.allowed) return fail("Juda ko'p urinish. Biroz kuting.", 429);

  const draft = await prisma.botBlueprint.findFirst({
    where: { id: planId, workspaceId: ctx.workspaceId },
  });
  if (!draft) return fail("Reja topilmadi", 404);
  if (draft.status === "applied" && draft.botId) {
    return fail("Bu reja allaqachon qo'llangan", 409, { botId: draft.botId });
  }

  // Reja bazadan keladi — baribir qayta tekshiramiz: sxema o'zgargan
  // bo'lishi yoki yozuv qo'lda tahrirlangan bo'lishi mumkin.
  const blueprint = blueprintSchema.safeParse(draft.plan);
  if (!blueprint.success) {
    return fail("Reja buzilgan — qaytadan yarating", 422);
  }

  const ip = clientIp(request);

  try {
    const { bot, webhook } = await createBot({
      workspaceId: ctx.workspaceId,
      ownerId: ctx.user.id,
      token: parsed.data.token,
      name: blueprint.data.name,
      description: blueprint.data.description,
      category: blueprint.data.businessKind,
      ip,
    });

    const applied = await applyBlueprint({
      botId: bot.id,
      blueprint: blueprint.data,
      actorId: ctx.user.id,
    });

    await prisma.botBlueprint.update({
      where: { id: draft.id },
      data: { status: "applied", botId: bot.id },
    });

    return ok(
      {
        bot: { id: bot.id, username: bot.username, name: bot.name, status: bot.status },
        webhook,
        applied,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
