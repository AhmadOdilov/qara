/**
 * ButtonActionExecutor — har bir amal alohida handler.
 *
 * Handler tarmoqqa o'zi chiqmaydi va bazaga yozmaydi: u faqat «nima
 * ko'rsatilsin» degan natijani qaytaradi, yuborish va saqlashni router
 * bajaradi. Savatga tegadigan amallar ham shu qoidada — handler `cart`
 * direktivasini qaytaradi, o'zgarishni router yozadi. Shu sababli aynan bir
 * handler jonli botda ham, sinovda ham o'zgarishsiz ishlaydi.
 *
 * Yangi amal qo'shish = shu fayldagi registrga bitta yozuv.
 */

import { backTo } from "@/lib/bots/buttons/callback";
import { resolveCart, cartCurrency, cartTotal, type Cart } from "@/lib/bots/buttons/cart";
import { backLabel } from "@/lib/bots/buttons/compiler";
import type { Favorites } from "@/lib/bots/buttons/favorites";
import { menuOwner } from "@/lib/bots/buttons/menu";
import {
  backTargetFor,
  cartView,
  languageRow,
  favoritesView,
  helpView,
  menuView,
  openMenuView,
  ordersView,
  productView,
  profileView,
  rootView,
  stackFor,
  sanitizeStack,
  type View,
  type ViewRequest,
} from "@/lib/bots/buttons/navigation";
import type { OrderRecord } from "@/lib/bots/buttons/orders";
import { botText } from "@/lib/bots/buttons/strings";
import {
  isPendingAction,
  menuConfig,
  type ActionType,
  type ButtonRecord,
  type ReplyKeyboardOptions,
  type ReplyMarkup,
} from "@/lib/bots/buttons/types";
import type { ViewerContext } from "@/lib/bots/buttons/visibility";

export type ActionContext = {
  button: ButtonRecord;
  /// Botning barcha nashr etilgan tugmalari — submenu yig'ish uchun
  allButtons: ButtonRecord[];
  viewer: ViewerContext;
  /// Foydalanuvchi qaysi menyular ichida turibdi (submenu tarixi)
  menuStack: string[];
  replyOptions: ReplyKeyboardOptions;
  lang: string | null;
  /// Foydalanuvchining hozirgi savatchasi — handler uni o'zgartirmaydi
  cart: Cart;
  /// Sevimlilar ro'yxati (mahsulot tugma id'lari)
  favorites: Favorites;
  /// Buyurtmalar — faqat `my_orders` uchun yuklanadi
  orders?: OrderRecord[];
  /// Foydalanuvchining ismi — profil ekranida ko'rsatiladi
  viewerName?: string | null;
  /// Ildiz menyusi sarlavhasi (`/start` javobi)
  rootText?: string;
};

/** Savatga kiritilishi kerak bo'lgan o'zgarish — yozishni router bajaradi. */
export type CartDirective =
  | { op: "add"; productId: string; then: "stay" | "cart" }
  | { op: "clear" }
  | {
      op: "checkout";
      total: number;
      currency: string;
      items: { productId: string; title: string; qty: number; amount: number }[];
    };

export type ActionResult = {
  ok: boolean;
  text: string;
  markup?: ReplyMarkup;
  /// Yangilangan menyu tarixi (submenu / back o'zgartiradi)
  menuStack?: string[];
  /// Hozir ko'rinayotgan menyu — keyingi «orqaga» shu yerdan hisoblanadi
  menuId?: string | null;
  /// Keyingi xabarni kutish holati (collect_* amallari)
  pendingState?: { collect: "name" | "email"; buttonId: string } | null;
  /// Javobdan oldin «yozmoqda…» ko'rsatilsinmi
  typing?: boolean;
  silent?: boolean;
  /// Callback oynasidagi qisqa bildirishnoma
  toast?: string;
  /**
   * Mavjud xabarni joyida tahrirlash mumkinmi (§1).
   *
   * Inline klaviatura uchun `true`: router yangi xabar yubormay,
   * `editMessageText` bilan o'sha xabarni yangilaydi.
   */
  editable?: boolean;
  cart?: CartDirective;
};

type Handler = (ctx: ActionContext) => Promise<ActionResult>;

/* ── Yordamchilar ────────────────────────────────────────────────────────── */

function config(ctx: ActionContext): Record<string, unknown> {
  return (ctx.button.actionConfig ?? {}) as Record<string, unknown>;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function request(ctx: ActionContext): ViewRequest {
  return {
    viewer: ctx.viewer,
    replyOptions: ctx.replyOptions,
    cart: ctx.cart,
    favorites: ctx.favorites,
    ...(ctx.rootText ? { rootText: ctx.rootText } : {}),
  };
}

/** Ko'rinishni natijaga o'giradi — matn almashtirilishi mumkin. */
function fromView(view: View, overrides: Partial<ActionResult> = {}): ActionResult {
  return {
    ok: true,
    text: view.text,
    markup: view.markup,
    menuId: view.menuId,
    editable: view.editable,
    ...overrides,
  };
}

/**
 * Tugma turgan menyu — javobdan keyin foydalanuvchi shu yerda qoladi.
 *
 * Ilgari har bir amal ildiz menyusiga qaytarardi: ichma-ich menyuda bu
 * foydalanuvchini har bosishda boshiga otib tashlardi.
 */
function currentMenu(ctx: ActionContext): View {
  const menuId = ctx.button.parentId;
  return menuView(ctx.allButtons, menuId, backTargetFor(ctx.allButtons, menuId), request(ctx));
}

/** Menyu tarixiga yangi menyuni qo'shadi (takrorlamasdan). */
function pushStack(ctx: ActionContext, menuId: string): string[] {
  const stack = sanitizeStack(ctx.allButtons, ctx.menuStack);
  if (stack[stack.length - 1] === menuId) return stack;
  // Ulangan menyularda daraxt yo'li navigatsiya yo'liga teng bo'lmaydi,
  // shuning uchun tarix bosilgan ketma-ketlikdan yig'iladi.
  return [...stack, menuId];
}

/* ── Handlerlar ──────────────────────────────────────────────────────────── */

const sendMessage: Handler = async (ctx) => {
  const cfg = config(ctx);
  const view = currentMenu(ctx);
  return fromView(view, {
    text: str(cfg.text, "…"),
    typing: cfg.typing === true,
    silent: cfg.silent === true,
  });
};

/**
 * Ichki menyuni ochish.
 *
 * «Orqaga» tugmaning o'zi turgan menyuga qaytaradi — ulangan menyu
 * (`targetId`) bo'lsa ham to'g'ri joyga, chunki manzil daraxtdan emas,
 * kelgan joydan olinadi.
 */
const submenu: Handler = async (ctx) => {
  const view = openMenuView(ctx.allButtons, ctx.button, ctx.button.parentId, request(ctx));
  const cfg = menuConfig(ctx.button);

  if (view.visible.length === 0) {
    // Bo'sh menyuga kirib qolmaymiz: javob beriladi, joy o'zgarmaydi.
    const stay = currentMenu(ctx);
    return fromView(stay, {
      text: cfg.emptyText?.trim() || botText(ctx.lang, "emptyMenu"),
    });
  }

  return fromView(view, {
    menuStack: pushStack(ctx, view.menuId!),
  });
};

/** Konstruktorda qo'yilgan «orqaga» tugmasi — turgan menyudan bir pog'ona yuqoriga. */
const back: Handler = async (ctx) => {
  const owner = menuOwner(ctx.allButtons, ctx.button.parentId);
  const target = owner?.parentId ?? null;
  const view = menuView(
    ctx.allButtons,
    target,
    backTargetFor(ctx.allButtons, target),
    request(ctx),
  );
  return fromView(view, { menuStack: stackFor(ctx.allButtons, target) });
};

/** «🏠 Bosh menyu» — har qanday chuqurlikdan ildizga (§8). */
const home: Handler = async (ctx) =>
  fromView(rootView(ctx.allButtons, request(ctx)), { menuStack: [] });

const closeMenu: Handler = async (ctx) => ({
  ok: true,
  text: str(config(ctx).text, botText(ctx.lang, "menuClosed")),
  markup: { remove_keyboard: true },
  menuStack: [],
  menuId: null,
  // Klaviaturani olib tashlash — bu yangi xabar, tahrirlash emas.
  editable: false,
});

const openUrl: Handler = async (ctx) => {
  const url = str(config(ctx).url);
  // Inline `url` tugmasini Telegram o'zi ochadi va bu yergacha yetib kelmaydi.
  // Bu yo'l reply klaviaturasi uchun: havolani matn sifatida yuboramiz.
  return fromView(currentMenu(ctx), {
    ok: Boolean(url),
    text: url || "Havola ko'rsatilmagan.",
  });
};

const openMiniApp: Handler = async (ctx) => {
  const cfg = config(ctx);
  const url = str(cfg.url);
  if (!url) {
    return fromView(currentMenu(ctx), {
      ok: false,
      text: "Mini App manzili ko'rsatilmagan.",
    });
  }
  return {
    ok: true,
    text: str(cfg.text, "Ilovani ochish uchun quyidagi tugmani bosing:"),
    markup: {
      inline_keyboard: [[{ text: str(cfg.buttonText, "🚀 Ochish"), web_app: { url } }]],
    },
    menuId: ctx.button.parentId,
    editable: true,
  };
};

/**
 * Telegram telefon/joylashuv so'rovini faqat reply klaviaturasi orqali
 * ko'rsata oladi — shuning uchun bu amal doim reply tugmasini chiqaradi.
 */
const collectPhone: Handler = async (ctx) => ({
  ok: true,
  text: str(config(ctx).text, botText(ctx.lang, "askPhone")),
  markup: {
    keyboard: [
      [
        {
          text: str(config(ctx).buttonText, botText(ctx.lang, "sharePhone")),
          request_contact: true,
        },
      ],
      [{ text: backLabel(ctx.lang) }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
  editable: false,
});

const collectLocation: Handler = async (ctx) => ({
  ok: true,
  text: str(config(ctx).text, botText(ctx.lang, "askLocation")),
  markup: {
    keyboard: [
      [
        {
          text: str(config(ctx).buttonText, botText(ctx.lang, "shareLocation")),
          request_location: true,
        },
      ],
      [{ text: backLabel(ctx.lang) }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
  editable: false,
});

const collectName: Handler = async (ctx) => ({
  ok: true,
  text: str(config(ctx).text, botText(ctx.lang, "askName")),
  markup: { remove_keyboard: true },
  pendingState: { collect: "name", buttonId: ctx.button.id },
  editable: false,
});

const collectEmail: Handler = async (ctx) => ({
  ok: true,
  text: str(config(ctx).text, botText(ctx.lang, "askEmail")),
  markup: { remove_keyboard: true },
  pendingState: { collect: "email", buttonId: ctx.button.id },
  editable: false,
});

/** Til tanlash. Tanlanmasa ham chiqish yo'li bor — bu boshi berk ko'cha emas. */
const changeLanguage: Handler = async (ctx) => ({
  ok: true,
  text: str(config(ctx).text, botText(ctx.lang, "changeLanguage")),
  markup: {
    inline_keyboard: [
      languageRow(),
      [{ text: backLabel(ctx.lang), callback_data: backTo(ctx.button.parentId) }],
    ],
  },
  menuId: ctx.button.parentId,
  editable: true,
});

const contactAdmin: Handler = async (ctx) =>
  fromView(currentMenu(ctx), {
    text: str(config(ctx).text, "Adminga murojaat qilish uchun: @admin"),
  });

/* ── Do'kon amallari (§9) ────────────────────────────────────────────────── */

const product: Handler = async (ctx) =>
  fromView(productView(ctx.allButtons, ctx.button, request(ctx)));

/**
 * Konstruktorda qo'yilgan «savatga qo'shish» tugmasi.
 *
 * Mahsulot kartasidagi tugma bundan farq qiladi: u tizim callback'i bilan
 * ketadi va routerda qayta ishlanadi. Bu yerda esa egasi tanlagan mahsulot
 * qaysi tugma ekani `actionConfig.productId` da turadi.
 */
const addToCart: Handler = async (ctx) => {
  const productId = str(config(ctx).productId);
  const target = ctx.allButtons.find(
    (button) => button.id === productId && button.actionType === "product",
  );

  if (!target) {
    return fromView(currentMenu(ctx), {
      ok: false,
      text: botText(ctx.lang, "staleButton"),
    });
  }

  return fromView(productView(ctx.allButtons, target, request(ctx)), {
    cart: { op: "add", productId: target.id, then: "stay" },
    toast: botText(ctx.lang, "addedToCart"),
  });
};

const viewCart: Handler = async (ctx) =>
  fromView(cartView(ctx.allButtons, ctx.cart, ctx.button.parentId, request(ctx)));

/* ── Foydalanuvchi ekranlari (§7, §8) ────────────────────────────────────── */

/**
 * «📦 Buyurtmalarim».
 *
 * Buyurtmalarni router yuklaydi (`needsOrders`) — handler bazaga chiqmaydi.
 * Ro'yxat kelmagan bo'lsa bo'sh holat ko'rsatiladi, jim yiqilish yo'q.
 */
const myOrders: Handler = async (ctx) =>
  fromView(
    ordersView(ctx.allButtons, ctx.orders ?? [], ctx.button.parentId, request(ctx)),
  );

const favorites: Handler = async (ctx) =>
  fromView(
    favoritesView(ctx.allButtons, ctx.favorites, ctx.button.parentId, request(ctx)),
  );

const profile: Handler = async (ctx) =>
  fromView(profileView(ctx.viewerName ?? null, ctx.button.parentId, request(ctx)));

/** «ℹ️ Yordam» — egasi matn yozgan bo'lsa u, aks holda tizim ko'rsatmasi. */
const help: Handler = async (ctx) =>
  fromView(helpView(str(config(ctx).text) || null, ctx.button.parentId, request(ctx)));

/**
 * Buyurtmani tasdiqlash.
 *
 * Summa shu yerda — sof hisobda — yig'iladi, buyurtma yozuvini esa router
 * yaratadi. Narx hech qachon callback yoki klientdan olinmaydi (§17).
 */
const checkout: Handler = async (ctx) => {
  const lines = resolveCart(ctx.allButtons, ctx.cart);

  if (lines.length === 0) {
    return fromView(cartView(ctx.allButtons, ctx.cart, ctx.button.parentId, request(ctx)), {
      ok: false,
      text: botText(ctx.lang, "orderEmpty"),
    });
  }

  return fromView(rootView(ctx.allButtons, request(ctx)), {
    menuStack: [],
    cart: {
      op: "checkout",
      total: cartTotal(lines),
      currency: cartCurrency(lines),
      items: lines.map((line) => ({
        productId: line.button.id,
        title: line.config.title?.trim() || line.button.text,
        qty: line.qty,
        amount: line.amount,
      })),
    },
  });
};

/**
 * Ixtiyoriy amal (§3, 12-band).
 *
 * Kod bajarmaydi — egasi yozgan javobni qaytaradi va `payload` ni hodisa
 * jurnaliga yozib qo'yadi. Shu sababli tashqi integratsiya qo'shilganda
 * interfeys o'zgarmaydi.
 */
const custom: Handler = async (ctx) => {
  const cfg = config(ctx);
  return fromView(currentMenu(ctx), {
    text: str(cfg.text, "Qabul qilindi."),
    typing: cfg.typing === true,
  });
};

/**
 * Hali qurilmagan qatlamlar (AI, qidiruv, integratsiya, workflow).
 * Jim yiqilmaydi — foydalanuvchiga ham, egasiga ham holat aniq aytiladi.
 */
const NOT_CONFIGURED: Record<string, string> = {
  ai_chat: "AI javoblari hali sozlanmagan. Bot egasi AI bo'limini yoqishi kerak.",
  web_search:
    "Veb-qidiruv hali sozlanmagan. Bot egasi qidiruv provayderini ulashi kerak.",
  call_api: "Bu tugma tashqi xizmatga ulanadi, lekin integratsiya hali sozlanmagan.",
  start_workflow: "Bu ssenariy hali sozlanmagan.",
  admin_action: "Admin amallari hali sozlanmagan.",
};

const notConfigured: Handler = async (ctx) =>
  fromView(currentMenu(ctx), {
    ok: false,
    text:
      str(config(ctx).fallbackText) ||
      NOT_CONFIGURED[ctx.button.actionType] ||
      "Bu amal hali sozlanmagan.",
    toast: "Hali sozlanmagan",
  });

/* ── Registr ─────────────────────────────────────────────────────────────── */

export const actionHandlers: Record<ActionType, Handler> = {
  send_message: sendMessage,
  submenu,
  // `category` — do'kon uchun nomlangan `submenu`: navigatsiya bir xil.
  category: submenu,
  product,
  add_to_cart: addToCart,
  view_cart: viewCart,
  checkout,
  my_orders: myOrders,
  favorites,
  profile,
  help,
  back,
  home,
  close_menu: closeMenu,
  open_url: openUrl,
  open_mini_app: openMiniApp,
  collect_phone: collectPhone,
  collect_location: collectLocation,
  collect_name: collectName,
  collect_email: collectEmail,
  change_language: changeLanguage,
  contact_admin: contactAdmin,
  custom,

  // Ortidagi qatlam yozilgach shu yozuvlar haqiqiy handlerga almashadi.
  ai_chat: notConfigured,
  web_search: notConfigured,
  call_api: notConfigured,
  start_workflow: notConfigured,
  admin_action: notConfigured,
};

export async function executeAction(ctx: ActionContext): Promise<ActionResult> {
  const handler = actionHandlers[ctx.button.actionType] ?? notConfigured;
  try {
    return await handler(ctx);
  } catch (error) {
    // Handler qulasa foydalanuvchi tushunarli javob oladi, sabab esa yo'qolmasin:
    // router bu natijani `action_error` hodisasi sifatida ham yozib qo'yadi.
    console.error(
      `[button-action] ${ctx.button.actionType} (${ctx.button.id}) qulaydi:`,
      error,
    );
    const cfg = config(ctx);
    // Foydalanuvchi texnik xatoni ko'rmaydi (§15) — sabab va chiqish yo'li.
    return {
      ok: false,
      text: str(cfg.errorText, botText(ctx.lang, "somethingWrong")),
      markup: rootView(ctx.allButtons, request(ctx)).markup,
      editable: true,
      toast: "❌",
    };
  }
}

export { isPendingAction };
