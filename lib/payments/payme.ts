import "server-only";
import { UnconfiguredProvider } from "@/lib/payments/provider";
import type { PaymentProviderId } from "@/lib/payments/types";
import type { ProviderCapabilities as Caps } from "@/lib/payments/provider";

/**
 * Payme Merchant API adapteri (§P3 PHASE 3).
 *
 * TASDIQLANGAN (rasmiy hujjatdan, 2026-avgust):
 *   · JSON-RPC 2.0, HTTPS POST, TLS majburiy
 *   · Metodlar: CheckPerformTransaction, CreateTransaction, PerformTransaction,
 *     CancelTransaction, CheckTransaction, GetStatement
 *   · `amount` — TIYINDA (eng kichik birlik), ya'ni so'm × 100
 *   · `account` — buyurtmani aniqlaydigan obyekt
 *   · Merchant HTTP 200 qaytarishi shart; boshqa status RPC xatosi -32400 deb
 *     talqin qilinadi
 *   · Hisob xatolari uchun -31050…-31099 oralig'i
 *
 * TASDIQLANMAGAN — shuning uchun IMPLEMENT QILINMADI:
 *   · `Authorization` sarlavhasining aniq formati (login qiymati va kalit
 *     kodlanishi)
 *   · To'liq xato kodlari jadvali (-31001, -31003, -31008 va b.)
 *   · Tranzaksiya holatlarining to'liq ro'yxati (1 va -1 tasdiqlangan,
 *     2 va -2 taxmin)
 *
 * Bu qiymatlarni «o'xshatib» yozish to'lov tizimida qabul qilib bo'lmaydi:
 * noto'g'ri avtorizatsiya tekshiruvi yo haqiqiy callback'larni rad etadi,
 * yo soxtasini qabul qiladi. Shuning uchun adapter SOZLANMAGAN holatda
 * qoladi va hech qachon soxta «to'landi» qaytarmaydi.
 *
 * Tugatish uchun kerak: Payme kabinetidan merchant hujjati (Authorization
 * formati + xato kodlari) yoki sandbox kirish.
 */
export class PaymeProvider extends UnconfiguredProvider {
  readonly id: PaymentProviderId = "payme";

  capabilities(): Caps {
    // Sirlar mavjud bo'lsa ham, protokol tasdiqlanmaguncha `configured`
    // false qoladi — kalit borligi integratsiya tayyor degani emas.
    return { configured: false, refund: false, cancel: false };
  }
}

/** Sozlamalar mavjudmi — diagnostika uchun (qiymatlar qaytarilmaydi). */
export function paymeConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.PAYME_MERCHANT_ID?.trim() && env.PAYME_MERCHANT_KEY?.trim());
}
