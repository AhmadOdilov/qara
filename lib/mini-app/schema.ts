/**
 * Mini App komponent sxemasi — konstruktor, runtime va server uchun YAGONA manba.
 *
 * Bu fayl ataylab `server-only` EMAS: aynan shu tiplar va zod sxemasi
 * konstruktorda (properties paneli), runtime'da (render) va API'da
 * (validatsiya) ishlatiladi. Uch joyda uchta ta'rif bo'lsa, ular albatta
 * bir-biridan ajralib ketardi — tugmalar tizimida `buttons/types.ts` xuddi
 * shu vazifani bajaradi.
 *
 * Sir ham, tarmoq ham, baza ham bu yerda yo'q — faqat shakl.
 */

import { z } from "zod";

/* ── Amallar ─────────────────────────────────────────────────────────────── */

/**
 * Tugma bosilganda nima bo'ladi.
 *
 * MVP uchun ataylab qisqa ro'yxat: har biri OXIRIGACHA ishlaydi. Yarim
 * ishlaydigan amalni ro'yxatga qo'shgandan ko'ra, kam amal bilan to'liq
 * ishlagani yaxshi.
 */
export const ACTION_KINDS = [
  "none",
  /// Mini App ichida boshqa sahifaga o'tish
  "open_page",
  /// Tashqi havola (Telegram uni brauzerda ochadi)
  "open_url",
  /// Botga chatga xabar yuborish (Mini App ochiq qoladi)
  "send_message",
  /// Sahifadagi input'larni yig'ib botga yuborish va Mini App'ni yopish
  "submit_form",
  /**
   * Sozlangan tashqi API'ga so'rov.
   *
   * Manzil KLIENTDAN kelmaydi — bu yerda faqat `MiniAppEndpoint` id'si
   * turadi, qolganini server o'zi oladi (SSRF himoyasi shunga tayanadi).
   */
  "api_request",
  /// Mini App'ni yopish
  "close_app",
] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];

export const actionSchema = z.object({
  kind: z.enum(ACTION_KINDS).default("none"),
  /// `open_page` uchun sahifa slug'i
  page: z.string().trim().max(64).optional(),
  /// `open_url` uchun HTTPS manzil
  url: z.string().trim().max(2048).optional(),
  /// `send_message` / `submit_form` uchun matn
  text: z.string().trim().max(1000).optional(),
  /// `api_request` uchun sozlangan endpoint id'si
  endpointId: z.string().trim().max(64).optional(),
  /// Muvaffaqiyatdan keyin qaysi sahifaga o'tiladi (ixtiyoriy)
  thenPage: z.string().trim().max(64).optional(),
});

export type ComponentAction = z.infer<typeof actionSchema>;

/* ── Komponentlar ────────────────────────────────────────────────────────── */

/**
 * MVP komponentlari.
 *
 * `container` — yagona ichma-ich element: qolganlari barg. Chuqurlikni
 * cheklab turish konstruktorni ham, runtime'ni ham sodda saqlaydi.
 */
export const COMPONENT_TYPES = [
  "heading",
  "text",
  "image",
  "button",
  "input",
  "product",
  "divider",
  "spacer",
  "container",
] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];

/** Komponent daraxtining maksimal chuqurligi — cheksiz ichma-ichlik bo'lmasin. */
export const MAX_DEPTH = 4;
/** Bitta sahifadagi komponentlar soni. */
export const MAX_COMPONENTS_PER_PAGE = 200;
/** Bitta Mini App'dagi sahifalar soni. */
export const MAX_PAGES = 20;

const align = z.enum(["left", "center", "right"]).default("left");

/**
 * Har bir komponent turining sozlamalari.
 *
 * `catchall` ishlatilmaydi — noma'lum maydon jimgina saqlanib, keyin
 * render'da kutilmagan natija bermasin.
 */
const propsByType = {
  heading: z.object({
    text: z.string().trim().max(200).default("Sarlavha"),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    align,
  }),
  text: z.object({
    text: z.string().trim().max(2000).default(""),
    size: z.enum(["sm", "md", "lg"]).default("md"),
    align,
    muted: z.boolean().default(false),
  }),
  image: z.object({
    url: z.string().trim().max(2048).default(""),
    alt: z.string().trim().max(200).default(""),
    height: z.number().int().min(40).max(600).default(180),
    radius: z.number().int().min(0).max(32).default(12),
  }),
  button: z.object({
    text: z.string().trim().max(64).default("Tugma"),
    variant: z.enum(["primary", "secondary", "ghost"]).default("primary"),
    size: z.enum(["sm", "md", "lg"]).default("md"),
    fullWidth: z.boolean().default(true),
    action: actionSchema.default({ kind: "none" }),
  }),
  input: z.object({
    /// Forma yuborilganda shu nom bilan ketadi
    name: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[a-z][a-z0-9_]*$/i, "Faqat harf, raqam va pastki chiziq")
      .default("field"),
    label: z.string().trim().max(80).default(""),
    placeholder: z.string().trim().max(120).default(""),
    type: z.enum(["text", "number", "tel", "email", "textarea"]).default("text"),
    required: z.boolean().default(false),
    /// Validatsiya — runtime va server bir xil qoidani ishlatadi
    minLength: z.number().int().min(0).max(1000).optional(),
    maxLength: z.number().int().min(1).max(1000).optional(),
    /// Ixtiyoriy naqsh (`^\+998\d{9}$` kabi)
    pattern: z.string().trim().max(200).optional(),
  }),
  product: z.object({
    title: z.string().trim().max(120).default("Mahsulot"),
    description: z.string().trim().max(500).default(""),
    price: z.number().min(0).max(1_000_000_000).default(0),
    currency: z.string().trim().max(8).default("UZS"),
    image: z.string().trim().max(2048).default(""),
    buttonText: z.string().trim().max(48).default("Savatchaga"),
    action: actionSchema.default({ kind: "none" }),
  }),
  divider: z.object({
    spacing: z.number().int().min(0).max(64).default(12),
  }),
  spacer: z.object({
    height: z.number().int().min(4).max(200).default(16),
  }),
  container: z.object({
    direction: z.enum(["column", "row"]).default("column"),
    gap: z.number().int().min(0).max(48).default(12),
    padding: z.number().int().min(0).max(48).default(0),
  }),
} as const satisfies Record<ComponentType, z.ZodTypeAny>;

export type ComponentProps = {
  [K in ComponentType]: z.infer<(typeof propsByType)[K]>;
};

/** Runtime va konstruktor ishlatadigan komponent yozuvi. */
export type MiniAppComponent = {
  [K in ComponentType]: {
    id: string;
    type: K;
    props: ComponentProps[K];
    children?: MiniAppComponent[];
  };
}[ComponentType];

/**
 * Komponent daraxti sxemasi.
 *
 * Zod rekursiv tipni o'zi chiqara olmagani uchun tip qo'lda beriladi
 * (`MiniAppComponent`), tekshiruv esa `z.lazy` bilan ishlaydi.
 */
function variant<K extends ComponentType>(type: K) {
  return z.object({
    id: z.string().trim().min(1).max(64),
    type: z.literal(type),
    props: propsByType[type],
    // Faqat `container` bolalarga ega bo'ladi, lekin maydonni hamma turda
    // qabul qilamiz: eski yozuvda bo'sh massiv qolgan bo'lsa nashr yiqilmasin.
    children: z.array(componentSchema).max(MAX_COMPONENTS_PER_PAGE).optional(),
  });
}

export const componentSchema: z.ZodType<MiniAppComponent> = z.lazy(() =>
  z.union([
    variant("heading"),
    variant("text"),
    variant("image"),
    variant("button"),
    variant("input"),
    variant("product"),
    variant("divider"),
    variant("spacer"),
    variant("container"),
  ]),
) as z.ZodType<MiniAppComponent>;

export const componentTreeSchema = z
  .array(componentSchema)
  .max(MAX_COMPONENTS_PER_PAGE);

/* ── Sahifa va ilova ─────────────────────────────────────────────────────── */

export const PAGE_SLUG = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Faqat kichik harf, raqam va chiziqcha");

export const themeSchema = z.object({
  /// Telegram mavzusidagi tugma rangi ustidan yozadi (bo'sh — Telegram'niki)
  accent: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "HEX rang kutilgan")
    .optional(),
  radius: z.number().int().min(0).max(24).default(12),
});

export const settingsSchema = z.object({
  /// Sahifa tepasidagi sarlavha (bo'sh — ko'rsatilmaydi)
  headerTitle: z.string().trim().max(64).default(""),
  /// Telegram MainButton (pastdagi katta tugma)
  mainButtonText: z.string().trim().max(64).default(""),
  mainButtonAction: actionSchema.default({ kind: "none" }),
});

export type MiniAppTheme = z.infer<typeof themeSchema>;
export type MiniAppSettings = z.infer<typeof settingsSchema>;

/** Runtime o'qiydigan to'liq surat. */
export type MiniAppSchema = {
  id: string;
  name: string;
  theme: MiniAppTheme;
  settings: MiniAppSettings;
  pages: {
    id: string;
    name: string;
    slug: string;
    title: string | null;
    isHome: boolean;
    components: MiniAppComponent[];
  }[];
};

/* ── Yordamchilar ────────────────────────────────────────────────────────── */

/** Daraxtdagi barcha komponentlarni tekis ro'yxatga yig'adi. */
export function flattenComponents(tree: MiniAppComponent[]): MiniAppComponent[] {
  const out: MiniAppComponent[] = [];
  const walk = (nodes: MiniAppComponent[], depth: number) => {
    if (depth > MAX_DEPTH) return;
    for (const node of nodes) {
      out.push(node);
      if (node.children?.length) walk(node.children, depth + 1);
    }
  };
  walk(tree, 0);
  return out;
}

/** Sahifadagi forma maydonlari — `submit_form` shularni yig'adi. */
export function inputsOf(tree: MiniAppComponent[]): ComponentProps["input"][] {
  return flattenComponents(tree)
    .filter((node): node is Extract<MiniAppComponent, { type: "input" }> =>
      node.type === "input",
    )
    .map((node) => node.props);
}

/** Yangi komponent uchun barqaror id. */
export function newComponentId(type: ComponentType): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${type}_${random}`;
}

/** Tur uchun standart sozlamalar — konstruktor yangi element qo'shganda. */
export function defaultProps<K extends ComponentType>(type: K): ComponentProps[K] {
  return propsByType[type].parse({}) as ComponentProps[K];
}

/** Faqat HTTPS manzillar qabul qilinadi (Telegram ham shuni talab qiladi). */
export function isHttpsUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
