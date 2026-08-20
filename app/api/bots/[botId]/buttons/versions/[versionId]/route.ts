import { fail, ok } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { BotServiceError, requireBot } from "@/lib/bots/service";
import { loadDraft, restoreVersion } from "@/lib/bots/buttons/store";

type Params = { params: Promise<{ botId: string; versionId: string }> };

/**
 * Versiyani qoralamaga tiklash.
 *
 * Nashr avtomatik bo'lmaydi: tiklangan daraxt oddiy tahrir kabi qoralamada
 * turadi va jonli botga faqat «Nashr etish»dan keyin chiqadi.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:publish" });
  if ("response" in auth) return auth.response;
  const { botId, versionId } = await params;

  try {
    await requireBot(botId, botScope(auth.ctx));

    const version = await restoreVersion(botId, versionId, auth.ctx.user.id);
    return ok({ version, buttons: await loadDraft(botId) });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
