import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { BotServiceError, requireBot } from "@/lib/bots/service";
import { captureTransport, handleBotUpdate, type BotUpdate } from "@/lib/bots/runtime";
import { TELEGRAM_LIMITS } from "@/lib/bots/buttons/types";

type Params = { params: Promise<{ botId: string }> };

/**
 * Botni Telegram'siz sinash.
 *
 * Xabar ham, tugma bosilishi ham aynan webhook o'tadigan `handleBotUpdate`
 * yo'lidan o'tadi — farqi shundaki, javob Telegram'ga yuborilmay, to'planib
 * qaytariladi. Shu sababli lokal (HTTPS'siz) muhitda ham ichma-ich menyu
 * bo'ylab yurishni to'liq sinab bo'ladi.
 */
const schema = z
  .object({
    text: z.string().trim().min(1).max(2000).optional(),
    /// Inline tugma bosilishi — `callback_data` qiymati
    callback: z.string().trim().min(1).max(TELEGRAM_LIMITS.callbackBytes).optional(),
  })
  .refine((value) => Boolean(value.text || value.callback), {
    message: "Matn yoki callback kerak",
  });

export async function POST(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  try {
    await requireBot(botId, botScope(auth.ctx));

    // Egasi uchun barqaror soxta Telegram id — sinov yozuvlari bitta
    // «test foydalanuvchi» ostida to'planadi, real foydalanuvchilarga aralashmaydi.
    const testUserId = 800_000_000 + (Math.abs(hash(auth.ctx.user.id)) % 99_999_999);
    const transport = captureTransport();

    const from = {
      id: testUserId,
      is_bot: false,
      first_name: auth.ctx.user.name.split(" ")[0],
      username: `${auth.ctx.user.email.split("@")[0]}_test`,
      language_code: auth.ctx.user.lang,
    };
    const chat = { id: testUserId, type: "private" };
    const messageId = Date.now() % 100_000;

    const update: BotUpdate = parsed.data.callback
      ? {
          update_id: Date.now(),
          callback_query: {
            id: `sim_${messageId}`,
            data: parsed.data.callback,
            from,
            // Xabar id'si yuborilmaydi: simulyatorda har javob yangi qator
            // bo'lib chiqadi, jonli botda esa mavjud xabar tahrirlanadi.
            message: { message_id: messageId, date: 0, chat, from },
          },
        }
      : {
          update_id: Date.now(),
          message: {
            message_id: messageId,
            date: Math.floor(Date.now() / 1000),
            text: parsed.data.text,
            chat,
            from,
          },
        };

    await handleBotUpdate(botId, update, { transport });

    return ok({ replies: transport.replies, toasts: transport.toasts });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return h;
}
