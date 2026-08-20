/**
 * Navigatsiya dvigateli — «qaysi ekran ko'rsatilsin» degan savolga javob.
 *
 * To'liq SOF: baza, tarmoq va Telegram bu yerda yo'q. Kirish — nashr etilgan
 * daraxt, foydalanuvchi konteksti, savatcha, sevimlilar va buyurtmalar;
 * chiqish — matn bilan klaviatura. Shu sababli 5 qatlamli ichma-ich menyuni
 * ham, savatcha oqimini ham bazasiz sinab bo'ladi, jonli bot esa aynan shu
 * funksiyalarni chaqiradi.
 *
 * EKRANLAR:
 *
 *   menuView       ichma-ich menyu (ildiz, kategoriya, subkategoriya)
 *   productView    mahsulot kartasi: narx, ombor, miqdor, sevimlilar
 *   cartView       savatcha: qatorlar, ➖/➕/🗑, buyurtma berish
 *   ordersView     buyurtmalar ro'yxati — holat belgilari bilan
 *   orderView      bitta buyurtma tafsiloti
 *   favoritesView  sevimlilar
 *   profileView    profil, settingsView — sozlamalar
 *   helpView       yordam
 *   fallbackView   xato va eskirgan tugma holatlari
 *
 * Har bir ekranda chiqish yo'li bor: `⬅️ Ortga` doim oldingi mantiqiy joyga
 * qaytaradi, `🏠 Bosh menyu` esa istalgan chuqurlikdan ildizga. Bo'sh
 * ekranlarda esa navigatsiyadan tashqari yana bir qadam taklif qilinadi
 * («🛍 Mahsulotlarni ko'rish») — foydalanuvchi boshi berk ko'chada qolmaydi.
 *
 * «Orqaga» ikki xil ishlaydi:
 *
 *   • inline klaviaturada manzil callback ichida turadi (`nav:back:<menu>`) —
 *     shuning uchun tugma xabar necha kunlik bo'lsa ham va server holati
 *     yo'qolgan bo'lsa ham to'g'ri joyga qaytaradi;
 *   • reply klaviaturada tugma oddiy matn bo'lgani uchun manzilni tashib
 *     bo'lmaydi — u menyu tarixidan (`stack`) foydalanadi.
 */

import {
  backTo,
  cartAdd,
  cartQty,
  favoriteToggle,
  NAV,
  orderDetail,
  type ParsedCallback,
} from "@/lib/bots/buttons/callback";
import {
  cartCurrency,
  cartQtyOf,
  cartTotal,
  formatMoney,
  inStock,
  MAX_CART_LINES,
  productTitle,
  resolveCart,
  type Cart,
  type ResolvedLine,
} from "@/lib/bots/buttons/cart";
import { backLabel, compileMenu, homeLabel, isHttps } from "@/lib/bots/buttons/compiler";
import {
  isFavorite,
  MAX_FAVORITES,
  resolveFavorites,
  type Favorites,
} from "@/lib/bots/buttons/favorites";
import {
  layoutOf,
  menuDepth,
  menuExists,
  menuHeading,
  menuPath,
  menuSettings,
  resolveMenuTarget,
} from "@/lib/bots/buttons/menu";
import {
  orderButtonLabel,
  orderLine,
  orderText,
  type OrderRecord,
} from "@/lib/bots/buttons/orders";
import { botText } from "@/lib/bots/buttons/strings";
import {
  buttonLabel,
  menuConfig,
  opensMenu,
  productConfig,
  type ButtonRecord,
  type InlineKeyboardButton,
  type ReplyKeyboardOptions,
  type ReplyMarkup,
} from "@/lib/bots/buttons/types";
import { isVisibleTo, type ViewerContext } from "@/lib/bots/buttons/visibility";

/** Menyu tarixi qanchalik chuqur saqlanadi. */
export const MAX_STACK = 20;

/**
 * Ro'yxat ekranlarida ko'rsatiladigan yozuv soni (§18).
 *
 * Savatcha va sevimlilar uchun chegara saqlash chegarasiga teng
 * (`MAX_CART_LINES`, `MAX_FAVORITES`) — foydalanuvchi qo'shgan narsa ro'yxatda
 * doim ko'rinadi va boshqariladi. Buyurtmalar esa tarix: eng oxirgi 10 tasi
 * ko'rsatiladi, qolgani bazada qoladi.
 */
const MAX_ORDERS = 10;

/** «Orqaga» qayerga qaytaradi. */
export type BackTarget =
  /// Aniq menyu (`null` — ildiz). Callback ichida ketadi.
  | { kind: "menu"; menuId: string | null }
  /// Menyu tarixidan bitta orqaga — reply klaviatura yo'li.
  | { kind: "stack" }
  | { kind: "none" };

export type ViewRequest = {
  viewer: ViewerContext;
  replyOptions?: ReplyKeyboardOptions;
  /// Ildiz menyusi sarlavhasi (`/start` javobi)
  rootText?: string;
  /// Foydalanuvchining savatchasi — mahsulot kartasidagi miqdor uchun
  cart?: Cart;
  /// Sevimlilar ro'yxati — mahsulot kartasidagi ❤️ tugmasi uchun
  favorites?: Favorites;
};

export type View = {
  text: string;
  markup: ReplyMarkup;
  /// Ko'rsatilgan menyu (mahsulot va savatcha ekrani uchun — ota menyu)
  menuId: string | null;
  visible: ButtonRecord[];
  /// Xabarni joyida tahrirlash mumkinmi — inline klaviatura uchun `true`
  editable: boolean;
};

/* ── Menyu ekrani ────────────────────────────────────────────────────────── */

/**
 * Menyuni ko'rsatadigan ekran.
 *
 * «🏠 Bosh menyu» ikki holatda chiqadi: menyu ikki yoki undan chuqur bo'lsa
 * (bir bosishda ildizga qaytish uchun) yoki tugun sozlamasida ataylab
 * yoqilgan bo'lsa.
 */
export function menuView(
  all: ButtonRecord[],
  menuId: string | null,
  back: BackTarget,
  req: ViewRequest,
): View {
  const settings = menuSettings(all, menuId);
  const depth = menuDepth(all, menuId);
  const lang = req.viewer.languageCode;
  const compiled = compileMenu(all, {
    parentId: menuId,
    viewer: req.viewer,
    withBack: back.kind !== "none",
    ...(back.kind === "menu" ? { backTo: back.menuId } : {}),
    withHome: menuId !== null && (settings.showHome === true || depth >= 2),
    replyOptions: req.replyOptions,
  });

  const fallback = req.rootText ?? rootHeading(lang);
  const heading = menuHeading(all, menuId, fallback);

  return {
    text: compiled.visible.length > 0 ? heading : emptyText(settings.emptyText, menuId, lang),
    markup: compiled.markup,
    menuId,
    visible: compiled.visible,
    editable: compiled.kind === "inline",
  };
}

/** Ildiz menyusi. */
export function rootView(all: ButtonRecord[], req: ViewRequest): View {
  return menuView(all, null, { kind: "none" }, req);
}

/**
 * Tugma bosilganda ochiladigan menyu.
 *
 * «Orqaga» hozir turgan menyuga qaytaradi — ulangan menyu (`targetId`) bo'lsa
 * ham to'g'ri ishlashi uchun manzil daraxtdan emas, kelgan joydan olinadi.
 */
export function openMenuView(
  all: ButtonRecord[],
  button: ButtonRecord,
  from: string | null,
  req: ViewRequest,
): View {
  const target = resolveMenuTarget(all, button);
  return menuView(all, target, { kind: "menu", menuId: from }, req);
}

/**
 * «Orqaga» bosilgandan keyingi ekran.
 *
 * `target === undefined` — manzil ma'lum emas (reply klaviatura yoki eski
 * xabar), shuning uchun tarixdan foydalaniladi.
 */
export function backView(
  all: ButtonRecord[],
  target: string | null | undefined,
  stack: string[],
  req: ViewRequest,
): { view: View; stack: string[] } {
  if (target !== undefined) {
    const menuId = menuExists(all, target) ? target : null;
    return {
      view: menuView(all, menuId, backTargetFor(all, menuId), req),
      stack: stackFor(all, menuId),
    };
  }

  const trimmed = sanitizeStack(all, stack).slice(0, -1);
  const menuId = trimmed[trimmed.length - 1] ?? null;
  return {
    view: menuView(all, menuId, backTargetFor(all, menuId), req),
    stack: trimmed,
  };
}

/** Menyuning ota menyusiga qaytaradigan manzil. */
export function backTargetFor(all: ButtonRecord[], menuId: string | null): BackTarget {
  if (menuId === null) return { kind: "none" };
  const path = menuPath(all, menuId);
  const owner = path[path.length - 1];
  return { kind: "menu", menuId: owner?.parentId ?? null };
}

/* ── Mahsulot kartasi ────────────────────────────────────────────────────── */

/**
 * Bitta mahsulot ekrani (§5).
 *
 * Narx va omborni doim daraxtdan o'qiydi: savatchaga qo'shilgandan keyin ham
 * bir xil karta ko'rinadi, faqat miqdor tugmasi paydo bo'ladi va callback
 * javobida qisqa bildirishnoma chiqadi.
 *
 * Rasm alohida tugma bilan ochiladi: karta matnli xabar bo'lib qolishi kerak,
 * aks holda ichma-ich navigatsiya (xabarni joyida tahrirlash) buzilardi.
 */
export function productView(
  all: ButtonRecord[],
  button: ButtonRecord,
  req: ViewRequest,
): View {
  const config = productConfig(button);
  const lang = req.viewer.languageCode;
  const currency = config.currency?.trim() || undefined;
  const available = inStock(config);
  const qty = req.cart ? cartQtyOf(req.cart, button.id) : 0;

  const lines = [productTitle(button, config)];
  if (config.description?.trim()) lines.push("", config.description.trim());
  if (typeof config.price === "number" && config.price > 0) {
    lines.push("", `${botText(lang, "price")}: ${formatMoney(config.price, currency)}`);
  }
  lines.push("", botText(lang, available ? "inStock" : "outOfStock"));

  const keyboard: InlineKeyboardButton[][] = [];
  const pointer = button.callbackId;

  if (available && pointer) {
    if (qty > 0) {
      // Savatchada bor mahsulot: miqdorni shu yerdan boshqaramiz va o'rtadagi
      // tugma savatchani ochadi — «qo'shdim, endi qayerda?» savoli tug'ilmaydi.
      keyboard.push([
        { text: "➖", callback_data: cartQty(pointer, "dec", "product") },
        { text: botText(lang, "inCart", { qty }), callback_data: NAV.cartOpen },
        { text: "➕", callback_data: cartQty(pointer, "inc", "product") },
      ]);
      keyboard.push([
        { text: botText(lang, "checkout"), callback_data: NAV.cartCheckout },
      ]);
    } else {
      keyboard.push([
        { text: botText(lang, "addToCart"), callback_data: cartAdd(pointer) },
      ]);
      if (config.buyNow !== false) {
        keyboard.push([
          { text: botText(lang, "buyNow"), callback_data: cartAdd(pointer, "cart") },
        ]);
      }
    }
  }

  const extras: InlineKeyboardButton[] = [];
  if (pointer) {
    extras.push({
      text: botText(lang, isFavorite(req.favorites, button.id) ? "favoriteRemove" : "favoriteAdd"),
      callback_data: favoriteToggle(pointer),
    });
  }
  if (isHttps(config.photoUrl)) {
    extras.push({ text: botText(lang, "viewPhoto"), url: config.photoUrl! });
  }
  if (extras.length > 0) keyboard.push(extras);

  keyboard.push(screenNav(button.parentId, lang));

  return {
    text: lines.join("\n"),
    markup: { inline_keyboard: keyboard },
    menuId: button.parentId,
    visible: [],
    editable: true,
  };
}

/* ── Savatcha (§6) ───────────────────────────────────────────────────────── */

/**
 * Savatcha ekrani.
 *
 * Har bir qator uchun ➖ / ➕ / 🗑 tugmalari beriladi va ular matndagi
 * raqamlangan ro'yxatga mos keladi — mobil ekranda uzun yorliqlar sig'masligi
 * uchun tugmada faqat raqam turadi.
 */
export function cartView(
  all: ButtonRecord[],
  cart: Cart,
  from: string | null,
  req: ViewRequest,
): View {
  const lang = req.viewer.languageCode;
  const lines = resolveCart(all, cart);
  const keyboard: InlineKeyboardButton[][] = [];

  if (lines.length === 0) {
    // Bo'sh savatcha boshi berk ko'cha bo'lmasligi kerak (§14).
    const entry = catalogEntry(all, req.viewer);
    if (entry) keyboard.push([entry]);
    keyboard.push(screenNav(from, lang));
    return {
      text: `${botText(lang, "cartEmpty")}\n\n${botText(lang, "cartEmptyHint")}`,
      markup: { inline_keyboard: keyboard },
      menuId: from,
      visible: [],
      editable: true,
    };
  }

  keyboard.push([{ text: botText(lang, "checkout"), callback_data: NAV.cartCheckout }]);

  lines.slice(0, MAX_CART_LINES).forEach((line, index) => {
    const pointer = line.button.callbackId;
    if (!pointer) return;
    const mark = indexLabel(index);
    keyboard.push([
      { text: `➖ ${mark}`, callback_data: cartQty(pointer, "dec") },
      { text: `➕ ${mark}`, callback_data: cartQty(pointer, "inc") },
      { text: `🗑 ${mark}`, callback_data: cartQty(pointer, "del") },
    ]);
  });

  const bottom: InlineKeyboardButton[] = [];
  const entry = catalogEntry(all, req.viewer);
  if (entry) bottom.push({ ...entry, text: botText(lang, "addMore") });
  bottom.push({ text: botText(lang, "clearCart"), callback_data: NAV.cartClear });
  keyboard.push(bottom);

  keyboard.push(screenNav(from, lang));

  return {
    text: cartText(lines, lang),
    markup: { inline_keyboard: keyboard },
    menuId: from,
    visible: [],
    editable: true,
  };
}

export function cartText(lines: ResolvedLine[], lang: string | null): string {
  if (lines.length === 0) {
    return `${botText(lang, "cartEmpty")}\n\n${botText(lang, "cartEmptyHint")}`;
  }

  const currency = cartCurrency(lines);
  const rows = lines.map((line, index) => {
    const price = line.config.currency?.trim() || currency;
    const unit = line.qty > 1 ? ` = ${formatMoney(line.amount, price)}` : "";
    return [
      `${indexLabel(index)} ${productTitle(line.button, line.config)}`,
      `${line.qty} × ${formatMoney(line.amount / line.qty, price)}${unit}`,
    ].join("\n");
  });

  const count = lines.reduce((total, line) => total + line.qty, 0);
  return [
    botText(lang, "cartTitle"),
    "",
    ...rows,
    "",
    `${botText(lang, "cartCount", { count })} · ${botText(lang, "cartTotal")}: ${formatMoney(
      cartTotal(lines),
      currency,
    )}`,
  ].join("\n");
}

/* ── Buyurtmalar (§8) ────────────────────────────────────────────────────── */

/** Buyurtmalar ro'yxati — har biri holat belgisi bilan, bosilsa tafsilot. */
export function ordersView(
  all: ButtonRecord[],
  orders: OrderRecord[],
  from: string | null,
  req: ViewRequest,
): View {
  const lang = req.viewer.languageCode;
  const keyboard: InlineKeyboardButton[][] = [];

  if (orders.length === 0) {
    const entry = catalogEntry(all, req.viewer);
    if (entry) keyboard.push([entry]);
    keyboard.push(screenNav(from, lang));
    return {
      text: `${botText(lang, "ordersEmpty")}\n\n${botText(lang, "ordersEmptyHint")}`,
      markup: { inline_keyboard: keyboard },
      menuId: from,
      visible: [],
      editable: true,
    };
  }

  const shown = orders.slice(0, MAX_ORDERS);
  for (const order of shown) {
    keyboard.push([
      { text: orderButtonLabel(order, lang), callback_data: orderDetail(order.code) },
    ]);
  }
  keyboard.push(screenNav(from, lang));

  return {
    // Har bir buyurtma ikki qatordan iborat, shuning uchun ular o'zaro bo'sh
    // qator bilan ajratiladi, blok esa sarlavha va izohga bitta bo'sh qator
    // bilan ulanadi — aks holda matnda to'rt qatorlik bo'shliq ochilardi.
    text: [
      botText(lang, "ordersTitle"),
      "",
      shown.map((order) => orderLine(order, lang)).join("\n\n"),
      "",
      botText(lang, "ordersHint"),
    ].join("\n"),
    markup: { inline_keyboard: keyboard },
    menuId: from,
    visible: [],
    editable: true,
  };
}

/** Bitta buyurtma. «Orqaga» ro'yxatga qaytaradi — kelgan yo'l shu. */
export function orderView(order: OrderRecord, req: ViewRequest): View {
  const lang = req.viewer.languageCode;
  return {
    text: orderText(order, lang),
    markup: {
      inline_keyboard: [
        [{ text: backLabel(lang), callback_data: NAV.orders }],
        [{ text: homeLabel(lang), callback_data: NAV.home }],
      ],
    },
    menuId: null,
    visible: [],
    editable: true,
  };
}

/* ── Sevimlilar ──────────────────────────────────────────────────────────── */

export function favoritesView(
  all: ButtonRecord[],
  favorites: Favorites,
  from: string | null,
  req: ViewRequest,
): View {
  const lang = req.viewer.languageCode;
  const items = resolveFavorites(all, favorites).filter((item) =>
    isVisibleTo(item.button, req.viewer),
  );
  const keyboard: InlineKeyboardButton[][] = [];

  if (items.length === 0) {
    const entry = catalogEntry(all, req.viewer);
    if (entry) keyboard.push([entry]);
    keyboard.push(screenNav(from, lang));
    return {
      text: `${botText(lang, "favoritesEmpty")}\n\n${botText(lang, "favoritesEmptyHint")}`,
      markup: { inline_keyboard: keyboard },
      menuId: from,
      visible: [],
      editable: true,
    };
  }

  for (const item of items.slice(0, MAX_FAVORITES)) {
    if (!item.button.callbackId) continue;
    const price =
      typeof item.config.price === "number" && item.config.price > 0
        ? ` · ${formatMoney(item.config.price, item.config.currency?.trim() || undefined)}`
        : "";
    keyboard.push([
      {
        text: `${productTitle(item.button, item.config)}${price}`.slice(0, 64),
        callback_data: item.button.callbackId,
      },
    ]);
  }
  keyboard.push([
    { text: botText(lang, "favoritesClear"), callback_data: NAV.favoritesClear },
  ]);
  keyboard.push(screenNav(from, lang));

  return {
    text: [
      botText(lang, "favoritesTitle"),
      "",
      botText(lang, "favoritesHint"),
    ].join("\n"),
    markup: { inline_keyboard: keyboard },
    menuId: from,
    visible: [],
    editable: true,
  };
}

/* ── Profil (§7) ─────────────────────────────────────────────────────────── */

export const LANGUAGE_LABELS: Record<string, string> = {
  uz: "🇺🇿 O'zbekcha",
  ru: "🇷🇺 Русский",
  en: "🇬🇧 English",
};

/**
 * Til tanlash qatori.
 *
 * Sozlamalar ekranida ham, `change_language` tugmasida ham bitta qator
 * ishlatiladi — yorliqlar va callback'lar ikki joyda ajralib ketmasin.
 */
export function languageRow(): InlineKeyboardButton[] {
  return [
    { text: LANGUAGE_LABELS.uz, callback_data: "btn_lang_uz" },
    { text: LANGUAGE_LABELS.ru, callback_data: "btn_lang_ru" },
    { text: LANGUAGE_LABELS.en, callback_data: "btn_lang_en" },
  ];
}

/** Profil: ma'lumotlar tartibli ko'rinadi, ostida foydalanuvchining bo'limlari. */
export function profileView(
  viewerName: string | null,
  from: string | null,
  req: ViewRequest,
): View {
  const lang = req.viewer.languageCode;
  const unset = botText(lang, "profileEmpty");
  const language = LANGUAGE_LABELS[lang?.slice(0, 2) ?? "uz"] ?? unset;

  const text = [
    botText(lang, "profileTitle"),
    "",
    `${botText(lang, "profileName")}: ${viewerName?.trim() || unset}`,
    `${botText(lang, "profilePhone")}: ${req.viewer.phone?.trim() || unset}`,
    `${botText(lang, "profileEmail")}: ${req.viewer.email?.trim() || unset}`,
    `${botText(lang, "profileLanguage")}: ${language}`,
  ].join("\n");

  return {
    text,
    markup: {
      inline_keyboard: [
        [
          { text: botText(lang, "myOrders"), callback_data: NAV.orders },
          { text: botText(lang, "myFavorites"), callback_data: NAV.favorites },
        ],
        [{ text: botText(lang, "settings"), callback_data: NAV.settings }],
        screenNav(from, lang),
      ],
    },
    menuId: from,
    visible: [],
    editable: true,
  };
}

/** Sozlamalar: til, ism va telefon — hammasi shu yerdan o'zgaradi. */
export function settingsView(req: ViewRequest): View {
  const lang = req.viewer.languageCode;
  return {
    text: `${botText(lang, "settingsTitle")}\n\n${botText(lang, "settingsHint")}`,
    markup: {
      inline_keyboard: [
        languageRow(),
        [{ text: botText(lang, "changeName"), callback_data: NAV.setName }],
        [{ text: botText(lang, "sharePhone"), callback_data: NAV.sharePhone }],
        [
          { text: backLabel(lang), callback_data: NAV.profile },
          { text: homeLabel(lang), callback_data: NAV.home },
        ],
      ],
    },
    menuId: null,
    visible: [],
    editable: true,
  };
}

/* ── Yordam ──────────────────────────────────────────────────────────────── */

/** Yordam. Egasi o'z matnini yozgan bo'lsa u ishlatiladi. */
export function helpView(
  ownerText: string | null,
  from: string | null,
  req: ViewRequest,
): View {
  const lang = req.viewer.languageCode;
  const body = ownerText?.trim() || botText(lang, "helpBody");
  return {
    text: `${botText(lang, "helpTitle")}\n\n${body}`,
    markup: { inline_keyboard: [screenNav(from, lang)] },
    menuId: from,
    visible: [],
    editable: true,
  };
}

/* ── Xato ekranlari (§15) ────────────────────────────────────────────────── */

export type FallbackReason = "menuGone" | "staleButton" | "orderGone" | "somethingWrong";

/**
 * O'chirilgan menyu, eskirgan tugma yoki kutilmagan xato.
 *
 * Foydalanuvchiga texnik tafsilot ko'rsatilmaydi — faqat sabab va chiqish
 * yo'li. Chiqish yo'li doim bor: `⬅️ Ortga` (ma'lum bo'lsa) va `🏠 Bosh menyu`.
 */
export function fallbackView(
  reason: FallbackReason,
  req: ViewRequest,
  from: string | null = null,
): View {
  const lang = req.viewer.languageCode;
  const row: InlineKeyboardButton[] = [];
  if (from !== null) row.push({ text: backLabel(lang), callback_data: backTo(from) });
  row.push({ text: homeLabel(lang), callback_data: NAV.home });

  return {
    text: botText(lang, reason),
    markup: { inline_keyboard: [row] },
    menuId: from,
    visible: [],
    editable: true,
  };
}

/* ── Menyu tarixi ────────────────────────────────────────────────────────── */

/** Daraxtdan yo'qolgan menyularni tarixdan chiqaradi. */
export function sanitizeStack(all: ButtonRecord[], stack: string[]): string[] {
  const kept: string[] = [];
  for (const menuId of stack.slice(0, MAX_STACK)) {
    if (!menuExists(all, menuId)) break;
    kept.push(menuId);
  }
  return kept;
}

/** Menyuning ildizdan boshlangan to'liq yo'li — tarix shu bilan almashtiriladi. */
export function stackFor(all: ButtonRecord[], menuId: string | null): string[] {
  if (menuId === null) return [];
  return menuPath(all, menuId)
    .map((button) => button.id)
    .slice(0, MAX_STACK);
}

/* ── Yordamchilar ────────────────────────────────────────────────────────── */

/**
 * Tizim ekranlari uchun «orqaga»/«bosh menyu» qatori.
 *
 * `from === null` bo'lsa «orqaga» allaqachon ildizga qaytaradi va «bosh
 * menyu» takrorlanib qolardi — shuning uchun bitta tugma qoldiriladi.
 *
 * Yorliqlar kompilyatordan olinadi: navigatsiya matni butun tizimda bitta
 * joyda turishi kerak, aks holda reply klaviaturadagi tugma matni bilan mos
 * kelmay qolardi va `routeText` uni tanimasdi.
 */
function screenNav(from: string | null, lang: string | null): InlineKeyboardButton[] {
  const row: InlineKeyboardButton[] = [
    { text: backLabel(lang), callback_data: backTo(from) },
  ];
  if (from !== null) row.push({ text: homeLabel(lang), callback_data: NAV.home });
  return row;
}

/**
 * Katalogga olib boradigan tugma — bo'sh ekranlardagi taklif (§14).
 *
 * Ildizdagi birinchi ko'rinadigan menyu tugmasi olinadi (odatda «🛍
 * Mahsulotlar»); menyu yo'q bo'lsa `null` qaytadi va ekranda faqat
 * navigatsiya qoladi.
 */
export function catalogEntry(
  all: ButtonRecord[],
  viewer: ViewerContext,
): InlineKeyboardButton | null {
  const candidate = all
    .filter((button) => button.parentId === null && button.callbackId)
    .filter((button) => isVisibleTo(button, viewer))
    .sort((a, b) => a.rowIndex - b.rowIndex || a.sortOrder - b.sortOrder)
    .find(
      (button) =>
        opensMenu(button.actionType) || all.some((child) => child.parentId === button.id),
    );

  if (!candidate?.callbackId) return null;
  return {
    text: botText(viewer.languageCode, "browseProducts"),
    callback_data: candidate.callbackId,
  };
}

/** Ildiz menyusining sarlavhasi — sozlanmagan bo'lsa ham tushunarli. */
function rootHeading(lang: string | null): string {
  return `${botText(lang, "mainMenu")}\n\n${botText(lang, "menuHint")}`;
}

/**
 * Bo'sh ekran matni.
 *
 * Ildiz bo'sh bo'lsa bu «bo'lim bo'sh» emas, «bot hali sozlanmagan» degani —
 * foydalanuvchi nima kutishini bilishi kerak.
 */
function emptyText(
  ownerText: string | undefined,
  menuId: string | null,
  lang: string | null,
): string {
  if (ownerText?.trim()) return ownerText.trim();
  if (menuId === null) return botText(lang, "notConfigured");
  return `${botText(lang, "emptyMenu")}\n\n${botText(lang, "emptyMenuHint")}`;
}

/** `1️⃣ … 🔟`, keyin oddiy raqam — savatcha va ro'yxatlarda bir xil belgi. */
const INDEX_MARKS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

function indexLabel(index: number): string {
  return INDEX_MARKS[index] ?? `${index + 1}.`;
}

/** Konstruktor uchun: menyu tuguni haqidagi qisqa ma'lumot. */
export function menuSummary(all: ButtonRecord[], menuId: string | null) {
  return {
    menuId,
    depth: menuDepth(all, menuId),
    layout: layoutOf(all, menuId),
    settings: menuSettings(all, menuId),
    childCount: all.filter((button) => button.parentId === menuId).length,
  };
}

/** Callback'ni ekranga bog'lash uchun qisqa tavsif — jurnalda ko'rinadi. */
export function describeCallback(parsed: ParsedCallback): string {
  switch (parsed.kind) {
    case "button":
      return `button:${parsed.id}`;
    case "back":
      return parsed.menu === undefined ? "back:stack" : `back:${parsed.menu ?? "root"}`;
    case "cart_add":
      return `cart_add:${parsed.then}`;
    case "cart_qty":
      return `cart_${parsed.op}`;
    case "order":
      return "order:detail";
    default:
      return parsed.kind;
  }
}

/** Menyu tuguni sifatida ishlatiladigan tugmaning sarlavhasi. */
export function nodeTitle(button: ButtonRecord): string {
  return menuConfig(button).title?.trim() || buttonLabel(button);
}
