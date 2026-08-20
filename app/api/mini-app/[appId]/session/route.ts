import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { clientIp, fail, ok, parseBody, rateLimit } from "@/lib/api";
import { prisma } from "@/lib/db";
import { readSecret } from "@/lib/bots/secrets";
import { loadPublishedApp } from "@/lib/mini-app/service";
import { InitDataError, verifyInitData } from "@/lib/mini-app/auth";

type Params = { params: Promise<{ appId: string }> };

/**
 * Mini App sessiyasi — Telegram foydalanuvchisini tanish.
 *
 * Bu endpoint OCHIQ: unga dashboard sessiyasi bilan emas, Telegram imzosi
 * bilan kiriladi. Yagona ishonch manbai — `initData` imzosi (`verifyInitData`).
 * `initDataUnsafe` hech qachon ishlatilmaydi: uni klient o'zgartira oladi.
 *
 * Bot tokeni faqat shu yerda, server tomonda o'qiladi va javobga hech qachon
 * tushmaydi.
 */
const schema = z.object({
  /// `Telegram.WebApp.initData` — imzolangan satr
  initData: z.string().min(1).max(4096),
});

export async function POST(request: Request, { params }: Params) {
  const { appId } = await params;

  // Imzo tekshiruvi arzon emas va bu manzil ochiq — urinishlarni cheklaymiz.
  const limit = rateLimit(`miniapp:session:${clientIp(request)}`, 60, 60_000);
  if (!limit.allowed) {
    return fail(`Juda ko'p urinish. ${limit.retryAfter}s dan keyin urining.`, 429);
  }

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  // Nashr etilmagan ilova mavjud emasdek ko'rinadi.
  const published = await loadPublishedApp(appId);
  if (!published) return fail("Mini App topilmadi", 404);

  const token = await readSecret(published.botId, "telegram_token");
  if (!token) {
    // Egasi tokenni olib tashlagan — imzoni tekshirib bo'lmaydi, demak
    // hech kimni tanib bo'lmaydi. Ochiq aytamiz, jim o'tkazib yubormaymiz.
    return fail("Bot tokeni sozlanmagan — Mini App vaqtincha ishlamaydi", 503);
  }

  let verified;
  try {
    verified = verifyInitData(token, parsed.data.initData);
  } catch (error) {
    if (error instanceof InitDataError) {
      await recordEvent(appId, "error", null, { reason: error.reason });
      // Sabab foydalanuvchiga aytilmaydi (hujumchiga ishora bermaymiz),
      // lekin hodisa jurnalida turadi.
      return fail("Telegram ulanishi tasdiqlanmadi", 401);
    }
    throw error;
  }

  const profile = verified.user;

  // Foydalanuvchi botning MAVJUD yozuviga tushadi — Mini App uchun alohida
  // jadval yaratilmaydi, shuning uchun chatdagi va Mini App'dagi odam bitta
  // yozuv bo'lib qoladi (savatcha, til, tarix umumiy).
  const botUser = await prisma.telegramBotUser.upsert({
    where: {
      botId_telegramUserId: {
        botId: published.botId,
        telegramUserId: profile.id,
      },
    },
    update: {
      username: profile.username,
      lastName: profile.lastName,
      languageCode: profile.languageCode,
      photoUrl: profile.photoUrl,
      lastActiveAt: new Date(),
    },
    create: {
      botId: published.botId,
      telegramUserId: profile.id,
      // Mini App'dan kelganda chat id foydalanuvchi id'siga teng (shaxsiy chat).
      chatId: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      username: profile.username,
      languageCode: profile.languageCode,
      photoUrl: profile.photoUrl,
    },
    select: {
      id: true,
      telegramUserId: true,
      firstName: true,
      lastName: true,
      username: true,
      languageCode: true,
      photoUrl: true,
      blocked: true,
    },
  });

  if (botUser.blocked) return fail("Ruxsat yo'q", 403);

  await recordEvent(appId, "open", profile.id, { startParam: verified.startParam });

  return ok({
    user: {
      id: botUser.telegramUserId,
      firstName: botUser.firstName,
      lastName: botUser.lastName,
      username: botUser.username,
      languageCode: botUser.languageCode,
      photoUrl: botUser.photoUrl,
    },
    startParam: verified.startParam,
  });
}

async function recordEvent(
  miniAppId: string,
  eventType: string,
  telegramUserId: string | null,
  detail: Record<string, unknown>,
): Promise<void> {
  await prisma.miniAppEvent
    .create({
      data: {
        miniAppId,
        eventType,
        telegramUserId,
        detail: detail as Prisma.InputJsonValue,
      },
    })
    .catch(() => undefined);
}
