import type { Condition, ConditionField, Rule } from "@/lib/automation/types";

/**
 * Shart hisoblagichi (§P4 PHASE 4).
 *
 * Sof funksiya: kirish — hodisa konteksti, chiqish — `true` yoki `false`.
 * Baza ham, tarmoq ham yo'q, shuning uchun har bir operator to'liq test
 * qilinadi.
 */

/** Shart tekshiradigan hodisa surati. */
export type EventContext = {
  event: { name: string };
  user?: {
    telegramUserId?: string | null;
    username?: string | null;
    languageCode?: string | null;
    phone?: string | null;
    messageCount?: number | null;
    tags?: string[] | null;
  };
  message?: { text?: string | null };
  button?: { id?: string | null; text?: string | null };
  order?: { code?: string | null; amount?: number | null; currency?: string | null };
  payment?: { provider?: string | null; status?: string | null };
};

/** Yopiq ro'yxatdagi yo'l bo'yicha qiymatni oladi. */
export function readField(
  context: EventContext,
  field: ConditionField,
): string | number | string[] | null | undefined {
  switch (field) {
    case "user.telegramUserId":
      return context.user?.telegramUserId;
    case "user.username":
      return context.user?.username;
    case "user.languageCode":
      return context.user?.languageCode;
    case "user.phone":
      return context.user?.phone;
    case "user.messageCount":
      return context.user?.messageCount;
    case "user.tags":
      return context.user?.tags;
    case "message.text":
      return context.message?.text;
    case "button.id":
      return context.button?.id;
    case "button.text":
      return context.button?.text;
    case "order.code":
      return context.order?.code;
    case "order.amount":
      return context.order?.amount;
    case "order.currency":
      return context.order?.currency;
    case "payment.provider":
      return context.payment?.provider;
    case "payment.status":
      return context.payment?.status;
    case "event.name":
      return context.event.name;
  }
}

/** Bitta qoida. */
export function evaluateRule(context: EventContext, rule: Rule): boolean {
  const actual = readField(context, rule.field);

  if (rule.operator === "exists") return isPresent(actual);
  if (rule.operator === "not_exists") return !isPresent(actual);

  // Qolgan operatorlar qiymat talab qiladi — u yo'q bo'lsa qoida bajarilmaydi.
  if (rule.value === undefined) return false;
  if (!isPresent(actual)) return false;

  // Ro'yxat (teglar) uchun «ichida bormi» mantig'i.
  if (Array.isArray(actual)) {
    const needle = String(rule.value).toLowerCase();
    const has = actual.some((item) => item.toLowerCase() === needle);
    switch (rule.operator) {
      case "equals":
      case "contains":
        return has;
      case "not_equals":
        return !has;
      default:
        // `greater_than` va boshqalar ro'yxatga tegishli emas.
        return false;
    }
  }

  switch (rule.operator) {
    case "equals":
      return compareText(actual) === compareText(rule.value);
    case "not_equals":
      return compareText(actual) !== compareText(rule.value);
    case "contains":
      return compareText(actual).includes(compareText(rule.value));
    case "starts_with":
      return compareText(actual).startsWith(compareText(rule.value));
    case "greater_than": {
      const [left, right] = numbers(actual, rule.value);
      return left !== null && right !== null && left > right;
    }
    case "less_than": {
      const [left, right] = numbers(actual, rule.value);
      return left !== null && right !== null && left < right;
    }
    default:
      return false;
  }
}

/**
 * Butun shart bloki.
 *
 * Qoida yo'q bo'lsa `true` — «shartsiz» avtomat har doim bajariladi.
 */
export function evaluateCondition(
  context: EventContext,
  condition: Condition | null | undefined,
): boolean {
  const rules = condition?.rules ?? [];
  if (rules.length === 0) return true;

  return condition?.op === "or"
    ? rules.some((rule) => evaluateRule(context, rule))
    : rules.every((rule) => evaluateRule(context, rule));
}

/**
 * Qiymat mavjudmi.
 *
 * Tur predikati: `true` bo'lganda TypeScript `null | undefined` ni
 * chiqarib tashlaydi va quyidagi taqqoslashlar tipga mos bo'ladi.
 */
function isPresent<T>(value: T): value is NonNullable<T> {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Matn taqqoslash registr va bo'shliqqa bog'liq emas. */
function compareText(value: string | number | boolean): string {
  return String(value).trim().toLowerCase();
}

/** Ikkala tomonni songa keltiradi; biri son bo'lmasa `null`. */
function numbers(
  left: string | number,
  right: string | number | boolean,
): [number | null, number | null] {
  return [toNumber(left), toNumber(right)];
}

function toNumber(value: string | number | boolean): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return null;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}
