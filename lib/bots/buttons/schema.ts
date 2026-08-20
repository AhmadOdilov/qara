import { z } from "zod";
import {
  ACTION_TYPES,
  AUDIENCES,
  BUTTON_TYPES,
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  KEYBOARD_KINDS,
  typeFitsKeyboard,
} from "@/lib/bots/buttons/types";

/**
 * Tugma formasi uchun validatsiya — server va klientda bir xil qoidalar.
 *
 * Telegram cheklovlari shu yerda: matn 1–64 belgi (uzunroq yorliq
 * klaviaturani buzadi), URL faqat HTTPS, callback identifikatori esa
 * foydalanuvchidan umuman qabul qilinmaydi — uni server o'zi beradi.
 */

const httpsUrl = z
  .string()
  .trim()
  .url("Manzil noto'g'ri")
  .refine((value) => value.startsWith("https://"), "Manzil https:// bilan boshlanishi kerak");

export const conditionSchema = z.object({
  field: z.enum(CONDITION_FIELDS),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.string().trim().max(120).optional(),
});

export const visibilitySchema = z.object({
  audience: z.enum(AUDIENCES).default("everyone"),
  tags: z.array(z.string().trim().min(1).max(32)).max(20).default([]),
});

const baseButton = z.object({
  text: z.string().trim().min(1, "Tugma matni kerak").max(64),
  emoji: z.string().trim().max(8).nullable().optional(),
  parentId: z.string().trim().min(1).nullable().optional(),
  keyboardKind: z.enum(KEYBOARD_KINDS).default("reply"),
  buttonType: z.enum(BUTTON_TYPES).default("text"),
  actionType: z.enum(ACTION_TYPES).default("send_message"),
  actionConfig: z.record(z.string(), z.unknown()).default({}),
  // Telegram bitta klaviaturada 100 tugmani qabul qiladi — har biri o'z
  // qatorida bo'lishi mumkin, shuning uchun chegara ham shunga mos.
  rowIndex: z.number().int().min(0).max(99).default(0),
  sortOrder: z.number().int().min(0).max(99).default(0),
  visibility: visibilitySchema.default({ audience: "everyone", tags: [] }),
  conditions: z.array(conditionSchema).max(10).default([]),
  enabled: z.boolean().default(true),
  adminOnly: z.boolean().default(false),
});

/**
 * Turga bog'liq talablar (§32). Bitta joyda tekshiriladi, shuning uchun
 * yaroqsiz tugma bazaga ham, Telegram'ga ham tushmaydi.
 */
function checkRequirements(
  value: z.infer<typeof baseButton>,
  ctx: z.RefinementCtx,
): void {
  if (!typeFitsKeyboard(value.buttonType, value.keyboardKind)) {
    ctx.addIssue({
      code: "custom",
      path: ["buttonType"],
      message:
        value.keyboardKind === "reply"
          ? "Reply klaviaturada faqat matn, kontakt va joylashuv tugmalari bo'ladi"
          : "Inline klaviaturada kontakt va joylashuv tugmalari ishlamaydi",
    });
  }

  const config = value.actionConfig as { url?: unknown; text?: unknown };

  const needsUrl =
    value.buttonType === "url" ||
    value.buttonType === "mini_app" ||
    value.actionType === "open_url" ||
    value.actionType === "open_mini_app";

  if (needsUrl) {
    const parsed = httpsUrl.safeParse(config.url ?? "");
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["actionConfig", "url"],
        message: parsed.error.issues[0]?.message ?? "HTTPS manzil kerak",
      });
    }
  }

  if (value.actionType === "send_message") {
    const text = typeof config.text === "string" ? config.text.trim() : "";
    if (!text) {
      ctx.addIssue({
        code: "custom",
        path: ["actionConfig", "text"],
        message: "Javob matnini kiriting",
      });
    }
  }

  checkMenuConfig(value, ctx);
  checkProductConfig(value, ctx);
}

/**
 * Menyu tuguni sozlamasi (§12).
 *
 * `targetId` ning daraxtdagi holati bu yerda tekshirilmaydi — buni faqat
 * butun daraxtni ko'rgan `validateTree` bila oladi (halqa, o'z avlodiga
 * ulash). Bu yerda faqat shakl: tur, uzunlik va o'ziga ko'rsatmaslik.
 */
function checkMenuConfig(
  value: z.infer<typeof baseButton>,
  ctx: z.RefinementCtx,
): void {
  const config = value.actionConfig as {
    targetId?: unknown;
    layout?: unknown;
    title?: unknown;
    description?: unknown;
  };

  if (config.targetId !== undefined && config.targetId !== null) {
    if (typeof config.targetId !== "string" || !config.targetId.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["actionConfig", "targetId"],
        message: "Menyu manzili noto'g'ri",
      });
    }
  }

  if (config.layout !== undefined && config.layout !== null) {
    const layout = Number(config.layout);
    if (!Number.isInteger(layout) || layout < 1 || layout > 8) {
      ctx.addIssue({
        code: "custom",
        path: ["actionConfig", "layout"],
        message: "Qatordagi tugma soni 1 dan 8 gacha bo'lishi kerak",
      });
    }
  }

  for (const field of ["title", "description"] as const) {
    const text = config[field];
    if (typeof text === "string" && text.length > 1024) {
      ctx.addIssue({
        code: "custom",
        path: ["actionConfig", field],
        message: "Matn juda uzun",
      });
    }
  }
}

/** Mahsulot va savat amallari uchun talablar. */
function checkProductConfig(
  value: z.infer<typeof baseButton>,
  ctx: z.RefinementCtx,
): void {
  const config = value.actionConfig as {
    price?: unknown;
    stock?: unknown;
    currency?: unknown;
    productId?: unknown;
  };

  if (value.actionType === "product") {
    if (config.price !== undefined && config.price !== null) {
      const price = Number(config.price);
      if (!Number.isFinite(price) || price < 0) {
        ctx.addIssue({
          code: "custom",
          path: ["actionConfig", "price"],
          message: "Narx musbat son bo'lishi kerak",
        });
      }
    }
    if (config.stock !== undefined && config.stock !== null) {
      const stock = Number(config.stock);
      if (!Number.isInteger(stock) || stock < 0) {
        ctx.addIssue({
          code: "custom",
          path: ["actionConfig", "stock"],
          message: "Ombor soni 0 yoki undan katta butun son bo'lishi kerak",
        });
      }
    }
    if (config.currency !== undefined && typeof config.currency === "string") {
      if (!/^[A-Za-z]{3}$/.test(config.currency.trim())) {
        ctx.addIssue({
          code: "custom",
          path: ["actionConfig", "currency"],
          message: "Valyuta uch harfli kod bo'lishi kerak (UZS, USD …)",
        });
      }
    }
  }

  if (value.actionType === "add_to_cart") {
    if (typeof config.productId !== "string" || !config.productId.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["actionConfig", "productId"],
        message: "Mahsulotni tanlang",
      });
    }
  }
}

export const createButtonSchema = baseButton.superRefine(checkRequirements);

export const updateButtonSchema = baseButton.partial().superRefine((value, ctx) => {
  // Qisman yangilashda ham to'liq shakl tekshiriladi: chaqiruvchi mavjud
  // qiymatlar bilan birlashtirib yuboradi.
  if (value.buttonType && value.keyboardKind) {
    checkRequirements(value as z.infer<typeof baseButton>, ctx);
  }
});

export const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        parentId: z.string().trim().min(1).nullable(),
        rowIndex: z.number().int().min(0).max(99),
        sortOrder: z.number().int().min(0).max(99),
      }),
    )
    .max(200),
});

export const generateSchema = z.object({
  prompt: z.string().trim().max(500).optional(),
  templateId: z.string().trim().max(40).optional(),
});

export const applySeedsSchema = z.object({
  templateId: z.string().trim().max(40),
  /// Faqat tanlangan ildiz tugmalar (indeks bo'yicha); bo'sh bo'lsa — hammasi
  select: z.array(z.number().int().min(0).max(100)).optional(),
});

export type CreateButtonInput = z.infer<typeof createButtonSchema>;
export type UpdateButtonInput = z.infer<typeof updateButtonSchema>;
