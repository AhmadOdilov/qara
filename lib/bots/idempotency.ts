import "server-only";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";

/**
 * Telegram update'lari uchun takroriy yetkazishdan himoya.
 *
 * Telegram 200 javobini ololmasa — timeout, tarmoq uzilishi, deploy paytidagi
 * qayta ishga tushish — AYNAN O'SHA update'ni qayta yuboradi. Himoyasiz bu
 * ikkinchi marta xabar yuborish, savatga ikkinchi mahsulot qo'shish yoki
 * buyurtmani ikki marta yozish demak.
 *
 * Tekshiruv `INSERT` orqali bajariladi, «avval o'qib, keyin yozib» emas:
 * ikkita nusxa bir vaqtda kelsa ham `(botId, updateId)` unikal cheklovi
 * ikkinchisini rad etadi, ya'ni poyga holati yopiq.
 */

/** Eskirgan yozuvlar shu muddatdan keyin tozalanadi. */
const RETENTION_HOURS = 48;

/**
 * `true` — update birinchi marta ko'rilyapti, qayta ishlash mumkin.
 * `false` — allaqachon qabul qilingan, e'tiborsiz qoldirish kerak.
 *
 * Baza xatosi bo'lsa `true` qaytadi: dedup — himoya qatlami, u ishlamay
 * qolgani uchun botning o'zi javob bermay qolmasligi kerak.
 */
export async function claimUpdate(
  botId: string,
  updateId: number,
): Promise<boolean> {
  try {
    await prisma.telegramUpdateReceipt.create({
      data: { botId, updateId: BigInt(updateId) },
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    log.error("idempotency: yozib bo'lmadi", {
      botId,
      updateId,
      reason: error instanceof Error ? error.message : "noma'lum",
    });
    return true;
  }
}

/** Prisma'ning P2002 (unique constraint) xatosi — kutilgan holat. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Eskirgan yozuvlarni o'chiradi. Telegram bir update'ni ko'pi bilan bir necha
 * soat davomida qayta yuboradi, shuning uchun ikki kunlik oyna yetarli.
 */
export async function pruneUpdateReceipts(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_HOURS * 3600_000);
  const { count } = await prisma.telegramUpdateReceipt.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
