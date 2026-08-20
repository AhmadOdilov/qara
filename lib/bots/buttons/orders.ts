/**
 * Buyurtmalar — sof ko'rinish qatlami (§8).
 *
 * Buyurtma yozuvi `telegram_bot_payments` jadvalida yotadi (savat
 * tasdiqlanganda router yaratadi). Bu modul bazani bilmaydi: u faqat
 * yozuvni foydalanuvchi o'qiy oladigan matnga aylantiradi va holatni
 * dizayn tizimidagi rangli belgiga bog'laydi.
 *
 * Holat qiymatlari sxemada erkin matn (`pending | paid | failed | refunded`
 * va kelajakda qo'shiladiganlar), shuning uchun moslashtirish keng: noma'lum
 * qiymat «kutilmoqda» deb ko'rsatiladi, chunki jim yiqilgan holat
 * foydalanuvchini «buyurtmam qayerda?» degan savol bilan qoldiradi.
 */

import { formatMoney } from "@/lib/bots/buttons/cart";
import { botText, type BotStringKey } from "@/lib/bots/buttons/strings";
import { DEFAULT_CURRENCY } from "@/lib/bots/buttons/types";

export type OrderItem = {
  title: string;
  qty: number;
  amount: number;
};

/** Bitta buyurtma — routerda `telegram_bot_payments` qatoridan yig'iladi. */
export type OrderRecord = {
  /// Foydalanuvchiga ko'rsatiladigan qisqa raqam (`A1B2C3`)
  code: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: Date;
  items: OrderItem[];
};

/** Ro'yxatda va tafsilotda ko'rsatiladigan holat guruhlari. */
export type OrderStage = "pending" | "processing" | "shipping" | "done" | "cancelled";

const STAGES: Record<string, OrderStage> = {
  pending: "pending",
  created: "pending",
  new: "pending",
  processing: "processing",
  preparing: "processing",
  accepted: "processing",
  paid: "processing",
  shipping: "shipping",
  shipped: "shipping",
  delivering: "shipping",
  done: "done",
  delivered: "done",
  completed: "done",
  cancelled: "cancelled",
  canceled: "cancelled",
  failed: "cancelled",
  refunded: "cancelled",
};

const STAGE_KEYS: Record<OrderStage, BotStringKey> = {
  pending: "statusPending",
  processing: "statusProcessing",
  shipping: "statusShipping",
  done: "statusDone",
  cancelled: "statusCancelled",
};

export function orderStage(status: string): OrderStage {
  return STAGES[status.trim().toLowerCase()] ?? "pending";
}

/** `🟡 Kutilmoqda` — belgi va matn birga, dizayn tizimiga muvofiq. */
export function orderStatusLabel(status: string, lang: string | null): string {
  return botText(lang, STAGE_KEYS[orderStage(status)]);
}

/**
 * Buyurtma sanasi hisoblanadigan vaqt mintaqasi.
 *
 * Telegram chatning mintaqasini bermaydi, shuning uchun bot auditoriyasi
 * uchun yagona mintaqa belgilanadi. UTC ishlatib bo'lmaydi: O'zbekistonda
 * (UTC+5) yarim kechadan 05:00 gacha berilgan buyurtma foydalanuvchiga
 * KECHAGI sana bilan ko'rinardi.
 */
export const ORDER_TIME_ZONE = "Asia/Tashkent";

/** `18.08.2026` — vaqtsiz, faqat sana. */
export function formatOrderDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ORDER_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(date)
    .replace(/\//g, ".");
}

/** Ro'yxatdagi bitta qator: `🟡 A1B2C3 — 500 000 so'm · 17.08.2026`. */
export function orderLine(order: OrderRecord, lang: string | null): string {
  return `${orderStatusLabel(order.status, lang)} · ${order.code}\n${formatMoney(
    order.amount,
    order.currency || DEFAULT_CURRENCY,
  )} · ${formatOrderDate(order.createdAt)}`;
}

/** Ro'yxatdagi tugma yorlig'i — mobil ekranda sig'ishi kerak (§18). */
export function orderButtonLabel(order: OrderRecord, lang: string | null): string {
  const stage = botText(lang, STAGE_KEYS[orderStage(order.status)]).split(" ")[0];
  return `${stage} ${order.code} · ${formatMoney(
    order.amount,
    order.currency || DEFAULT_CURRENCY,
  )}`;
}

/** Tafsilot ekranining matni. */
export function orderText(order: OrderRecord, lang: string | null): string {
  const currency = order.currency || DEFAULT_CURRENCY;
  const lines = [
    botText(lang, "orderTitle", { order: order.code }),
    "",
    `${botText(lang, "orderStatus")}: ${orderStatusLabel(order.status, lang)}`,
    `${botText(lang, "orderDate")}: ${formatOrderDate(order.createdAt)}`,
  ];

  if (order.items.length > 0) {
    lines.push("", `${botText(lang, "orderItems")}:`);
    order.items.forEach((item, index) => {
      lines.push(
        `${index + 1}. ${item.title} × ${item.qty} — ${formatMoney(item.amount, currency)}`,
      );
    });
  }

  lines.push("", `${botText(lang, "orderTotal")}: ${formatMoney(order.amount, currency)}`);
  return lines.join("\n");
}

/**
 * Bazadagi `payload.items` ni o'qiydi.
 *
 * Yozuv eski formatda yoki buzilgan bo'lishi mumkin — bunda buyurtma
 * mahsulotlarsiz, lekin summasi bilan ko'rinadi: yarim ma'lumot ham
 * «hech narsa» dan yaxshi.
 */
export function readOrderItems(payload: unknown): OrderItem[] {
  const raw = (payload as { items?: unknown } | null | undefined)?.items;
  if (!Array.isArray(raw)) return [];

  const items: OrderItem[] = [];
  for (const entry of raw) {
    const item = entry as Partial<OrderItem>;
    const title = typeof item?.title === "string" ? item.title.trim() : "";
    const qty = Number(item?.qty);
    const amount = Number(item?.amount);
    if (!title) continue;
    items.push({
      title: title.slice(0, 64),
      qty: Number.isFinite(qty) && qty > 0 ? Math.trunc(qty) : 1,
      amount: Number.isFinite(amount) ? amount : 0,
    });
  }
  return items;
}
