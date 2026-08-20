import { fail, ok } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { BotServiceError } from "@/lib/bots/service";
import { miniAppAnalytics } from "@/lib/mini-app/service";

type Params = { params: Promise<{ botId: string }> };

/** Mini App ko'rsatkichlari — faqat haqiqiy hodisa yozuvlaridan. */
export async function GET(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "analytics:read" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  try {
    return ok(await miniAppAnalytics(botId, botScope(auth.ctx)));
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
