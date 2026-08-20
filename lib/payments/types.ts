/**
 * To'lov domeni (§P3).
 *
 * Bu modul SOF: tarmoq ham, baza ham yo'q. Holat mashinasi shu yerda
 * yashaydi va to'liq test qilinadi — noto'g'ri o'tish bazaga yozilishidan
 * OLDIN to'xtatiladi.
 *
 * BUYURTMA va TO'LOV ataylab ajratilgan:
 *   · buyurtma  — `telegram_bot_payments` (savat mahsulotlari, summa)
 *   · to'lov    — `telegram_bot_payment_transactions` (provayder urinishi)
 * Bitta buyurtmada bir nechta urinish bo'lishi mumkin: birinchisi bekor
 * qilinadi, ikkinchisi o'tadi.
 */

/** To'lov urinishining holati. */
export const PAYMENT_STATUSES = [
  "created",
  "pending",
  "processing",
  "paid",
  "failed",
  "expired",
  "cancelled",
  "refunded",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Buyurtma holati — mavjud yozuvlar bilan mos (`pending` standart). */
export const ORDER_STATUSES = [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_PROVIDERS = ["payme", "click"] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDERS)[number];

/**
 * Ruxsat etilgan o'tishlar.
 *
 * Yakuniy holatlardan (`paid` dan tashqari) chiqib bo'lmaydi: `failed → paid`
 * yoki `refunded → paid` mumkin emas. `paid → refunded` esa yagona ochiq yo'l.
 */
const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  created: ["pending", "processing", "paid", "failed", "expired", "cancelled"],
  pending: ["processing", "paid", "failed", "expired", "cancelled"],
  processing: ["paid", "failed", "expired", "cancelled"],
  paid: ["refunded"],
  failed: [],
  expired: [],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return true; // Takroriy callback — o'zgarish yo'q, xato ham yo'q.
  return TRANSITIONS[from].includes(to);
}

/** Holat yakuniymi — bunga tegib bo'lmaydi. */
export function isTerminal(status: PaymentStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** To'lov holati buyurtmani qanday holatga olib keladi. */
export function orderStatusFor(payment: PaymentStatus): OrderStatus {
  switch (payment) {
    case "paid":
      return "paid";
    case "refunded":
      return "refunded";
    case "failed":
      return "failed";
    case "cancelled":
    case "expired":
      return "cancelled";
    default:
      return "pending";
  }
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    typeof value === "string" &&
    (PAYMENT_STATUSES as readonly string[]).includes(value)
  );
}

export function isProviderId(value: unknown): value is PaymentProviderId {
  return (
    typeof value === "string" &&
    (PAYMENT_PROVIDERS as readonly string[]).includes(value)
  );
}

/* ── Tekshiruvlar ────────────────────────────────────────────────────────── */

/**
 * Callback rad etilish sabablari.
 *
 * Har biri ALOHIDA sabab: provayderga qaytariladigan xato kodi adapterda
 * shu sabablardan hosil qilinadi.
 */
export type RejectReason =
  | "order_not_found"
  | "payment_not_found"
  | "amount_mismatch"
  | "currency_mismatch"
  | "invalid_state"
  | "wrong_bot"
  | "already_finalized";

export type CheckResult = { ok: true } | { ok: false; reason: RejectReason };

/**
 * Callback ma'lumoti buyurtmaga mos keladimi.
 *
 * Summa va valyuta AYNAN mos kelishi kerak: provayder aytgan summa
 * buyurtmadan farq qilsa, bu yo xato integratsiya, yo manipulyatsiya —
 * ikkalasida ham to'lovni qabul qilib bo'lmaydi.
 */
export function checkAgainstOrder(input: {
  order: { botId: string; amount: number; currency: string; status: string } | null;
  botId: string;
  amount: number;
  currency: string;
}): CheckResult {
  if (!input.order) return { ok: false, reason: "order_not_found" };
  if (input.order.botId !== input.botId) return { ok: false, reason: "wrong_bot" };
  if (input.order.amount !== input.amount) {
    return { ok: false, reason: "amount_mismatch" };
  }
  if (
    input.order.currency.toUpperCase() !== input.currency.toUpperCase()
  ) {
    return { ok: false, reason: "currency_mismatch" };
  }
  return { ok: true };
}
