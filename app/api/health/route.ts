import { NextResponse } from "next/server";

/**
 * LIVENESS — «jarayon tirikmi?».
 *
 * Ataylab HECH QANDAY bog'liqlikni (baza, Telegram API) tekshirmaydi.
 * Sabab: liveness muvaffaqiyatsiz bo'lsa orkestrator konteynerni QAYTA
 * ISHGA TUSHIRADI. Agar bu yerda bazani tekshirsak, baza bir lahzaga
 * uzilganda sog'lom ilova konteynerlari qayta ishga tushib, restart
 * bo'ronini boshlab yuborardi.
 *
 * Baza holati uchun alohida `/api/health/ready` bor.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
