import { z } from "zod";
import { fail, ok, parseBody, rateLimit } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { BotServiceError } from "@/lib/bots/service";
import { duplicateBotConfig } from "@/lib/bots/duplicate";

type Params = { params: Promise<{ botId: string }> };

const schema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
});

/**
 * Botni konfiguratsiyadan nusxalash (§28).
 *
 * Natija — jonli bot emas, QORALAMA reja. Token nusxalanmaydi: foydalanuvchi
 * `/build/<planId>` da o'zining yangi @BotFather tokenini ulaydi. Shu sababli
 * bu yerda `secret:write` emas, `bot:create` huquqi yetarli — hech qanday sir
 * o'qilmaydi ham, yozilmaydi ham.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:create" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  const limit = rateLimit(`bots:duplicate:${auth.ctx.user.id}`, 20, 60_000);
  if (!limit.allowed) return fail("Juda ko'p urinish. Biroz kuting.", 429);

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  try {
    const result = await duplicateBotConfig(
      botId,
      botScope(auth.ctx),
      parsed.data,
    );
    return ok(result, { status: 201 });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
