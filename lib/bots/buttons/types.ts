/**
 * Tugma qurilmasining umumiy tiplari.
 *
 * Bu fayl `server-only` emas: ro'yxatlar (tur va amal nomlari) validatsiya
 * uchun serverda ham, forma uchun klientda ham kerak. Sir yoki server mantig'i
 * bu yerda yo'q.
 */

/* ── Tugma turlari ───────────────────────────────────────────────────────── */

/** Klaviatura turi — tugma qayerga tushadi. */
export const KEYBOARD_KINDS = ["reply", "inline"] as const;
export type KeyboardKind = (typeof KEYBOARD_KINDS)[number];

/**
 * Tugmaning Telegram'dagi turi.
 *
 * Reply klaviatura faqat `text`, `contact` va `location` ni qo'llab-quvvatlaydi;
 * qolganlari inline klaviaturaga tegishli. `submenu` ikkalasida ham ishlaydi —
 * u Telegram uchun oddiy tugma, ma'nosi esa bizning tomonda.
 */
export const BUTTON_TYPES = [
  "text",
  "contact",
  "location",
  "callback",
  "url",
  "mini_app",
  "inline_mode",
  "submenu",
  "dynamic",
] as const;
export type ButtonType = (typeof BUTTON_TYPES)[number];

const REPLY_ONLY: ButtonType[] = ["text", "contact", "location"];
const INLINE_ONLY: ButtonType[] = ["callback", "url", "mini_app", "inline_mode"];

/** Tur tanlangan klaviaturaga mos keladimi. */
export function typeFitsKeyboard(type: ButtonType, kind: KeyboardKind): boolean {
  if (type === "submenu" || type === "dynamic") return true;
  return kind === "reply" ? REPLY_ONLY.includes(type) : INLINE_ONLY.includes(type);
}

export function typesForKeyboard(kind: KeyboardKind): ButtonType[] {
  return BUTTON_TYPES.filter((type) => typeFitsKeyboard(type, kind));
}

/* ── Amallar ─────────────────────────────────────────────────────────────── */

/**
 * Bajarilishi mumkin bo'lgan amallar.
 *
 * `PENDING_ACTIONS` — sxemada joyi bor, lekin ortidagi qatlam (AI, veb-qidiruv,
 * integratsiyalar, workflow'lar) hali yozilmagan. Ular tanlanadi va saqlanadi,
 * ammo bajarilganda foydalanuvchiga ochiq «hali sozlanmagan» javobi ketadi —
 * jim yiqilmasin.
 */
export const READY_ACTIONS = [
  "send_message",
  "submenu",
  "category",
  "product",
  "add_to_cart",
  "view_cart",
  "checkout",
  "my_orders",
  "favorites",
  "profile",
  "help",
  "back",
  "home",
  "close_menu",
  "open_url",
  "open_mini_app",
  "collect_phone",
  "collect_location",
  "collect_name",
  "collect_email",
  "change_language",
  "contact_admin",
  "custom",
] as const;

export const PENDING_ACTIONS = [
  "ai_chat",
  "web_search",
  "call_api",
  "start_workflow",
  "admin_action",
] as const;

export const ACTION_TYPES = [...READY_ACTIONS, ...PENDING_ACTIONS] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export function isPendingAction(action: string): boolean {
  return (PENDING_ACTIONS as readonly string[]).includes(action);
}

/**
 * Ichki menyu ochadigan amallar.
 *
 * `category` — `submenu` ning do'kon uchun nomlangan ko'rinishi: bir xil
 * navigatsiya, faqat konstruktorda ma'nosi aniqroq ko'rinadi.
 */
export const MENU_ACTIONS: readonly ActionType[] = ["submenu", "category"];

export function opensMenu(action: string): boolean {
  return (MENU_ACTIONS as readonly string[]).includes(action);
}

/** Savat bilan ishlaydigan amallar — bot foydalanuvchisining savatiga tegadi. */
export const CART_ACTIONS: readonly ActionType[] = [
  "add_to_cart",
  "view_cart",
  "checkout",
];

export function touchesCart(action: string): boolean {
  return (CART_ACTIONS as readonly string[]).includes(action);
}

/**
 * Tizim ekranlari — mazmuni konstruktorda emas, foydalanuvchining o'z
 * ma'lumotidan yig'iladi (savatcha, buyurtmalar, sevimlilar, profil, yordam).
 *
 * Egasi ularni menyuning istalgan joyiga qo'yadi, ichidagi navigatsiyani esa
 * bot o'zi quradi — shu sababli har botda bir xil, tanish ekran chiqadi.
 */
export const SCREEN_ACTIONS: readonly ActionType[] = [
  "view_cart",
  "my_orders",
  "favorites",
  "profile",
  "help",
];

export function opensScreen(action: string): boolean {
  return (SCREEN_ACTIONS as readonly string[]).includes(action);
}

/** Foydalanuvchining buyurtmalari kerak bo'ladigan amallar. */
export function needsOrders(action: string): boolean {
  return action === "my_orders";
}

/* ── Telegram cheklovlari ────────────────────────────────────────────────── */

/**
 * Telegram'ning o'zi qo'ygan chegaralar. Bitta joyda turadi: validatsiya,
 * kompilyator va konstruktor aynan shu qiymatlarga tayanadi.
 */
export const TELEGRAM_LIMITS = {
  /// `callback_data` — 1..64 bayt
  callbackBytes: 64,
  /// Bitta qatorda nechta tugma
  buttonsPerRow: 8,
  /// Bitta klaviaturadagi jami tugma soni
  buttonsPerMenu: 100,
  /// Tugma yorlig'i
  labelChars: 64,
  /// Xabar matni
  textChars: 4096,
} as const;

/* ── Menyu tugunining sozlamasi ─────────────────────────────────────────── */

/**
 * Ichki menyu tugmasining `actionConfig` shakli.
 *
 * Menyu tuguni alohida jadval emas: `submenu`/`category` tugmasining O'ZI
 * tugun bo'lib turadi — `parentId` daraxtni, quyidagi maydonlar esa tugunning
 * sarlavhasi, tavsifi va joylashuvini beradi. Shu sababli nashr surati,
 * versiya tarixi va tiklash mexanizmi o'zgarishsiz ishlaydi.
 */
export type MenuConfig = {
  /// Menyu ochilganda ko'rinadigan sarlavha (bo'sh bo'lsa — tugma matni)
  title?: string;
  /// Sarlavha ostidagi izoh
  description?: string;
  /// Boshqa menyuga ulash: o'z bolalari o'rniga shu tugunning menyusi ochiladi
  targetId?: string | null;
  /// Qatordagi tugma soni (1..8). Bo'sh bo'lsa — `rowIndex` bo'yicha guruhlash
  layout?: number | null;
  /// Bolalari bo'lmagan menyu uchun javob
  emptyText?: string;
  /// «🏠 Bosh menyu» tugmasi ham qo'shilsinmi
  showHome?: boolean;
};

/** Mahsulot kartasi (`product` amali) sozlamasi. */
export type ProductConfig = {
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  /// `null` — ombor hisobi yuritilmaydi
  stock?: number | null;
  sku?: string;
  /// «⚡️ Hozir sotib olish» tugmasi ko'rsatilsinmi
  buyNow?: boolean;
  /**
   * Mahsulot rasmi (HTTPS).
   *
   * Karta matnli xabar bo'lib qolishi kerak — ichma-ich navigatsiya aynan
   * shu xabarni tahrirlash orqali ishlaydi va rasmli xabarni matnga
   * aylantirib bo'lmaydi. Shuning uchun rasm alohida `🖼` tugmasi bilan
   * ochiladi.
   */
  photoUrl?: string;
};

export const DEFAULT_CURRENCY = "UZS";

export function menuConfig(button: Pick<ButtonRecord, "actionConfig">): MenuConfig {
  return (button.actionConfig ?? {}) as MenuConfig;
}

export function productConfig(
  button: Pick<ButtonRecord, "actionConfig">,
): ProductConfig {
  return (button.actionConfig ?? {}) as ProductConfig;
}

/* ── Ko'rinish va shartlar ───────────────────────────────────────────────── */

export const AUDIENCES = ["everyone", "admin", "tagged", "new", "existing"] as const;
export type Audience = (typeof AUDIENCES)[number];

export type Visibility = {
  audience?: Audience;
  /// `audience: "tagged"` uchun — shu teglardan biri bo'lsa ko'rinadi
  tags?: string[];
};

export const CONDITION_FIELDS = [
  "messageCount",
  "phone",
  "email",
  "languageCode",
  "username",
  "tags",
] as const;
export type ConditionField = (typeof CONDITION_FIELDS)[number];

export const CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "greater_than",
  "less_than",
  "exists",
] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export type Condition = {
  field: ConditionField;
  operator: ConditionOperator;
  value?: string;
};

/* ── Tugma yozuvi ────────────────────────────────────────────────────────── */

/**
 * Runtime ishlatadigan tugma shakli.
 *
 * Ataylab Prisma tipidan mustaqil: nashr etilgan surat (JSON) ham, bazadagi
 * jonli qator ham shu shaklga keltiriladi va compiler ikkalasini farq qilmaydi.
 */
export type ButtonRecord = {
  id: string;
  parentId: string | null;
  text: string;
  emoji: string | null;
  buttonType: ButtonType;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
  keyboardKind: KeyboardKind;
  rowIndex: number;
  sortOrder: number;
  callbackId: string | null;
  visibility: Visibility;
  conditions: Condition[];
  enabled: boolean;
  adminOnly: boolean;
};

/** Telegramda ko'rinadigan yorliq. */
export function buttonLabel(button: Pick<ButtonRecord, "text" | "emoji">): string {
  return button.emoji ? `${button.emoji} ${button.text}` : button.text;
}

/**
 * `callback_data` uchun identifikator.
 *
 * Faqat tasodifiy belgi — hech qanday ma'no, sir yoki foydalanuvchi kiritgan
 * qiymat tushmaydi. Telegram `callback_data` ni 64 baytgacha qabul qiladi,
 * bu esa 12 belgi.
 */
export function newCallbackId(): string {
  // Web Crypto — Node'da ham, brauzerda ham bir xil. `node:crypto` ataylab
  // ishlatilmaydi: bu fayl klient formasiga ham import qilinadi.
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `btn_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/* ── Telegram klaviatura shakllari ───────────────────────────────────────── */

export type InlineKeyboardButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; web_app: { url: string } }
  | { text: string; switch_inline_query_current_chat: string };

export type ReplyKeyboardButton = {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
};

export type ReplyMarkup =
  | { inline_keyboard: InlineKeyboardButton[][] }
  | {
      keyboard: ReplyKeyboardButton[][];
      resize_keyboard?: boolean;
      one_time_keyboard?: boolean;
      is_persistent?: boolean;
      selective?: boolean;
      input_field_placeholder?: string;
    }
  | { remove_keyboard: true };

/** Reply klaviaturasining bot bo'yicha sozlamalari (§30). */
export type ReplyKeyboardOptions = {
  resize?: boolean;
  oneTime?: boolean;
  persistent?: boolean;
  selective?: boolean;
  placeholder?: string;
};
