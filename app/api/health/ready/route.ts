import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";

/**
 * READINESS — «trafik qabul qilishga tayyormi?».
 *
 * Bu yerda bazaga haqiqiy so'rov yuboriladi. Baza yo'q bo'lsa 503 qaytadi —
 * reverse proxy / orkestrator bu konteynerga so'rov yubormaydi, LEKIN uni
 * qayta ishga tushirmaydi (buning uchun liveness bor).
 *
 * Javobda xato matni CHIQMAYDI: bu endpoint ochiq bo'lishi mumkin va
 * ulanish satri, host nomi kabi ma'lumot sizib chiqmasligi kerak.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    // Sabab faqat server logida qoladi.
    log.error("health/ready: baza javob bermadi", {
      reason: error instanceof Error ? error.message : "noma'lum",
    });
    return NextResponse.json(
      { status: "unavailable", database: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  /*
    Migratsiya holati (§P5 PHASE 7, 11).

    Baza javob bersa ham, migratsiya yarim qolgan bo'lsa sxema kod kutgan
    shaklda bo'lmaydi va ilova ishlayotgandek ko'rinib turib xato beradi.
    Prisma tugallanmagan migratsiyani `finished_at IS NULL` bilan belgilaydi
    (`rolled_back_at` esa qaytarilganini).

    Jadval umuman bo'lmasligi mumkin (masalan `db push` bilan qurilgan dev
    bazasi) — bu holat XATO deb hisoblanmaydi, shunchaki noma'lum.
  */
  let migrations: "ok" | "pending" | "unknown" = "unknown";
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
    `;
    migrations = Number(rows[0]?.count ?? 0) === 0 ? "ok" : "pending";
  } catch {
    migrations = "unknown";
  }

  if (migrations === "pending") {
    log.error("health/ready: tugallanmagan migratsiya bor", { migrations });
    return NextResponse.json(
      { status: "unavailable", database: "up", migrations },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      status: "ok",
      database: "up",
      migrations,
      latencyMs: Date.now() - startedAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
