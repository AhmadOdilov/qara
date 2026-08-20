/**
 * ButtonCompiler — Qara'dagi tugma konfiguratsiyasini Telegram'ning
 * `reply_markup` shakliga o'giradi.
 *
 * Yagona manba shu yerda: klient hech qachon Telegram payload'ini o'zi
 * yasamaydi, faqat shu funksiya natijasi yuboriladi. Shu sababli preview,
 * sinov simulyatori va jonli bot bir xil natija beradi.
 *
 * Bu fayl ataylab `server-only` EMAS: ichida sir ham, tarmoq ham, baza ham
 * yo'q — faqat sof o'girish. Konstruktordagi jonli preview aynan shu
 * funksiyani chaqiradi, shuning uchun preview jonli bot bilan bitta koddan
 * chiqadi (§10).
 */

import { backTo, NAV } from "@/lib/bots/buttons/callback";
import { layoutOf, menuOwner } from "@/lib/bots/buttons/menu";
import { botText, botTextVariants } from "@/lib/bots/buttons/strings";
import {
  buttonLabel,
  TELEGRAM_LIMITS,
  type ButtonRecord,
  type InlineKeyboardButton,
  type ReplyKeyboardButton,
  type ReplyKeyboardOptions,
  type ReplyMarkup,
} from "@/lib/bots/buttons/types";
import { isVisibleTo, type ViewerContext } from "@/lib/bots/buttons/visibility";

/**
 * «Orqaga» tugmasining eski callback'i.
 *
 * Yangi xabarlar `nav:back[:menu]` ishlatadi, ammo foydalanuvchi chatida
 * turgan eski xabarlarda bu qiymat qolgan — router uni hamon tushunadi.
 */
export const BACK_CALLBACK = "btn_back";

/**
 * Navigatsiya yorliqlari dizayn tizimidan olinadi (`strings.ts`): `⬅️` va
 * `🏠` butun bot bo'ylab bir xil ma'noni tashiydi.
 */
export function backLabel(lang: string | null | undefined): string {
  return botText(lang, "back");
}

export function homeLabel(lang: string | null | undefined): string {
  return botText(lang, "home");
}

/** Yorliq o'zgarishidan oldingi «orqaga» matnlari. */
const LEGACY_BACK_LABELS = ["🔙 Orqaga", "🔙 Назад", "🔙 Back"];

/**
 * Reply klaviaturasidagi tugmani yorlig'i bo'yicha tanish.
 *
 * Uchta til ham, eski yorliqlar ham qabul qilinadi: foydalanuvchi chatida
 * turgan klaviatura til almashtirilgandan yoki yangilanishdan keyin ham
 * ishlashi kerak — aks holda «Ortga» bosilganda bot jim qolardi.
 */
export function isBackLabel(text: string): boolean {
  return botTextVariants("back").includes(text) || LEGACY_BACK_LABELS.includes(text);
}

export function isHomeLabel(text: string): boolean {
  return botTextVariants("home").includes(text);
}

export type CompileOptions = {
  /// Qaysi menyu: ildiz uchun `null`, submenu uchun ota tugma id'si
  parentId: string | null;
  viewer: ViewerContext;
  /// Submenu bo'lsa «Orqaga» tugmasi qo'shiladi
  withBack: boolean;
  /**
   * Inline «Orqaga» qaysi menyuga qaytaradi: `null` — ildizga, id — o'sha
   * menyuga. Berilmasa — menyu tarixidan bitta orqaga (reply klaviatura va
   * eski xabarlar uchun yo'l).
   */
  backTo?: string | null;
  /// «🏠 Bosh menyu» tugmasi ham qo'shilsinmi
  withHome?: boolean;
  replyOptions?: ReplyKeyboardOptions;
};

export type CompiledMenu = {
  markup: ReplyMarkup;
  /// Ko'rinishga tushgan tugmalar — analitika va sinov uchun
  visible: ButtonRecord[];
  kind: "reply" | "inline" | "empty";
};

/**
 * Bitta menyuni yig'adi.
 *
 * Klaviatura turini menyuning birinchi ko'rinadigan tugmasi belgilaydi —
 * Telegram bitta xabarga reply va inline klaviaturani aralashtirib bera
 * olmaydi, shuning uchun menyu ichida bitta tur ishlatiladi.
 */
export function compileMenu(all: ButtonRecord[], opts: CompileOptions): CompiledMenu {
  const visible = all
    .filter((button) => button.parentId === opts.parentId)
    .filter((button) => isVisibleTo(button, opts.viewer))
    .sort((a, b) => a.rowIndex - b.rowIndex || a.sortOrder - b.sortOrder)
    // Telegram bitta klaviaturada 100 tugmadan ko'pini qabul qilmaydi;
    // «orqaga»/«bosh menyu» qatoriga ham joy qoldiramiz.
    .slice(0, TELEGRAM_LIMITS.buttonsPerMenu - 2);

  // Bo'sh menyu ham navigatsiyani yo'qotmasligi kerak: aks holda foydalanuvchi
  // chiqib keta olmaydigan ekranda qolib qolardi.
  const kind = visible[0]?.keyboardKind ?? menuOwner(all, opts.parentId)?.keyboardKind;

  if (visible.length === 0 && !opts.withBack && !opts.withHome) {
    return { markup: { remove_keyboard: true }, visible: [], kind: "empty" };
  }

  const rows = groupIntoRows(visible, layoutOf(all, opts.parentId));

  if (kind === "inline") {
    const inline: InlineKeyboardButton[][] = rows.map((row) =>
      row.map(toInlineButton).filter((b): b is InlineKeyboardButton => b !== null),
    );
    const navigation = inlineNavigationRow(opts);
    if (navigation.length > 0) inline.push(navigation);
    return {
      markup: { inline_keyboard: inline.filter((row) => row.length > 0) },
      visible,
      kind: "inline",
    };
  }

  const keyboard: ReplyKeyboardButton[][] = rows.map((row) => row.map(toReplyButton));
  const navigation = replyNavigationRow(opts);
  if (navigation.length > 0) keyboard.push(navigation);

  const options = opts.replyOptions ?? {};
  return {
    markup: {
      keyboard,
      resize_keyboard: options.resize ?? true,
      one_time_keyboard: options.oneTime ?? false,
      is_persistent: options.persistent ?? true,
      selective: options.selective ?? false,
      ...(options.placeholder ? { input_field_placeholder: options.placeholder } : {}),
    },
    visible,
    kind: "reply",
  };
}

/* ── Navigatsiya qatori ──────────────────────────────────────────────────── */

function inlineNavigationRow(opts: CompileOptions): InlineKeyboardButton[] {
  const row: InlineKeyboardButton[] = [];
  if (opts.withBack) {
    row.push({
      text: backLabel(opts.viewer.languageCode),
      // `backTo` berilmasa tarixdan pop qilinadi; berilsa manzil callback
      // ichida turadi va tugma xabar eskirganda ham to'g'ri ishlaydi.
      callback_data: backTo(opts.backTo),
    });
  }
  if (opts.withHome) {
    row.push({ text: homeLabel(opts.viewer.languageCode), callback_data: NAV.home });
  }
  return row;
}

function replyNavigationRow(opts: CompileOptions): ReplyKeyboardButton[] {
  const row: ReplyKeyboardButton[] = [];
  if (opts.withBack) row.push({ text: backLabel(opts.viewer.languageCode) });
  if (opts.withHome) row.push({ text: homeLabel(opts.viewer.languageCode) });
  return row;
}

/**
 * Tugmalarni qatorlarga bo'ladi.
 *
 * Ikki rejim bor:
 *   • `layout` berilgan bo'lsa — tugmalar tartib bo'yicha N talik qatorlarga
 *     bo'linadi («1 ta qatorda», «2 ta qatorda», panjara — §4);
 *   • aks holda `rowIndex` bir xil bo'lganlar bitta qatorga tushadi (eski
 *     xatti-harakat: foydalanuvchi qatorni o'zi belgilaydi).
 *
 * Telegram bitta qatorda 8 tagacha tugmani qabul qiladi.
 */
function groupIntoRows(
  buttons: ButtonRecord[],
  layout: number | null,
): ButtonRecord[][] {
  const perRow = TELEGRAM_LIMITS.buttonsPerRow;

  if (layout) {
    const rows: ButtonRecord[][] = [];
    for (let index = 0; index < buttons.length; index += layout) {
      rows.push(buttons.slice(index, index + layout));
    }
    return rows;
  }

  const rows = new Map<number, ButtonRecord[]>();
  for (const button of buttons) {
    const row = rows.get(button.rowIndex) ?? [];
    row.push(button);
    rows.set(button.rowIndex, row);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row.slice(0, perRow));
}

/* ── Bitta tugma ─────────────────────────────────────────────────────────── */

function toInlineButton(button: ButtonRecord): InlineKeyboardButton | null {
  const text = buttonLabel(button);
  const config = button.actionConfig as { url?: string; query?: string };

  switch (button.buttonType) {
    case "url": {
      // Telegram noto'g'ri URL bilan butun xabarni rad etadi — tashlab ketamiz.
      return isHttps(config.url) ? { text, url: config.url! } : null;
    }
    case "mini_app":
      return isHttps(config.url) ? { text, web_app: { url: config.url! } } : null;
    case "inline_mode":
      return { text, switch_inline_query_current_chat: config.query ?? "" };
    default:
      // callback, submenu, dynamic va boshqalar — hammasi callback orqali.
      return button.callbackId ? { text, callback_data: button.callbackId } : null;
  }
}

function toReplyButton(button: ButtonRecord): ReplyKeyboardButton {
  const text = buttonLabel(button);
  switch (button.buttonType) {
    case "contact":
      return { text, request_contact: true };
    case "location":
      return { text, request_location: true };
    default:
      return { text };
  }
}

export function isHttps(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
