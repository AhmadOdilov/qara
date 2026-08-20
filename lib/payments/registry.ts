import "server-only";
import { PAYMENT_PROVIDERS, type PaymentProviderId } from "@/lib/payments/types";
import { UnconfiguredProvider, type PaymentProvider } from "@/lib/payments/provider";
import { PaymeProvider } from "@/lib/payments/payme";
import { ClickProvider } from "@/lib/payments/click";

/**
 * Provayder ro'yxati (§P3 PHASE 2).
 *
 * Sirlar faqat muhit o'zgaruvchilaridan o'qiladi va hech qachon interfeysga
 * chiqmaydi. Sozlanmagan provayder `configured: false` qaytaradi va UI'da
 * «tez orada» ko'rinadi — soxta to'lov yo'q.
 */

const providers: Record<PaymentProviderId, PaymentProvider> = {
  payme: new PaymeProvider(),
  click: new ClickProvider(),
};

export function getProvider(id: PaymentProviderId): PaymentProvider {
  return providers[id];
}

/** Interfeys uchun: qaysi provayder haqiqatan ishlashga tayyor. */
export function providerStatuses(): {
  id: PaymentProviderId;
  configured: boolean;
  refund: boolean;
  cancel: boolean;
}[] {
  return PAYMENT_PROVIDERS.map((id) => {
    const caps = providers[id].capabilities();
    return { id, ...caps };
  });
}

/** Kamida bitta provayder ishlaydimi. */
export function anyProviderConfigured(): boolean {
  return providerStatuses().some((row) => row.configured);
}

export { UnconfiguredProvider };
