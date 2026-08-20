import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, guard, ok, parseBody } from "@/lib/api";
import { telegramMockMode } from "@/lib/env";
import { handleUpdate } from "@/lib/bot-handler";

const schema = z.object({
  text: z.string().trim().min(1).max(2000),
});

/**
 * MOCK rejim uchun: Telegramdan kelgan xabarni simulyatsiya qiladi.
 * Haqiqiy webhook bilan bir xil `handleUpdate` yo'lidan o'tadi, shuning uchun
 * tokensiz sinovda ham xatti-harakat real oqim bilan bir xil bo'ladi.
 */
export async function POST(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;
  if (!telegramMockMode) {
    return fail("Simulyator faqat MOCK rejimda ishlaydi", 400);
  }

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  const link = await prisma.telegramLink.findUnique({
    where: { userId: auth.user.id },
  });
  if (!link?.telegramChatId || !link.connectedAt) {
    return fail("Avval Telegramni bog'lang", 409);
  }

  await handleUpdate({
    update_id: Date.now(),
    message: {
      message_id: Date.now() % 100000,
      date: Math.floor(Date.now() / 1000),
      text: parsed.data.text,
      chat: { id: Number(link.telegramChatId), type: "private" },
      from: {
        id: Number(link.telegramUserId ?? link.telegramChatId),
        is_bot: false,
        first_name: link.firstName ?? auth.user.name,
        username: link.username ?? undefined,
        language_code: link.languageCode ?? auth.user.lang,
      },
    },
  });

  return ok({ ok: true });
}
