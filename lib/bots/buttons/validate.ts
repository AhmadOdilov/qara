/**
 * Menyu daraxtining tekshiruvi (§12).
 *
 * Nashrdan OLDIN ishlaydi: jonli botga faqat Telegram qabul qiladigan va
 * o'zini o'ziga bog'lab qo'ymagan daraxt chiqadi. Konstruktor ham shu
 * funksiyani chaqiradi — foydalanuvchi xatoni «Nashr etish» tugmasini
 * bosmasdan ko'radi.
 *
 * Qattiqlik darajasi ataylab tor:
 *
 *   • `errors` — nashrni TO'XTATADI. Faqat tuzatilmasa ishlamaydigan holatlar:
 *     menyu halqasi, o'ziga ulangan menyu, takrorlangan callback, Telegram
 *     rad etadigan callback uzunligi, otasi yo'q tugma.
 *
 *   • `warnings` — nashrga xalal bermaydi. Kompilyator bunday tugmalarni
 *     xavfsiz chetlab o'tadi (masalan yaroqsiz URL'li tugma klaviaturaga
 *     qo'shilmaydi, chegaradan oshgan tugmalar kesiladi), lekin egasi buni
 *     bilishi kerak. Nashrni bunday holatlarda to'xtatish mavjud botlarni
 *     qulflab qo'yardi — shuning uchun ogohlantirish bilan cheklanamiz.
 *
 * Sof funksiya — klientda ham ishlatiladi.
 */

import { callbackFits, longestCallbackFor } from "@/lib/bots/buttons/callback";
import { isHttps } from "@/lib/bots/buttons/compiler";
import { childrenOf, isDescendant, layoutOf } from "@/lib/bots/buttons/menu";
import {
  buttonLabel,
  menuConfig,
  opensMenu,
  productConfig,
  TELEGRAM_LIMITS,
  type ButtonRecord,
} from "@/lib/bots/buttons/types";

export type IssueCode =
  | "cycle"
  | "orphan"
  | "self_target"
  | "missing_target"
  | "descendant_target"
  | "callback_too_long"
  | "duplicate_callback"
  | "invalid_url"
  | "empty_message"
  | "label_too_long"
  | "too_many_buttons"
  | "row_too_wide"
  | "mixed_keyboard"
  | "missing_product"
  | "no_price"
  | "invalid_photo"
  | "no_cart"
  | "empty_menu";

export type Issue = {
  code: IssueCode;
  message: string;
  /// Muammoli tugma (bo'lsa)
  buttonId?: string;
  /// Muammoli menyu: `null` — ildiz
  menuId?: string | null;
};

export type ValidationResult = {
  errors: Issue[];
  warnings: Issue[];
  ok: boolean;
};

export function validateTree(all: ButtonRecord[]): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  checkTree(all, errors);
  checkButtons(all, errors, warnings);
  checkMenus(all, warnings);
  checkShopFlow(all, warnings);

  return { errors, warnings, ok: errors.length === 0 };
}

/* ── Daraxt ──────────────────────────────────────────────────────────────── */

function checkTree(all: ButtonRecord[], errors: Issue[]): void {
  const parentOf = new Map(all.map((button) => [button.id, button.parentId]));

  for (const button of all) {
    if (button.parentId && !parentOf.has(button.parentId)) {
      errors.push({
        code: "orphan",
        buttonId: button.id,
        message: `«${buttonLabel(button)}» mavjud bo'lmagan menyu ichida turibdi`,
      });
      continue;
    }

    const seen = new Set<string>([button.id]);
    let current = button.parentId;
    while (current) {
      if (seen.has(current)) {
        errors.push({
          code: "cycle",
          buttonId: button.id,
          message: `«${buttonLabel(button)}» menyu halqasida — ota-bola bog'lanishi o'ziga qaytadi`,
        });
        break;
      }
      seen.add(current);
      current = parentOf.get(current) ?? null;
    }
  }
}

/* ── Tugmalar ────────────────────────────────────────────────────────────── */

function checkButtons(all: ButtonRecord[], errors: Issue[], warnings: Issue[]): void {
  const byId = new Map(all.map((button) => [button.id, button]));
  const callbacks = new Map<string, string>();

  for (const button of all) {
    const label = buttonLabel(button);

    if (label.length > TELEGRAM_LIMITS.labelChars) {
      warnings.push({
        code: "label_too_long",
        buttonId: button.id,
        message: `«${label.slice(0, 24)}…» yorlig'i ${TELEGRAM_LIMITS.labelChars} belgidan uzun — Telegram uni qisqartirib ko'rsatadi`,
      });
    }

    if (button.callbackId) {
      const previous = callbacks.get(button.callbackId);
      if (previous && previous !== button.id) {
        errors.push({
          code: "duplicate_callback",
          buttonId: button.id,
          message: `«${label}» callback identifikatori boshqa tugma bilan bir xil`,
        });
      }
      callbacks.set(button.callbackId, button.id);

      // Eng uzun holat — «orqaga» manzili shu tugmaga ko'rsatganda.
      if (!callbackFits(longestCallbackFor(button.callbackId))) {
        errors.push({
          code: "callback_too_long",
          buttonId: button.id,
          message: `«${label}» uchun callback_data ${TELEGRAM_LIMITS.callbackBytes} baytdan oshadi`,
        });
      }
    }

    checkTarget(all, byId, button, errors, warnings);
    checkConfig(all, button, warnings);
  }
}

/** Ulangan menyu (§12: o'ziga target bermasin, mavjud bo'lmaganga bermasin). */
function checkTarget(
  all: ButtonRecord[],
  byId: Map<string, ButtonRecord>,
  button: ButtonRecord,
  errors: Issue[],
  warnings: Issue[],
): void {
  const target = menuConfig(button).targetId;
  if (!target) return;

  const label = buttonLabel(button);

  if (target === button.id) {
    errors.push({
      code: "self_target",
      buttonId: button.id,
      message: `«${label}» o'zini menyu sifatida ochmoqchi`,
    });
    return;
  }
  if (!byId.has(target)) {
    // Halokatli emas: `resolveMenuTarget` tugmaning o'z bolalariga qaytadi.
    warnings.push({
      code: "missing_target",
      buttonId: button.id,
      message: `«${label}» mavjud bo'lmagan menyuga ulangan — o'z ichki menyusi ochiladi`,
    });
    return;
  }
  if (isDescendant(all, target, button.id)) {
    errors.push({
      code: "descendant_target",
      buttonId: button.id,
      message: `«${label}» o'z ichki menyusiga ulangan — navigatsiya halqaga tushadi`,
    });
  }
}

function checkConfig(
  all: ButtonRecord[],
  button: ButtonRecord,
  warnings: Issue[],
): void {
  const label = buttonLabel(button);
  const config = button.actionConfig as { url?: unknown; text?: unknown; productId?: unknown };

  const needsUrl =
    button.buttonType === "url" ||
    button.buttonType === "mini_app" ||
    button.actionType === "open_url" ||
    button.actionType === "open_mini_app";

  if (needsUrl && !isHttps(typeof config.url === "string" ? config.url : null)) {
    // Kompilyator yaroqsiz manzilli tugmani klaviaturaga qo'shmaydi — xabar
    // buzilmaydi, faqat tugma ko'rinmaydi.
    warnings.push({
      code: "invalid_url",
      buttonId: button.id,
      message: `«${label}» uchun HTTPS manzil ko'rsatilmagan — tugma klaviaturada ko'rinmaydi`,
    });
  }

  if (button.actionType === "send_message") {
    const text = typeof config.text === "string" ? config.text.trim() : "";
    if (!text) {
      warnings.push({
        code: "empty_message",
        buttonId: button.id,
        message: `«${label}» javob matni bo'sh`,
      });
    }
  }

  if (button.actionType === "add_to_cart") {
    const productId = typeof config.productId === "string" ? config.productId : "";
    const exists = all.some(
      (candidate) => candidate.id === productId && candidate.actionType === "product",
    );
    if (!exists) {
      warnings.push({
        code: "missing_product",
        buttonId: button.id,
        message: `«${label}» mavjud bo'lmagan mahsulotga ulangan`,
      });
    }
  }

  if (button.actionType === "product") {
    const product = productConfig(button);
    if (typeof product.price !== "number" || !(product.price > 0)) {
      warnings.push({
        code: "no_price",
        buttonId: button.id,
        message: `«${label}» mahsulotining narxi ko'rsatilmagan`,
      });
    }
    // Rasm tugmasi faqat HTTPS bilan chiqadi — aks holda Telegram butun
    // xabarni rad etardi, shuning uchun karta uni jimgina tashlab ketadi.
    if (product.photoUrl !== undefined && !isHttps(product.photoUrl)) {
      warnings.push({
        code: "invalid_photo",
        buttonId: button.id,
        message: `«${label}» rasmi HTTPS emas — kartada rasm tugmasi ko'rinmaydi`,
      });
    }
  }
}

/* ── Do'kon oqimi ────────────────────────────────────────────────────────── */

/**
 * Mahsulot bor, lekin savatchaga yo'l yo'q (§6, §9).
 *
 * Mahsulot kartasidan savatcha ochiladi va `/savat` buyrug'i ham ishlaydi —
 * shuning uchun bu xato emas, ogohlantirish. Ammo asosiy menyuda savatcha
 * tugmasi bo'lmasa foydalanuvchi buyurtmani qanday tasdiqlashini topolmaydi.
 */
function checkShopFlow(all: ButtonRecord[], warnings: Issue[]): void {
  const hasProducts = all.some((button) => button.actionType === "product" && button.enabled);
  if (!hasProducts) return;

  const hasCart = all.some(
    (button) =>
      button.enabled &&
      (button.actionType === "view_cart" || button.actionType === "checkout"),
  );
  if (hasCart) return;

  warnings.push({
    code: "no_cart",
    menuId: null,
    message:
      "Mahsulotlar bor, lekin savatcha tugmasi yo'q — «🛒 Savatcha» tugmasini asosiy menyuga qo'shing",
  });
}

/* ── Menyular ────────────────────────────────────────────────────────────── */

function checkMenus(all: ButtonRecord[], warnings: Issue[]): void {
  const menus: (string | null)[] = [null];
  for (const button of all) {
    if (opensMenu(button.actionType) || all.some((child) => child.parentId === button.id)) {
      menus.push(button.id);
    }
  }

  for (const menuId of menus) {
    const children = childrenOf(all, menuId);
    const name = menuName(all, menuId);

    // Kompilyator chegaradan oshganini kesib tashlaydi — xabar yuboriladi,
    // lekin oxirgi tugmalar ko'rinmaydi.
    if (children.length > TELEGRAM_LIMITS.buttonsPerMenu) {
      warnings.push({
        code: "too_many_buttons",
        menuId,
        message: `«${name}» menyusida ${children.length} tugma — Telegram chegarasi ${TELEGRAM_LIMITS.buttonsPerMenu}, ortiqchasi ko'rinmaydi`,
      });
    }

    const layout = layoutOf(all, menuId);
    if (layout === null) {
      const rows = new Map<number, number>();
      for (const child of children) {
        rows.set(child.rowIndex, (rows.get(child.rowIndex) ?? 0) + 1);
      }
      for (const [rowIndex, count] of rows) {
        if (count > TELEGRAM_LIMITS.buttonsPerRow) {
          warnings.push({
            code: "row_too_wide",
            menuId,
            message: `«${name}» menyusining ${rowIndex + 1}-qatorida ${count} tugma — chegara ${TELEGRAM_LIMITS.buttonsPerRow}`,
          });
        }
      }
    }

    const kinds = new Set(children.map((child) => child.keyboardKind));
    if (kinds.size > 1) {
      warnings.push({
        code: "mixed_keyboard",
        menuId,
        message: `«${name}» menyusida ikki xil klaviatura aralashgan — Telegram bittasini ko'rsatadi`,
      });
    }

    if (menuId !== null && children.length === 0) {
      warnings.push({
        code: "empty_menu",
        menuId,
        message: `«${name}» menyusi bo'sh`,
      });
    }
  }
}

function menuName(all: ButtonRecord[], menuId: string | null): string {
  if (menuId === null) return "Asosiy menyu";
  const owner = all.find((button) => button.id === menuId);
  if (!owner) return menuId;
  return menuConfig(owner).title?.trim() || buttonLabel(owner);
}
