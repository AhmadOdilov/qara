import { z } from "zod";
import { ACTION_TYPES } from "@/lib/bots/buttons/types";

/**
 * Bot rejasi (blueprint) — AI ham, qoidaga asoslangan generator ham SHU
 * shaklni qaytaradi. Interfeys bitta bo'lgani uchun UI natija qayerdan
 * kelganini bilishi shart emas.
 *
 * MUHIM (§60): reja — deklarativ konfiguratsiya, bajariladigan kod emas.
 * AI hech qachon server kodini yozmaydi; u faqat shu sxemaga to'ldiradi va
 * sxema serverda qayta tekshiriladi.
 *
 * Bu fayl `server-only` emas — tiplar va yorliqlar klient formasida ham kerak.
 */

/* ── Funksiyalar katalogi (§6 "Recommended features") ────────────────────── */

export type FeatureId = (typeof FEATURES)[number]["id"];

export const FEATURES = [
  { id: "digital_menu", label: "Digital Menu", emoji: "📋" },
  { id: "catalog", label: "Product Catalog", emoji: "🛍" },
  { id: "categories", label: "Categories", emoji: "🗂" },
  { id: "cart", label: "Shopping Cart", emoji: "🛒" },
  { id: "orders", label: "Orders", emoji: "📦" },
  { id: "delivery", label: "Delivery", emoji: "🚚" },
  { id: "payments", label: "Payments", emoji: "💳" },
  { id: "promotions", label: "Promotions", emoji: "🎁" },
  { id: "booking", label: "Booking", emoji: "📅" },
  { id: "staff", label: "Staff / Masters", emoji: "👩‍💼" },
  { id: "reminders", label: "Reminders", emoji: "⏰" },
  { id: "courses", label: "Courses", emoji: "📚" },
  { id: "tests", label: "Tests & Quizzes", emoji: "📝" },
  { id: "progress", label: "Progress Tracking", emoji: "📊" },
  { id: "certificates", label: "Certificates", emoji: "🏆" },
  { id: "ai_assistant", label: "AI Assistant", emoji: "🤖" },
  { id: "knowledge_base", label: "Knowledge Base", emoji: "📖" },
  { id: "web_search", label: "Web Search", emoji: "🔎" },
  { id: "support", label: "Customer Support", emoji: "🎧" },
  { id: "human_handoff", label: "Human Handoff", emoji: "🙋" },
  { id: "tracking", label: "Order Tracking", emoji: "📍" },
  { id: "location", label: "Location", emoji: "🗺" },
  { id: "broadcast", label: "Broadcast", emoji: "📣" },
  { id: "analytics", label: "Analytics", emoji: "📈" },
  { id: "crm", label: "Customer Database", emoji: "👥" },
] as const;

const FEATURE_IDS = FEATURES.map((f) => f.id) as [FeatureId, ...FeatureId[]];

export function featureLabel(id: string): { label: string; emoji: string } {
  return FEATURES.find((f) => f.id === id) ?? { label: id, emoji: "•" };
}

/* ── Biznes turlari ──────────────────────────────────────────────────────── */

export const BUSINESS_KINDS = [
  "restaurant",
  "ecommerce",
  "clothing",
  "beauty",
  "education",
  "support",
  "delivery",
  "ai_assistant",
  "booking",
  "other",
] as const;
export type BusinessKind = (typeof BUSINESS_KINDS)[number];

/* ── Integratsiyalar (§41, O'zbekistonga moslangan) ──────────────────────── */

export const INTEGRATIONS = [
  { id: "payme", label: "Payme" },
  { id: "click", label: "Click" },
  { id: "telegram_payments", label: "Telegram Payments" },
  { id: "google_sheets", label: "Google Sheets" },
  { id: "rest_api", label: "REST API" },
  { id: "billz", label: "Billz" },
  { id: "moysklad", label: "MoySklad" },
  { id: "sms", label: "SMS" },
] as const;

const INTEGRATION_IDS = INTEGRATIONS.map((i) => i.id) as [string, ...string[]];

/* ── Sxema ───────────────────────────────────────────────────────────────── */

/**
 * Menyu ataylab IKKI qavat: strukturaviy chiqish (structured outputs)
 * rekursiv sxemani qo'llab-quvvatlamaydi, Telegram menyulari esa amalda
 * shundan chuqur bo'lmaydi. Kerak bo'lsa builder'da qo'lda chuqurlashtiriladi.
 */
const leafButton = z.object({
  text: z.string().trim().min(1).max(32),
  emoji: z.string().trim().max(8),
  actionType: z.enum(ACTION_TYPES),
  /// `send_message` uchun javob matni; boshqa amallarda bo'sh bo'lishi mumkin
  reply: z.string().trim().max(1024),
});

const menuButton = leafButton.extend({
  children: z.array(leafButton).max(10),
});

export const blueprintSchema = z.object({
  name: z.string().trim().min(1).max(64),
  description: z.string().trim().max(512),
  shortDescription: z.string().trim().max(120),
  businessKind: z.enum(BUSINESS_KINDS),
  language: z.enum(["uz", "ru", "en"]),
  welcomeMessage: z.string().trim().min(1).max(1024),
  features: z.array(z.enum(FEATURE_IDS)).max(FEATURES.length),
  commands: z
    .array(
      z.object({
        command: z
          .string()
          .trim()
          .regex(/^[a-z][a-z0-9_]{0,30}$/, "Buyruq faqat kichik harf va _"),
        description: z.string().trim().min(1).max(120),
        reply: z.string().trim().max(1024),
      }),
    )
    .max(20),
  menu: z.array(menuButton).max(12),
  ai: z.object({
    enabled: z.boolean(),
    systemPrompt: z.string().trim().max(4000),
    personality: z.enum(["friendly", "professional", "concise", "playful"]),
    webSearch: z.boolean(),
    knowledgeBase: z.boolean(),
  }),
  integrations: z.array(z.enum(INTEGRATION_IDS)).max(INTEGRATIONS.length),
  automations: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(64),
        trigger: z.enum([
          "on_start",
          "on_new_user",
          "on_order",
          "on_payment",
          "on_keyword",
          "schedule",
        ]),
        description: z.string().trim().max(280),
      }),
    )
    .max(10),
});

export type Blueprint = z.infer<typeof blueprintSchema>;
export type BlueprintMenuItem = z.infer<typeof menuButton>;

/** Reja qayerdan keldi — UI'da ochiq ko'rsatiladi, sirli emas. */
export type BlueprintSource = "claude" | "rule_based";

export type PlanResult = {
  blueprint: Blueprint;
  source: BlueprintSource;
  /** Rule-based'ga tushib qolgan bo'lsa — sababi (UI'da ogohlantirish uchun). */
  fallbackReason?: string;
};

/** Menyu daraxtidagi jami tugmalar soni — xulosa kartalari uchun. */
export function countMenu(menu: BlueprintMenuItem[]): number {
  return menu.reduce((total, item) => total + 1 + item.children.length, 0);
}
