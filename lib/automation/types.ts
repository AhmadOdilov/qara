import { z } from "zod";

/**
 * Avtomatlashtirish domeni (§P4).
 *
 * WHEN → IF → THEN. Ataylab tugunlar grafi EMAS: birinchi versiyada
 * murakkab node muharriri qurilmaydi, chunki foydalanuvchilarning aksariyati
 * uchun uchta bo'lim yetarli. Grafga o'tish kerak bo'lganda
 * `telegram_bot_workflows` jadvali tayyor turibdi.
 *
 * Bu modul SOF: baza ham, tarmoq ham yo'q — hammasi test qilinadi.
 */

/* ── Triggerlar ──────────────────────────────────────────────────────────── */

/**
 * Runtime'da HAQIQATAN ishga tushadigan hodisalar.
 *
 * Ro'yxatga faqat bot runtime'ida chaqiruv nuqtasi BOR hodisa kiradi.
 * Rejadagi hodisalar `PLANNED_TRIGGERS` da — ular UI'da tanlanmaydi.
 */
export const LIVE_TRIGGERS = [
  "user_joined",
  "user_started",
  "message_received",
  "keyword_received",
  "button_clicked",
  "order_created",
  "payment_successful",
  "payment_failed",
] as const;

/**
 * Hali chaqiruv nuqtasi yo'q hodisalar.
 *
 * `scheduled`, `delay` va `inactivity` vaqtga bog'liq — ular navbat yoki
 * cron talab qiladi, loyihada esa hozircha ikkalasi ham yo'q (§10 bo'yicha
 * sababsiz Redis/BullMQ qo'shilmadi). `order_status_changed` buyurtma
 * holatini o'zgartiradigan yagona joy to'lov qatlami bo'lgani uchun
 * `payment_*` bilan qoplanadi.
 */
export const PLANNED_TRIGGERS = [
  "order_status_changed",
  "scheduled",
  "delay",
  "inactivity",
] as const;

export type LiveTrigger = (typeof LIVE_TRIGGERS)[number];
export type PlannedTrigger = (typeof PLANNED_TRIGGERS)[number];
export type TriggerName = LiveTrigger | PlannedTrigger;

export function isLiveTrigger(value: unknown): value is LiveTrigger {
  return (
    typeof value === "string" && (LIVE_TRIGGERS as readonly string[]).includes(value)
  );
}

/* ── Shartlar ────────────────────────────────────────────────────────────── */

export const OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "starts_with",
  "greater_than",
  "less_than",
  "exists",
  "not_exists",
] as const;

export type Operator = (typeof OPERATORS)[number];

/**
 * Shartda ishlatiladigan maydonlar.
 *
 * Nuqtali yo'l ataylab YOPIQ ro'yxat: ixtiyoriy yo'lga ruxsat berish
 * hodisa obyektining ichki maydonlarini ochib qo'yardi.
 */
export const CONDITION_FIELDS = [
  "user.telegramUserId",
  "user.username",
  "user.languageCode",
  "user.phone",
  "user.messageCount",
  "user.tags",
  "message.text",
  "button.id",
  "button.text",
  "order.code",
  "order.amount",
  "order.currency",
  "payment.provider",
  "payment.status",
  "event.name",
] as const;

export type ConditionField = (typeof CONDITION_FIELDS)[number];

export const ruleSchema = z.object({
  field: z.enum(CONDITION_FIELDS),
  operator: z.enum(OPERATORS),
  /** `exists` / `not_exists` uchun kerak emas. */
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export type Rule = z.infer<typeof ruleSchema>;

export const conditionSchema = z.object({
  op: z.enum(["and", "or"]).default("and"),
  rules: z.array(ruleSchema).max(20).default([]),
});

export type Condition = z.infer<typeof conditionSchema>;

/* ── Amallar ─────────────────────────────────────────────────────────────── */

/** Runtime'da bajariladigan amallar. */
export const LIVE_ACTIONS = [
  "send_message",
  "notify_admin",
  "add_tag",
  "remove_tag",
  "call_webhook",
  "start_automation",
  "stop",
] as const;

/**
 * Sxemada joyi bor, lekin bajaruvchisi yo'q amallar.
 *
 * `show_buttons` menyu daraxtiga bog'liq va alohida ishlab chiqishni talab
 * qiladi; `create_order` savat holatini talab qiladi va to'lov qatlami bilan
 * bir tranzaksiyada bo'lishi kerak; integratsiyalar esa hali runtime'siz.
 */
export const PLANNED_ACTIONS = [
  "show_buttons",
  "create_order",
  "google_sheets_append",
  "crm_upsert",
] as const;

export type LiveAction = (typeof LIVE_ACTIONS)[number];

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("send_message"),
    text: z.string().trim().min(1).max(4000),
  }),
  z.object({
    type: z.literal("notify_admin"),
    text: z.string().trim().min(1).max(1000),
  }),
  z.object({ type: z.literal("add_tag"), tag: z.string().trim().min(1).max(32) }),
  z.object({ type: z.literal("remove_tag"), tag: z.string().trim().min(1).max(32) }),
  z.object({
    type: z.literal("call_webhook"),
    url: z.string().url().max(500),
    /** Tana shabloni — o'rin egallovchilar bilan. */
    body: z.string().max(2000).optional(),
  }),
  z.object({
    type: z.literal("start_automation"),
    automationId: z.string().min(1).max(64),
  }),
  z.object({ type: z.literal("stop") }),
]);

export type Action = z.infer<typeof actionSchema>;

export const automationSchema = z.object({
  name: z.string().trim().min(1).max(80),
  trigger: z.enum(LIVE_TRIGGERS),
  triggerConfig: z.record(z.string(), z.unknown()).default({}),
  conditions: conditionSchema.default({ op: "and", rules: [] }),
  actions: z.array(actionSchema).min(1).max(10),
});

export type AutomationInput = z.infer<typeof automationSchema>;

/* ── Cheklovlar ──────────────────────────────────────────────────────────── */

/**
 * Cheksiz sikldan himoya (§9).
 *
 * A → B → A zanjiri shu chegaralarda to'xtaydi. Uchalasi ham config orqali
 * pasaytirilishi mumkin, lekin oshirilmaydi — chegarani muhit o'zgaruvchisi
 * bilan ko'tarib yuborish himoyani yo'q qilardi.
 */
export const LIMITS = {
  /** `start_automation` orqali ichma-ich ishga tushirish chuqurligi. */
  maxDepth: readLimit("AUTOMATION_MAX_DEPTH", 3, 3),
  /** Bitta hodisada bajariladigan amallar soni (barcha darajalar bo'yicha). */
  maxActions: readLimit("AUTOMATION_MAX_ACTIONS", 20, 20),
  /** Bitta ishga tushirish uchun vaqt chegarasi. */
  timeoutMs: readLimit("AUTOMATION_TIMEOUT_MS", 10_000, 10_000),
  /** Bitta hodisada ishga tushadigan avtomatlar soni. */
  maxAutomationsPerEvent: 10,
} as const;

/** Muhitdan o'qiydi, lekin standart qiymatdan OSHIRISHGA ruxsat bermaydi. */
function readLimit(name: string, fallback: number, ceiling: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, ceiling);
}
