import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { clientIp, fail, ok, parseBody, rateLimit } from "@/lib/api";
import { prisma } from "@/lib/db";
import { readSecret } from "@/lib/bots/secrets";
import { loadPublishedApp } from "@/lib/mini-app/service";
import { InitDataError, verifyInitData } from "@/lib/mini-app/auth";
import { runEndpoint } from "@/lib/mini-app/api-action";
import { validateForm } from "@/lib/mini-app/validate-form";

type Params = { params: Promise<{ appId: string }> };

/**
 * Mini App komponentining `api_request` amali.
 *
 * KLIENT MANZIL BERMAYDI — u faqat qaysi endpoint ekanini va forma
 * qiymatlarini yuboradi. Manzil, metod, sarlavhalar (API kalitlari bilan
 * birga) serverda qoladi. Shu sababli foydalanuvchi ixtiyoriy manzilga
 * so'rov yubora olmaydi.
 *
 * Validatsiya ham SERVERDA qaytadan bajariladi: klientdagi tekshiruv faqat
 * qulaylik uchun, u chetlab o'tilishi mumkin.
 */
const schema = z.object({
  initData: z.string().min(1).max(4096),
  endpointId: z.string().trim().min(1).max(64),
  /// Qaysi sahifadan yuborilgani — forma qoidalari shu sahifadan olinadi
  pageSlug: z.string().trim().max(48),
  values: z.record(z.string().max(40), z.string().max(500)).default({}),
});

export async function POST(request: Request, { params }: Params) {
  const { appId } = await params;

  const limit = rateLimit(`miniapp:action:${clientIp(request)}`, 30, 60_000);
  if (!limit.allowed) {
    return fail(`Juda ko'p so'rov. ${limit.retryAfter}s dan keyin urining.`, 429);
  }

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

  // Bloklangan foydalanuvchi hech qanday amalni bajara olmaydi.
  const botUser = await prisma.telegramBotUser.findUnique({
    where: {
      botId_telegramUserId: {
        botId: published.botId,
        telegramUserId: verified.user.id,
      },
    },
    select: { blocked: true },
  });
  if (botUser?.blocked) return fail("Ruxsat yo'q", 403);

  /* Forma qoidalari NASHR ETILGAN suratdan olinadi — klient yuborganidan emas */
  const page = published.schema.pages.find(
    (candidate) => candidate.slug === parsed.data.pageSlug,
  );
  if (page) {
    const errors = validateForm(page.components, parsed.data.values);
    if (errors.length > 0) {
      return fail(errors[0].message, 422, errors);
    }
  }

  const app = await prisma.miniApp.findUnique({
    where: { id: appId },
    select: { apiAllowlist: true },
  });

  const outcome = await runEndpoint({
    miniAppId: appId,
    endpointId: parsed.data.endpointId,
    values: parsed.data.values,
    allowlist: app?.apiAllowlist ?? [],
  });

  await prisma.miniAppEvent
    .create({
      data: {
        miniAppId: appId,
        eventType: outcome.ok ? "api_call" : "error",
        telegramUserId: verified.user.id,
        pageSlug: parsed.data.pageSlug || null,
        detail: {
          endpointId: parsed.data.endpointId,
          status: outcome.status,
          ...(outcome.ok ? {} : { reason: outcome.error }),
        } as Prisma.InputJsonValue,
      },
    })
    .catch(() => undefined);

  if (!outcome.ok) return fail(outcome.error, outcome.status >= 500 ? 502 : 400);

  return ok({ data: outcome.data });
}
