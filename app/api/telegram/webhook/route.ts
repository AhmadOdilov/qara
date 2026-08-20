import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { handleUpdate } from "@/lib/bot-handler";
import type { TelegramUpdate } from "@/lib/telegram";
import { log } from "@/lib/log";

/**
 * Telegram webhook endpointi.
 *
 * Manzil ochiq bo'lgani uchun har bir so'rov `X-Telegram-Bot-Api-Secret-Token`
 * sarlavhasi bilan tasdiqlanadi — bu qiymat setWebhook'da beriladi va faqat
 * Telegram serverlari biladi.
 *
 * Telegram 200 javobini tez kutadi: xato bo'lsa ham 200 qaytaramiz, aks holda
 * u o'sha update'ni qayta-qayta yuboraveradi.
 */
export async function POST(request: Request) {
  // Solishtirish `safeEqual` bilan — bot webhook'idagidek, sir vaqt bo'yicha
  // sizib chiqmasin.
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (
    !env.telegram.webhookSecret ||
    !secret ||
    !safeEqual(secret, env.telegram.webhookSecret)
  ) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleUpdate(update);
  } catch (error) {
    log.error("telegram-webhook: update qayta ishlanmadi", {
      reason: error instanceof Error ? error.message : "noma'lum",
    });
  }

  return NextResponse.json({ ok: true });
}
