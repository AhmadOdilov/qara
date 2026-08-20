import { fail, ok } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { BotServiceError } from "@/lib/bots/service";
import {
  MiniAppValidationError,
  publishMiniApp,
  unpublishMiniApp,
} from "@/lib/mini-app/service";

type Params = { params: Promise<{ botId: string }> };

/**
 * Qoralamani jonli manzilga chiqarish.
 *
 * Nashrdan oldin sxema tekshiriladi: mavjud bo'lmagan sahifaga ulangan tugma
 * yoki HTTPS bo'lmagan havola bilan chiqarilsa foydalanuvchi Telegram ichida
 * boshi berk ko'chaga tushardi.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:publish" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  try {
    const result = await publishMiniApp(botId, botScope(auth.ctx));
    return ok({ published: true, ...result });
  } catch (error) {
    if (error instanceof MiniAppValidationError) {
      return fail(error.message, error.status, error.issues);
    }
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

/** Nashrdan olish — manzil yopiladi, qoralama saqlanadi. */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:publish" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  try {
    const app = await unpublishMiniApp(botId, botScope(auth.ctx));
    return ok({ published: false, status: app.status });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
