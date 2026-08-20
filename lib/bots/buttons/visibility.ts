import type { Condition, ButtonRecord, Visibility } from "@/lib/bots/buttons/types";

/**
 * Tugma shu foydalanuvchiga ko'rinadimi — auditoriya va shartlar bo'yicha.
 *
 * Qoida: klient qaysi tugmalarni ko'rishini o'zi hal QILMAYDI va
 * `callback_data` ni o'zgartirib yashirin tugmani chaqira olmaydi — router
 * har bosishda shu tekshiruvni server tomonda qaytadan bajaradi.
 *
 * Fayl `server-only` emas, chunki bu sof qoida hisoblovchi: konstruktordagi
 * preview «bu tugma kimga ko'rinadi» ni aynan shu kod bilan ko'rsatadi.
 * Ruxsatni belgilash emas, faqat hisoblash — ishonch nuqtasi serverdagi
 * chaqiruvda qoladi.
 */

/** Qoidalarni baholash uchun kerak bo'ladigan foydalanuvchi konteksti. */
export type ViewerContext = {
  telegramUserId: string;
  username: string | null;
  languageCode: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  messageCount: number;
  /// Bot egasi yoki admin sifatida belgilanganmi
  isAdmin: boolean;
};

const NEW_USER_MESSAGE_LIMIT = 3;

export function isVisibleTo(button: ButtonRecord, viewer: ViewerContext): boolean {
  if (!button.enabled) return false;
  if (button.adminOnly && !viewer.isAdmin) return false;
  if (!audienceAllows(button.visibility, viewer)) return false;

  // Shartlar «va» bilan bog'lanadi: bittasi bajarilmasa tugma ko'rinmaydi.
  return button.conditions.every((condition) => conditionHolds(condition, viewer));
}

function audienceAllows(visibility: Visibility, viewer: ViewerContext): boolean {
  switch (visibility?.audience) {
    case "admin":
      return viewer.isAdmin;
    case "tagged":
      return (visibility.tags ?? []).some((tag) => viewer.tags.includes(tag));
    case "new":
      return viewer.messageCount <= NEW_USER_MESSAGE_LIMIT;
    case "existing":
      return viewer.messageCount > NEW_USER_MESSAGE_LIMIT;
    default:
      return true;
  }
}

function conditionHolds(condition: Condition, viewer: ViewerContext): boolean {
  const actual = fieldValue(condition.field, viewer);
  const expected = condition.value ?? "";

  switch (condition.operator) {
    case "exists":
      return Array.isArray(actual) ? actual.length > 0 : actual !== null && actual !== "";
    case "equals":
      return String(actual ?? "") === expected;
    case "not_equals":
      return String(actual ?? "") !== expected;
    case "contains":
      return Array.isArray(actual)
        ? actual.includes(expected)
        : String(actual ?? "").toLowerCase().includes(expected.toLowerCase());
    case "greater_than":
      return toNumber(actual) > Number(expected);
    case "less_than":
      return toNumber(actual) < Number(expected);
    default:
      return true;
  }
}

function fieldValue(
  field: Condition["field"],
  viewer: ViewerContext,
): string | number | string[] | null {
  switch (field) {
    case "messageCount":
      return viewer.messageCount;
    case "phone":
      return viewer.phone;
    case "email":
      return viewer.email;
    case "languageCode":
      return viewer.languageCode;
    case "username":
      return viewer.username;
    case "tags":
      return viewer.tags;
    default:
      return null;
  }
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
