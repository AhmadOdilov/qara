import { clientIp, fail, ok } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import {
  applyWebhook,
  BotServiceError,
  botWebhookUrl,
  removeWebhook,
  requireBot,
  webhookAvailable,
  webhookStatus,
} from "@/lib/bots/service";

type Params = { params: Promise<{ botId: string }> };

/** Telegram tomonidagi haqiqiy webhook holati — diagnostika uchun. */
export async function GET(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:read" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  try {
    await requireBot(botId, botScope(auth.ctx));
    const status = await webhookStatus(botId);
    return ok({ status, expectedUrl: botWebhookUrl(botId) });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    // Telegram javob bermasligi sozlash xatosi emas — 502 bilan ajratamiz.
    const reason = error instanceof Error ? error.message : "Noma'lum xato";
    return fail(reason, 502);
  }
}

/** `action=set` — webhook'ni o'rnatish, `action=delete` — olib tashlash. */
export async function POST(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:publish" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  const action = new URL(request.url).searchParams.get("action");
  const ip = clientIp(request);

  try {
    await requireBot(botId, botScope(auth.ctx));

    if (action === "set") {
      const result = await applyWebhook(botId, auth.ctx.user.id, ip);
      return ok({ webhook: result, webhookAvailable: webhookAvailable() });
    }
    if (action === "delete") {
      await removeWebhook(botId, auth.ctx.user.id, ip);
      return ok({ ok: true });
    }
    return fail("action=set yoki action=delete bo'lishi kerak", 400);
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
