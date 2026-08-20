import { z } from "zod";
import { clientIp, fail, ok, parseBody, rateLimit } from "@/lib/api";
import { guardWorkspace } from "@/lib/workspace";
import {
  BotServiceError,
  createBot,
  listBots,
  webhookAvailable,
} from "@/lib/bots/service";

/** BotFather tokeni: `<raqamli id>:<harf-raqam>`. */
const TOKEN = z
  .string()
  .trim()
  .regex(/^\d{6,12}:[A-Za-z0-9_-]{30,}$/, "Token formati noto'g'ri");

const createSchema = z.object({
  token: TOKEN,
  name: z.string().trim().min(1).max(64).optional(),
  description: z.string().trim().max(512).optional(),
  category: z.string().trim().max(32).optional(),
});

/** Ish maydonidagi botlar ro'yxati. */
export async function GET(request: Request) {
  const auth = await guardWorkspace(request, { capability: "bot:read" });
  if ("response" in auth) return auth.response;

  const bots = await listBots(auth.ctx.workspaceId);
  return ok({ bots, webhookAvailable: webhookAvailable() });
}

/**
 * Yangi bot qo'shish: token Telegram'da tekshiriladi, shifrlanadi va
 * imkoni bo'lsa webhook darhol o'rnatiladi.
 */
export async function POST(request: Request) {
  const auth = await guardWorkspace(request, { capability: "bot:create" });
  if ("response" in auth) return auth.response;

  // Token tekshiruvi har safar Telegram'ga chiqadi — brute force'ni cheklaymiz.
  const limit = rateLimit(`bots:create:${auth.ctx.user.id}`, 10, 60_000);
  if (!limit.allowed) {
    return fail("Juda ko'p urinish. Biroz kuting.", 429);
  }

  const parsed = await parseBody(request, createSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const { bot, webhook } = await createBot({
      workspaceId: auth.ctx.workspaceId,
      ownerId: auth.ctx.user.id,
      ip: clientIp(request),
      ...parsed.data,
    });

    return ok(
      {
        bot: {
          id: bot.id,
          username: bot.username,
          name: bot.name,
          status: bot.status,
        },
        webhook,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
