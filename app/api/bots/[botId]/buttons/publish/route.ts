import { fail, ok } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { BotServiceError, requireBot } from "@/lib/bots/service";
import {
  diffAgainstPublished,
  latestVersionNumber,
  listVersions,
  publishButtons,
} from "@/lib/bots/buttons/store";

type Params = { params: Promise<{ botId: string }> };

/** Nashr tarixi — oxirgi 20 ta surat. */
export async function GET(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:read" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  try {
    await requireBot(botId, botScope(auth.ctx));

    const [versions, diff] = await Promise.all([
      listVersions(botId),
      diffAgainstPublished(botId),
    ]);

    return ok({ versions, diff });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

/**
 * Qoralamani jonli botga chiqarish.
 *
 * O'zgarish bo'lmasa yangi versiya yaratilmaydi: aks holda har bosishda
 * tarix bir xil suratlar bilan to'lib ketardi.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:publish" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  try {
    await requireBot(botId, botScope(auth.ctx));

    const diff = await diffAgainstPublished(botId);
    if (!diff.hasChanges) {
      return ok({
        published: false,
        version: await latestVersionNumber(botId),
        diff,
      });
    }

    // Audit yozuvini `publishButtons` o'zi qoldiradi.
    const result = await publishButtons(botId, auth.ctx.user.id);
    return ok({ published: true, ...result });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
