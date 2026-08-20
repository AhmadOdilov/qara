import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { handleBotUpdate, type BotUpdate } from "@/lib/bots/runtime";
import { claimUpdate } from "@/lib/bots/idempotency";
import { log } from "@/lib/log";

type Params = { params: Promise<{ botId: string }> };

/**
 * Foydalanuvchi botlari uchun webhook endpointi.
 *
 * Har bir botning o'z `secret_token`i bor (setWebhook'da beriladi), shuning
 * uchun bitta botning manzilini bilgan odam boshqasiga update yubora olmaydi.
 * Solishtirish `safeEqual` bilan — vaqt bo'yicha sizib chiqmasin.
 *
 * Telegram 200 javobini tez kutadi: qayta ishlashda xato bo'lsa ham 200
 * qaytaramiz, aks holda u o'sha update'ni qayta-qayta yuboraveradi.
 */
export async function POST(request: Request, { params }: Params) {
  const { botId } = await params;
  const provided = request.headers.get("x-telegram-bot-api-secret-token");

  const bot = await prisma.telegramBot.findUnique({
    where: { id: botId },
    select: { webhookSecret: true },
  });

  if (!bot || !provided || !safeEqual(provided, bot.webhookSecret)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 401 });
  }

  let update: BotUpdate;
  try {
    update = (await request.json()) as BotUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Takroriy yetkazishdan himoya: Telegram javobni ololmasa o'sha update'ni
  // qayta yuboradi. Ikkinchi nusxa shu yerda to'xtaydi — aks holda xabar ikki
  // marta ketardi yoki buyurtma ikki marta yozilardi.
  if (typeof update.update_id === "number") {
    const fresh = await claimUpdate(botId, update.update_id);
    if (!fresh) return NextResponse.json({ ok: true });
  }

  try {
    await handleBotUpdate(botId, update);
  } catch (error) {
    log.error("bot-webhook: update qayta ishlanmadi", {
      botId,
      reason: error instanceof Error ? error.message : "noma'lum",
    });
  }

  return NextResponse.json({ ok: true });
}
