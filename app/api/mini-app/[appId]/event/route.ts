import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { clientIp, fail, ok, parseBody, rateLimit } from "@/lib/api";
import { prisma } from "@/lib/db";
import { readSecret } from "@/lib/bots/secrets";
import { loadPublishedApp } from "@/lib/mini-app/service";
import { InitDataError, verifyInitData } from "@/lib/mini-app/auth";

type Params = { params: Promise<{ appId: string }> };

/**
 * Analitika hodisasi (sahifa ko'rish, tugma bosish).
 *
 * Imzo bu yerda ham tekshiriladi: aks holda istalgan odam ko'rsatkichlarni
 * shishirib, egasiga yolg'on statistika ko'rsatardi. Hodisa yozilmasa ham
 * Mini App ishlashda davom etadi — analitika hech qachon asosiy oqimni
 * to'xtatmasligi kerak.
 */
const schema = z.object({
  initData: z.string().min(1).max(4096),
  eventType: z.enum(["page_view", "button_click"]),
  pageSlug: z.string().trim().max(48).optional(),
});

export async function POST(request: Request, { params }: Params) {
  const { appId } = await params;

  const limit = rateLimit(`miniapp:event:${clientIp(request)}`, 120, 60_000);
  if (!limit.allowed) return ok({ ok: true });

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  const published = await loadPublishedApp(appId);
  if (!published) return fail("Mini App topilmadi", 404);

  const token = await readSecret(published.botId, "telegram_token");
  if (!token) return fail("Bot tokeni sozlanmagan", 503);

  let verified;
  try {
    verified = verifyInitData(token, parsed.data.initData);
  } catch (error) {
    if (error instanceof InitDataError) return fail("Telegram ulanishi tasdiqlanmadi", 401);
    throw error;
  }

  await prisma.miniAppEvent
    .create({
      data: {
        miniAppId: appId,
        eventType: parsed.data.eventType,
        telegramUserId: verified.user.id,
        pageSlug: parsed.data.pageSlug || null,
        detail: {} as Prisma.InputJsonValue,
      },
    })
    .catch(() => undefined);

  return ok({ ok: true });
}
