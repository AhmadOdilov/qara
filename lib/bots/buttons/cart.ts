/**
 * Savat — sof hisob.
 *
 * Savatda faqat mahsulot tugmasining id'si va soni saqlanadi. Narx, nom va
 * valyuta HAR SAFAR nashr etilgan daraxtdan o'qiladi: shu sababli egasi narxni
 * o'zgartirsa savat ham darhol to'g'ri summani ko'rsatadi va savat ichida
 * eskirgan narx qolib ketmaydi.
 *
 * Bazaga yozish bu yerda emas — router qaytgan natijani saqlaydi. Shu sababli
 * savat mantig'i sinovda ham, jonli botda ham bir xil kod bilan ishlaydi.
 */

import {
  buttonLabel,
  DEFAULT_CURRENCY,
  productConfig,
  type ButtonRecord,
  type ProductConfig,
} from "@/lib/bots/buttons/types";

export type CartLine = {
  /// Mahsulot tugmasining id'si
  productId: string;
  qty: number;
};

export type Cart = { lines: CartLine[] };

export const EMPTY_CART: Cart = { lines: [] };

/**
 * Bitta savatdagi turlar soni.
 *
 * Chegara Telegram klaviaturasiga bog'langan: har bir qator uchun `➖ ➕ 🗑`
 * uchtala tugma chiqadi (20 × 3 = 60), ustiga «buyurtma berish», «tozalash»,
 * «mahsulot qo'shish» va navigatsiya qatorlari qo'shiladi — hammasi 100
 * tugmalik chegaraga sig'adi.
 *
 * SAQLASH chegarasi KO'RSATISH chegarasiga ataylab teng: aks holda savatchada
 * matnda ko'rinadigan, lekin boshqaruv tugmasi bo'lmagan — ya'ni o'chirib
 * bo'lmaydigan — qatorlar paydo bo'lardi.
 */
export const MAX_CART_LINES = 20;
const MAX_QTY = 99;

/* ── O'qish va o'zgartirish ──────────────────────────────────────────────── */

/** `TelegramBotUser.variables` ichidan savatni ajratib oladi. */
export function readCart(variables: unknown): Cart {
  const raw = (variables as { cart?: unknown } | null | undefined)?.cart;
  const lines = (raw as { lines?: unknown } | undefined)?.lines;
  if (!Array.isArray(lines)) return EMPTY_CART;

  const clean: CartLine[] = [];
  for (const line of lines) {
    const productId = (line as CartLine)?.productId;
    const qty = Number((line as CartLine)?.qty);
    if (typeof productId !== "string" || !productId) continue;
    if (!Number.isFinite(qty) || qty < 1) continue;
    clean.push({ productId, qty: Math.min(MAX_QTY, Math.trunc(qty)) });
    if (clean.length >= MAX_CART_LINES) break;
  }
  return { lines: clean };
}

export function addToCart(cart: Cart, productId: string, qty = 1): Cart {
  const step = Math.min(MAX_QTY, Math.max(1, Math.trunc(qty)));
  const existing = cart.lines.find((line) => line.productId === productId);

  if (existing) {
    return {
      lines: cart.lines.map((line) =>
        line.productId === productId
          ? { ...line, qty: Math.min(MAX_QTY, line.qty + step) }
          : line,
      ),
    };
  }
  if (cart.lines.length >= MAX_CART_LINES) return cart;
  return { lines: [...cart.lines, { productId, qty: step }] };
}

/**
 * Miqdorni bittaga kamaytiradi; oxirgisi olib tashlansa qator butunlay
 * chiqib ketadi — «1 tadan 0 ta» degan holat savatchada ko'rinmasligi kerak.
 */
export function decFromCart(cart: Cart, productId: string): Cart {
  const lines: CartLine[] = [];
  for (const line of cart.lines) {
    if (line.productId !== productId) {
      lines.push(line);
      continue;
    }
    if (line.qty > 1) lines.push({ ...line, qty: line.qty - 1 });
  }
  return { lines };
}

export function removeFromCart(cart: Cart, productId: string): Cart {
  return { lines: cart.lines.filter((line) => line.productId !== productId) };
}

/** Shu mahsulot savatchada nechta. Yo'q bo'lsa — 0. */
export function cartQtyOf(cart: Cart, productId: string): number {
  return cart.lines.find((line) => line.productId === productId)?.qty ?? 0;
}

export function cartCount(cart: Cart): number {
  return cart.lines.reduce((total, line) => total + line.qty, 0);
}

/* ── Narx bilan birlashtirish ────────────────────────────────────────────── */

export type ResolvedLine = {
  button: ButtonRecord;
  config: ProductConfig;
  qty: number;
  /// Narx × soni
  amount: number;
};

/**
 * Savat qatorlarini daraxt bilan birlashtiradi.
 *
 * O'chirilgan yoki nashrdan chiqib ketgan mahsulot jim tashlab yuboriladi —
 * foydalanuvchi mavjud bo'lmagan tovar uchun to'lov oynasiga tushmasligi kerak.
 */
export function resolveCart(all: ButtonRecord[], cart: Cart): ResolvedLine[] {
  const lines: ResolvedLine[] = [];
  for (const line of cart.lines) {
    const button = all.find(
      (candidate) => candidate.id === line.productId && candidate.actionType === "product",
    );
    if (!button) continue;
    const config = productConfig(button);
    const price = Number(config.price) || 0;
    lines.push({ button, config, qty: line.qty, amount: price * line.qty });
  }
  return lines;
}

export function cartTotal(lines: ResolvedLine[]): number {
  return lines.reduce((total, line) => total + line.amount, 0);
}

/** Savatdagi birinchi mahsulotning valyutasi — aralash savat kutilmaydi. */
export function cartCurrency(lines: ResolvedLine[]): string {
  return lines[0]?.config.currency?.trim() || DEFAULT_CURRENCY;
}

/* ── Ko'rinish ───────────────────────────────────────────────────────────── */

/** `12500000` → `12 500 000 so'm`. */
export function formatMoney(amount: number, currency = DEFAULT_CURRENCY): string {
  const rounded = Math.round(Number.isFinite(amount) ? amount : 0);
  const grouped = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const sign = rounded < 0 ? "-" : "";
  const unit = currency.toUpperCase() === "UZS" ? "so'm" : currency.toUpperCase();
  return `${sign}${grouped} ${unit}`;
}

export function productTitle(button: ButtonRecord, config: ProductConfig): string {
  return config.title?.trim() || buttonLabel(button);
}

/** Mahsulot omborda bormi. `stock` ko'rsatilmagan bo'lsa — hisob yuritilmaydi. */
export function inStock(config: ProductConfig): boolean {
  return config.stock === null || config.stock === undefined || config.stock > 0;
}
