import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, parseBody } from "@/lib/api";
import { env } from "@/lib/env";
import { LANG_COOKIE } from "@/lib/i18n/server";
import { track } from "@/lib/analytics";

const schema = z.object({ lang: z.enum(["uz", "ru", "en"]) });

/**
 * Tilni almashtirish. Mehmon uchun cookie yetarli; kirgan foydalanuvchi uchun
 * profilga ham yoziladi, shunda boshqa qurilmada ham o'sha til qoladi.
 *
 * CSRF tekshiruvi qo'llanmaydi: bu mehmonlarga ham ochiq va o'zgartiradigan
 * yagona narsasi — foydalanuvchining o'z til tanlovi.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;
  const { lang } = parsed.data;

  const jar = await cookies();
  jar.set(LANG_COOKIE, lang, {
    httpOnly: false,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  const user = await getCurrentUser();
  if (user && user.lang !== lang) {
    await prisma.user.update({ where: { id: user.id }, data: { lang } });
    await track("lang_changed", user.id, { lang });
  }

  return ok({ lang });
}
