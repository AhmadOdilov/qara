import "server-only";
import { UnconfiguredProvider } from "@/lib/payments/provider";
import type { PaymentProviderId } from "@/lib/payments/types";
import type { ProviderCapabilities as Caps } from "@/lib/payments/provider";

/**
 * Click SHOP-API adapteri (§P3 PHASE 4).
 *
 * TASDIQLANGAN (rasmiy hujjat va Click'ning o'z PHP kutubxonasidan):
 *   · Ikki bosqich: Prepare (`action=0`) va Complete (`action=1`)
 *   · Prepare parametrlari: click_trans_id, service_id, click_paydoc_id,
 *     merchant_trans_id, amount, action, error, error_note, sign_time,
 *     sign_string
 *   · Complete parametrlari: yuqoridagilar + merchant_prepare_id
 *   · Har ikkala callback MD5 imzo bilan tekshiriladi
 *
 * TASDIQLANMAGAN — shuning uchun IMPLEMENT QILINMADI:
 *   · `sign_string` MD5 formulasidagi maydonlar TARTIBI
 *
 * Qidiruvda topilgan formula (`md5(date + secret + service_id + trans_id +
 * amount)`) rasmiy hujjatdagi parametr ro'yxatiga ZID va norasmiy manbadan.
 * Imzo tartibini noto'g'ri yozish — to'lov tizimidagi eng xavfli xato:
 * yo hamma haqiqiy callback rad etiladi, yo soxtasi qabul qilinadi.
 *
 * Tugatish uchun kerak: docs.click.uz SHOP-API «Запросы» bo'limidan
 * sign_string formulasi yoki Click kabinetidagi merchant hujjati.
 */
export class ClickProvider extends UnconfiguredProvider {
  readonly id: PaymentProviderId = "click";

  capabilities(): Caps {
    return { configured: false, refund: false, cancel: false };
  }
}

/** Sozlamalar mavjudmi — diagnostika uchun (qiymatlar qaytarilmaydi). */
export function clickConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.CLICK_SERVICE_ID?.trim() &&
      env.CLICK_MERCHANT_ID?.trim() &&
      env.CLICK_SECRET_KEY?.trim(),
  );
}
