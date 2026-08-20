/**
 * `callback_data` formati — kodlash, o'qish va cheklov tekshiruvi.
 *
 * Ikki xil callback bor:
 *
 *   1. Tugma callback'i — tugmaning `callbackId` si o'zgarishsiz ketadi
 *      (`btn_1a2b3c4d`). Ma'nosi yo'q, faqat ko'rsatgich: server shu bo'yicha
 *      tugmani nashr etilgan daraxtdan topadi va amalni O'ZI aniqlaydi.
 *
 *   2. Tizim callback'i — daraxtda yozuvi bo'lmagan ekranlar va buyruqlar.
 *      Hammasi `<bo'lim>:<amal>[:<ko'rsatgich>]` shaklida:
 *
 *        nav:home            nav:back            nav:back:<menu>
 *        cart:open           cart:add:<p>        cart:buy:<p>
 *        cart:inc:<p>        cart:dec:<p>        cart:del:<p>
 *        cart:clear          cart:checkout
 *        fav:list            fav:on:<p>          fav:clear
 *        ord:list            ord:one:<kod>
 *        acct:profile        acct:settings
 *        acct:name           acct:phone          info:help
 *
 * TAKRORLANISH BO'LMAYDI: tizim callback'lari doim `:` bilan bo'linadi va
 * yuqoridagi beshta bo'lim nomidan (`nav`, `cart`, `fav`, `ord`, `acct`,
 * `info`) boshlanadi. Tugma ko'rsatgichi esa `btn_` bilan boshlanadi va ichida
 * `:` bo'lmaydi (`newCallbackId`). Ikki fazo kesishmaydi, shuning uchun yangi
 * ekran qo'shilganda mavjud tugmalar buzilmaydi.
 *
 * MUHIM (§17): callback ichida hech qachon maxfiy ma'lumot bo'lmaydi — na
 * foydalanuvchi id'si, na narx, na token. Faqat opaque ko'rsatgich va
 * foydalanuvchining o'ziga ko'rsatilgan buyurtma raqami. Shu sababli
 * callback'ni qo'lda yasab yuborish hech qanday imtiyoz bermaydi: ruxsat va
 * egalik har bosishda server tomonda qaytadan tekshiriladi.
 *
 * Bu fayl klientda ham ishlatiladi (konstruktordagi jonli preview) — shuning
 * uchun `server-only` emas va sof funksiyalardan iborat.
 */

import { TELEGRAM_LIMITS } from "@/lib/bots/buttons/types";

/** Ildiz menyusini belgilaydigan ko'rsatgich — tugma id'si emas. */
export const ROOT_MENU = "_";

export const NAV = {
  home: "nav:home",
  /// Menyu tarixidan bitta orqaga (reply klaviatura va eski suratlar uchun)
  back: "nav:back",
  cartOpen: "cart:open",
  cartClear: "cart:clear",
  cartCheckout: "cart:checkout",
  favorites: "fav:list",
  favoritesClear: "fav:clear",
  orders: "ord:list",
  profile: "acct:profile",
  settings: "acct:settings",
  setName: "acct:name",
  sharePhone: "acct:phone",
  help: "info:help",
} as const;

/**
 * Muayyan menyuga qaytaradigan «orqaga».
 *
 * Manzil callback ichida turgani uchun tugma xabar qanchalik eski bo'lsa ham
 * to'g'ri ishlaydi — server holati yo'qolgan bo'lsa ham. Aynan shu narsa
 * professional botlarda navigatsiyani ishonchli qiladi.
 */
export function backTo(menu: string | null | undefined): string {
  if (menu === undefined) return NAV.back;
  return `${NAV.back}:${menu ?? ROOT_MENU}`;
}

/**
 * Mahsulotni savatchaga qo'shish. `then` — qo'shgandan keyin qayerda qolish:
 * mahsulot kartasida (`stay`) yoki darhol savatchada (`cart`, «hozir sotib
 * olish»).
 */
export function cartAdd(product: string, then: "stay" | "cart" = "stay"): string {
  return then === "cart" ? `cart:buy:${product}` : `cart:add:${product}`;
}

/**
 * Savatchadagi miqdorni o'zgartirish va qatorni o'chirish (§6).
 *
 * `then` — amaldan keyin qaysi ekran ko'rsatiladi. Bir xil tugmalar ikki
 * joyda turadi (savatcha ro'yxati va mahsulot kartasi), foydalanuvchi esa
 * bosgan joyida qolishi kerak — shuning uchun manzil callback ichida ketadi.
 */
export function cartQty(
  product: string,
  op: "inc" | "dec" | "del",
  then: "cart" | "product" = "cart",
): string {
  return then === "product" ? `cart:${op}:${product}:p` : `cart:${op}:${product}`;
}

/** Sevimlilarga qo'shish yoki olib tashlash — bitta tugma, holatga qarab. */
export function favoriteToggle(product: string): string {
  return `fav:on:${product}`;
}

/** Bitta buyurtmaning tafsiloti. Raqam foydalanuvchiga baribir ko'rsatilgan. */
export function orderDetail(code: string): string {
  return `ord:one:${code}`;
}

export type ParsedCallback =
  | { kind: "button"; id: string }
  | { kind: "home" }
  /// `menu === undefined` — tarixdan bitta orqaga; `null` — ildizga
  | { kind: "back"; menu: string | null | undefined }
  | { kind: "cart_add"; product: string; then: "stay" | "cart" }
  | {
      kind: "cart_qty";
      product: string;
      op: "inc" | "dec" | "del";
      then: "cart" | "product";
    }
  | { kind: "cart_open" }
  | { kind: "cart_clear" }
  | { kind: "cart_checkout" }
  | { kind: "favorites" }
  | { kind: "favorite_toggle"; product: string }
  | { kind: "favorites_clear" }
  | { kind: "orders" }
  | { kind: "order"; code: string }
  | { kind: "profile" }
  | { kind: "settings" }
  | { kind: "set_name" }
  | { kind: "share_phone" }
  | { kind: "help" }
  | { kind: "language"; lang: string };

const LANGUAGE = /^btn_lang_(uz|ru|en)$/;

/**
 * «Orqaga» tugmasining eski formati.
 *
 * Foydalanuvchi chatidagi eski xabarlarda hamon shu qiymat turadi, shuning
 * uchun u tushunilishi kerak — aks holda nashrdan keyin eski xabarlardagi
 * tugmalar jim ishlamay qolardi.
 */
const LEGACY_BACK = "btn_back";

/** Telegram'dan kelgan `callback_data` ni o'qiydi. */
export function parseCallback(data: string): ParsedCallback {
  const language = data.match(LANGUAGE);
  if (language) return { kind: "language", lang: language[1] };

  if (data === NAV.home) return { kind: "home" };
  if (data === LEGACY_BACK) return { kind: "back", menu: undefined };
  if (data === NAV.back) return { kind: "back", menu: undefined };
  if (data.startsWith(`${NAV.back}:`)) {
    const target = data.slice(NAV.back.length + 1);
    return { kind: "back", menu: target === ROOT_MENU ? null : target };
  }

  if (data === NAV.cartOpen) return { kind: "cart_open" };
  if (data === NAV.cartClear) return { kind: "cart_clear" };
  if (data === NAV.cartCheckout) return { kind: "cart_checkout" };
  if (data.startsWith("cart:add:")) {
    return { kind: "cart_add", product: data.slice("cart:add:".length), then: "stay" };
  }
  if (data.startsWith("cart:buy:")) {
    return { kind: "cart_add", product: data.slice("cart:buy:".length), then: "cart" };
  }
  for (const op of ["inc", "dec", "del"] as const) {
    const prefix = `cart:${op}:`;
    if (!data.startsWith(prefix)) continue;
    const rest = data.slice(prefix.length);
    const product = rest.endsWith(":p") ? rest.slice(0, -2) : rest;
    return {
      kind: "cart_qty",
      product,
      op,
      then: rest.endsWith(":p") ? "product" : "cart",
    };
  }

  if (data === NAV.favorites) return { kind: "favorites" };
  if (data === NAV.favoritesClear) return { kind: "favorites_clear" };
  if (data.startsWith("fav:on:")) {
    return { kind: "favorite_toggle", product: data.slice("fav:on:".length) };
  }

  if (data === NAV.orders) return { kind: "orders" };
  if (data.startsWith("ord:one:")) {
    return { kind: "order", code: data.slice("ord:one:".length) };
  }

  if (data === NAV.profile) return { kind: "profile" };
  if (data === NAV.settings) return { kind: "settings" };
  if (data === NAV.setName) return { kind: "set_name" };
  if (data === NAV.sharePhone) return { kind: "share_phone" };
  if (data === NAV.help) return { kind: "help" };

  return { kind: "button", id: data };
}

/* ── Cheklov ─────────────────────────────────────────────────────────────── */

/** Telegram `callback_data` ni 64 baytgacha qabul qiladi. */
export function callbackBytes(data: string): number {
  return new TextEncoder().encode(data).length;
}

export function callbackFits(data: string): boolean {
  const size = callbackBytes(data);
  return size > 0 && size <= TELEGRAM_LIMITS.callbackBytes;
}

/**
 * Eng uzun bo'lishi mumkin bo'lgan callback — validatsiya shu bo'yicha
 * ogohlantiradi, chunki tugma bosilgandan keyin emas, nashrdan oldin
 * bilish kerak.
 */
export function longestCallbackFor(callbackId: string): string {
  return backTo(callbackId);
}
