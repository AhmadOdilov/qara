import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, guard, ok, parseBody } from "@/lib/api";
import { telegramMockMode } from "@/lib/env";
import { deleteWebhook, setWebhook, webhookUrl } from "@/lib/telegram";

const schema = z.object({
  welcomeMessage: z.string().trim().max(1000).optional(),
  autoReply: z.string().trim().max(1000).nullable().optional(),
  maintenanceMode: z.boolean().optional(),
  rateLimitPerMin: z.number().int().min(1).max(300).optional(),
});

export async function PATCH(request: Request) {
  const auth = await guard(request, { admin: true });
  if ("response" in auth) return auth.response;

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  const settings = await prisma.botSettings.upsert({
    where: { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  });

  return ok({ settings });
}

/**
 * Webhook'ni Telegram'da ro'yxatdan o'tkazish yoki o'chirish.
 * MOCK rejimda chaqiruv tarmoqqa chiqmaydi — shunchaki muvaffaqiyat qaytadi.
 */
export async function POST(request: Request) {
  const auth = await guard(request, { admin: true });
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "set") {
      await setWebhook();
      return ok({ ok: true, url: webhookUrl(), mockMode: telegramMockMode });
    }
    if (action === "delete") {
      await deleteWebhook();
      return ok({ ok: true, mockMode: telegramMockMode });
    }
    return fail("action=set yoki action=delete bo'lishi kerak", 400);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Noma'lum xato";
    return fail(reason, 502);
  }
}
