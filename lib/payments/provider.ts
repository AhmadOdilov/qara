import type {
  PaymentProviderId,
  PaymentStatus,
  RejectReason,
} from "@/lib/payments/types";

/**
 * To'lov provayderi interfeysi (§P3 PHASE 2).
 *
 * Maqsad — buyurtma mantig'ini provayderdan AJRATISH. `PaymentService`
 * faqat shu interfeysni biladi; Payme'ning JSON-RPC'si ham, Click'ning
 * Prepare/Complete'i ham adapter ichida qoladi.
 *
 * Yangi provayder qo'shish = shu interfeysni bajaradigan bitta fayl.
 */

/** Provayder sozlanganmi va nima qila oladi. */
export type ProviderCapabilities = {
  /** Sozlamalar to'liq — haqiqiy to'lov qabul qilish mumkin. */
  configured: boolean;
  /** Provayder API'si orqali qaytarish qo'llab-quvvatlanadimi. */
  refund: boolean;
  /** Provayder API'si orqali bekor qilish qo'llab-quvvatlanadimi. */
  cancel: boolean;
};

export type InitResult =
  | {
      ok: true;
      /** Foydalanuvchi o'tadigan manzil. */
      payUrl: string;
      /** Provayderdagi identifikator — hozircha ma'lum bo'lsa. */
      providerTransactionId?: string;
      metadata?: Record<string, unknown>;
    }
  | { ok: false; reason: string };

/** Callback natijasi — xizmat shuni bazaga yozadi. */
export type CallbackOutcome =
  | {
      ok: true;
      /** Qaysi buyurtmaga tegishli. */
      orderCode: string;
      providerTransactionId: string;
      amount: number;
      currency: string;
      nextStatus: PaymentStatus;
      metadata?: Record<string, unknown>;
      /** Provayderga qaytariladigan javob (JSON-RPC natijasi va h.k.). */
      response: unknown;
    }
  | {
      ok: false;
      reason: RejectReason | "bad_signature" | "bad_request" | "unauthorized";
      /** Provayder kutgan shakldagi xato javobi. */
      response: unknown;
      status?: number;
    };

export type StatusResult =
  | { ok: true; status: PaymentStatus; providerTransactionId?: string }
  | { ok: false; reason: string };

export type MutationResult = { ok: true } | { ok: false; reason: string };

export interface PaymentProvider {
  readonly id: PaymentProviderId;

  capabilities(): ProviderCapabilities;

  /** To'lovni boshlash — foydalanuvchiga havola qaytaradi. */
  initializePayment(input: {
    orderCode: string;
    amount: number;
    currency: string;
    botId: string;
    returnUrl?: string;
  }): Promise<InitResult>;

  /**
   * Kelgan so'rovni TEKSHIRADI va nima qilish kerakligini aytadi.
   *
   * Bu yerda bazaga yozilmaydi — imzo, format va summani tekshirish faqat.
   * Yozishni `PaymentService` atomik tranzaksiyada bajaradi.
   */
  handleCallback(input: {
    body: unknown;
    headers: Headers;
    botId: string;
  }): Promise<CallbackOutcome>;

  /** Provayderdan holatni so'rash (tekshirish uchun). */
  getPaymentStatus(providerTransactionId: string): Promise<StatusResult>;

  /** Bekor qilish. Qo'llab-quvvatlanmasa `reason: "unsupported"`. */
  cancelPayment(providerTransactionId: string): Promise<MutationResult>;

  /** Qaytarish. Qo'llab-quvvatlanmasa `reason: "unsupported"`. */
  refundPayment(
    providerTransactionId: string,
    amount: number,
  ): Promise<MutationResult>;
}

/**
 * Hali sozlanmagan provayder uchun umumiy asos.
 *
 * MUHIM: bu SOXTA to'lov qilmaydi. Har bir amal ochiq «sozlanmagan» deb
 * rad etadi. Provayder protokoli tasdiqlanmaguncha `configured` false
 * qoladi va interfeysda «tez orada» ko'rsatiladi.
 */
export abstract class UnconfiguredProvider implements PaymentProvider {
  abstract readonly id: PaymentProviderId;

  capabilities(): ProviderCapabilities {
    return { configured: false, refund: false, cancel: false };
  }

  async initializePayment(): Promise<InitResult> {
    return { ok: false, reason: "not_configured" };
  }

  async handleCallback(): Promise<CallbackOutcome> {
    return {
      ok: false,
      reason: "unauthorized",
      response: { error: "provider not configured" },
      status: 503,
    };
  }

  async getPaymentStatus(): Promise<StatusResult> {
    return { ok: false, reason: "not_configured" };
  }

  async cancelPayment(): Promise<MutationResult> {
    return { ok: false, reason: "unsupported" };
  }

  async refundPayment(): Promise<MutationResult> {
    return { ok: false, reason: "unsupported" };
  }
}
