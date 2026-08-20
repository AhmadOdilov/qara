import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
    console.error("[health/ready] baza javob bermadi:", error);
    return NextResponse.json(
      { status: "unavailable", database: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { status: "ok", database: "up", latencyMs: Date.now() - startedAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
