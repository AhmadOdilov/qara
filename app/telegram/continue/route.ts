import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createSession } from "@/lib/auth";
import { consumeClaim } from "@/lib/qara-bot/claim";
import { track } from "@/lib/analytics";

/**
 * Telegramdan dashboardga o'tish nuqtasi (§10).
 *
 * Bot yuborgan bir martalik tutqich shu yerda sessiyaga almashadi.
 * Tutqich URL'da keladi, lekin u credential emas: ma'nosiz tasodifiy satr,
 * 15 daqiqa amal qiladi, bir marta ishlaydi va bazada faqat hash'i yotadi.
 *
 * Log yozilmaydi — `t` parametri hech qayerga chiqmaydi (§57).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const next = safeNext(url.searchParams.get("next"));

  const result = await consumeClaim(token);

  if (!result.ok) {
    // Sabab foydalanuvchiga ko'rsatiladi, lekin tutqichning o'zi emas.
    const login = new URL("/login", env.appUrl);
    login.searchParams.set("telegram", result.reason);
    return NextResponse.redirect(login);
  }

  await createSession(result.userId);
  await track("login", result.userId, { via: "telegram" });

  return NextResponse.redirect(new URL(next, env.appUrl));
}

/**
 * Ochiq yo'naltirishning oldini olamiz: faqat ilova ichidagi nisbiy yo'l
 * qabul qilinadi. `//evil.com` kabi protokolsiz mutlaq manzillar ham rad etiladi.
 */
function safeNext(value: string | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}
