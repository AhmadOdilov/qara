/**
 * Sinov yordamchilari: daraxt yasash va klaviaturani o'qish.
 *
 * Sinovlar ataylab bazasiz: butun navigatsiya mantig'i sof modullarda
 * (`navigation`, `compiler`, `menu`, `cart`, `validate`) yotadi, shuning uchun
 * 5 qatlamli ichma-ich menyuni ham hech qanday tashqi xizmatsiz tekshirib
 * bo'ladi.
 */

import type {
  ButtonRecord,
  InlineKeyboardButton,
  ReplyMarkup,
} from "../../lib/bots/buttons/types";
import type { ViewerContext } from "../../lib/bots/buttons/visibility";

export function btn(partial: Partial<ButtonRecord> & { id: string }): ButtonRecord {
  return {
    parentId: null,
    text: partial.id,
    emoji: null,
    buttonType: "callback",
    actionType: "send_message",
    actionConfig: {},
    keyboardKind: "inline",
    rowIndex: 0,
    sortOrder: 0,
    callbackId: `cb_${partial.id}`,
    visibility: {},
    conditions: [],
    enabled: true,
    adminOnly: false,
    ...partial,
  };
}

/** Ichki menyu tuguni. */
export function node(
  id: string,
  parentId: string | null,
  config: Record<string, unknown> = {},
  extra: Partial<ButtonRecord> = {},
): ButtonRecord {
  return btn({
    id,
    parentId,
    text: id,
    actionType: "submenu",
    buttonType: "submenu",
    actionConfig: config,
    ...extra,
  });
}

export function product(
  id: string,
  parentId: string,
  price: number,
  extra: Record<string, unknown> = {},
): ButtonRecord {
  return btn({
    id,
    parentId,
    text: id,
    actionType: "product",
    actionConfig: { price, currency: "UZS", ...extra },
  });
}

export function viewer(overrides: Partial<ViewerContext> = {}): ViewerContext {
  return {
    telegramUserId: "1001",
    username: "tester",
    languageCode: "uz",
    phone: null,
    email: null,
    tags: [],
    messageCount: 10,
    isAdmin: false,
    ...overrides,
  };
}

/* ── Klaviaturani o'qish ─────────────────────────────────────────────────── */

export function isInline(
  markup: ReplyMarkup,
): markup is { inline_keyboard: InlineKeyboardButton[][] } {
  return "inline_keyboard" in markup;
}

/** Klaviatura yorliqlari — qatorlar bo'yicha. */
export function rows(markup: ReplyMarkup): string[][] {
  if (isInline(markup)) {
    return markup.inline_keyboard.map((row) => row.map((button) => button.text));
  }
  if ("keyboard" in markup) {
    return markup.keyboard.map((row) => row.map((button) => button.text));
  }
  return [];
}

export function labels(markup: ReplyMarkup): string[] {
  return rows(markup).flat();
}

/** Inline tugmalarning `callback_data` qiymatlari. */
export function callbacks(markup: ReplyMarkup): string[] {
  if (!isInline(markup)) return [];
  return markup.inline_keyboard
    .flat()
    .map((button) => ("callback_data" in button ? button.callback_data : ""))
    .filter(Boolean);
}

/** Yorlig'i bo'yicha tugmaning callback'ini topadi. */
export function callbackFor(markup: ReplyMarkup, text: string): string {
  if (!isInline(markup)) return "";
  for (const row of markup.inline_keyboard) {
    for (const button of row) {
      if (button.text === text && "callback_data" in button) return button.callback_data;
    }
  }
  return "";
}

/**
 * 5 qatlamli do'kon daraxti (§19: «Kamida 4–5 level nested menu bilan real
 * test qil»).
 *
 *   root
 *   └─ shop            (1)
 *      └─ clothing     (2)
 *         └─ men       (3)
 *            └─ shirts (4)
 *               └─ shirt-classic (mahsulot, 5-ekran)
 */
export function deepShopTree(): ButtonRecord[] {
  return [
    node("shop", null, { title: "🛍 Do'kon", layout: 1 }),
    node("clothing", "shop", { title: "👕 Kiyimlar" }),
    node("men", "clothing", { title: "👕 Erkaklar" }),
    node("shirts", "men", { title: "👔 Ko'ylaklar" }),
    product("shirt-classic", "shirts", 250_000, { title: "Klassik ko'ylak" }),
    product("shirt-slim", "shirts", 310_000, { title: "Slim ko'ylak" }),
    node("women", "clothing", { title: "👗 Ayollar" }),
    product("dress", "women", 420_000, { title: "Ko'ylak" }),
    node("electronics", "shop", { title: "📱 Elektronika", layout: 1, showHome: true }),
    product("iphone", "electronics", 12_500_000, { title: "iPhone 15 Pro" }),
    btn({ id: "cart", text: "Savat", actionType: "view_cart" }),
  ];
}
