import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { clientIp, fail, ok, parseBody, rateLimit, sanitizeText } from "@/lib/api";
import { prisma } from "@/lib/db";
import { readSecret } from "@/lib/bots/secrets";
import { sendBotMessage } from "@/lib/bots/telegram-api";
import { loadPublishedApp } from "@/lib/mini-app/service";
import { InitDataError, verifyInitData } from "@/lib/mini-app/auth";

type Params = { params: Promise<{ appId: string }> };

/**
 * Mini App'dan botga xabar yuborish (`send_message` va `submit_form` amallari).
 *
 * Nega klient `Telegram.WebApp.sendData()` ni ishlatmaydi: u faqat REPLY
 * klaviaturadan ochilgan Mini App'da ishlaydi, menyu tugmasi yoki inline
 * tugmadan ochilganda esa umuman javob qaytarmaydi. Shu yo'l esa har uch
 * holatda bir xil ishlaydi va xabar server tomonda, bot tokeni bilan
 * yuboriladi — token klientga hech qachon chiqmaydi.
 *
 * Kim yozayotgani `initData` imzosidan aniqlanadi: chat id klientdan
 * OLINMAYDI, aks holda istalgan odam boshqa chatga xabar yozdira olardi.
 */
const schema = z.object({
  initData: z.string().min(1).max(4096),
  text: z.string().trim().min(1).max(1000),
  /// `submit_form` yig'gan maydonlar
  payload: z.record(z.string().max(40), z.string().max(500)).optional(),
});

export async function POST(request: Request, { params }: Params) {
  const { appId } = await params;

  const limit = rateLimit(`miniapp:send:${clientIp(request)}`, 20, 60_000);
  if (!limit.allowed) {
    return fail(`Juda tez yuboryapsiz. ${limit.retryAfter}s dan keyin urining.`, 429);
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

  const botUser = await prisma.telegramBotUser.findUnique({
    where: {
      botId_telegramUserId: {
        botId: published.botId,
        telegramUserId: verified.user.id,
      },
    },
    select: { id: true, chatId: true, blocked: true },
  });

  // Sessiya ochilmagan bo'lsa yozuv ham yo'q — avval `/session` chaqirilishi kerak.
  if (!botUser) return fail("Avval Mini App'ni qaytadan oching", 409);
  if (botUser.blocked) return fail("Ruxsat yo'q", 403);

  const body = composeMessage(parsed.data.text, parsed.data.payload);

  try {
    const sent = await sendBotMessage(token, botUser.chatId, body, {});

    // Chatdagi jurnal Mini App xabarlarini ham ko'rsatsin — bot va Mini App
    // bitta suhbat bo'lib qolishi kerak.
    await prisma.telegramBotMessage.create({
      data: {
        botId: published.botId,
        botUserId: botUser.id,
        telegramUserId: verified.user.id,
        direction: "out",
        messageType: "mini_app",
        content: body.slice(0, 4096),
        metadata: { appId, messageId: sent.message_id } as Prisma.InputJsonValue,
      },
    });

    await prisma.miniAppEvent
      .create({
        data: {
          miniAppId: appId,
          eventType: "button_click",
          telegramUserId: verified.user.id,
          detail: { kind: "send" } as Prisma.InputJsonValue,
        },
      })
      .catch(() => undefined);

    return ok({ ok: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Noma'lum xato";
    await prisma.miniAppEvent
      .create({
        data: {
          miniAppId: appId,
          eventType: "error",
          telegramUserId: verified.user.id,
          detail: { reason: reason.slice(0, 300) } as Prisma.InputJsonValue,
        },
      })
      .catch(() => undefined);
    return fail("Xabar yuborilmadi", 502);
  }
}

/**
 * Forma maydonlarini o'qiladigan matnga aylantiradi.
 *
 * Telegram'ga `parse_mode` siz, oddiy matn sifatida ketadi — shuning uchun
 * foydalanuvchi kiritgan qiymat hech qanday belgilashni buza olmaydi.
 */
function composeMessage(text: string, payload?: Record<string, string>): string {
  const head = sanitizeText(text);
  if (!payload || Object.keys(payload).length === 0) return head;

  const lines = Object.entries(payload)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `• ${sanitizeText(key)}: ${sanitizeText(value)}`);

  return lines.length > 0 ? `${head}\n\n${lines.join("\n")}` : head;
}
