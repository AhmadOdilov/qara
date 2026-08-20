import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { BotServiceError } from "@/lib/bots/service";
import { readLaunchState, updateLaunch } from "@/lib/mini-app/launch";

type Params = { params: Promise<{ botId: string }> };

const schema = z.object({
  /// Chatdagi «≡» menyu tugmasi — Telegram'da darhol o'rnatiladi
  menu: z.boolean().optional(),
  menuText: z.string().trim().min(1).max(64).optional(),
  /// Xabar ostidagi inline tugma
  inline: z.boolean().optional(),
  /// Klaviaturadagi tugma
  keyboard: z.boolean().optional(),
});

export async function GET(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:read" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  try {
    return ok(await readLaunchState(botId, botScope(auth.ctx)));
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  if (Object.keys(parsed.data).length === 0) {
    return fail("O'zgartirish uchun maydon berilmadi", 400);
  }

  try {
    return ok(await updateLaunch(botId, botScope(auth.ctx), parsed.data));
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
