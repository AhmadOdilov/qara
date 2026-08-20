import type { BusinessKind } from "@/lib/ai/blueprint";

/**
 * Shablon katalogi uchun turkumlar (§21).
 *
 * Retseptlar (`lib/ai/recipes.ts`) ro'yxati o'ntadan oshgani sari yassi
 * ro'yxatni ko'zdan kechirish qiyinlashadi. Turkum — bitta savolga javob:
 * "bu bot nima qiladi?". Shuning uchun guruhlash biznes turi bo'yicha,
 * texnik funksiyalar bo'yicha emas.
 *
 * `lib/` da turadi: sahifa ham, testlar ham shu bitta manbadan o'qisin.
 */

export const TEMPLATE_CATEGORIES = [
  "sales",
  "food",
  "services",
  "education",
  "support",
  "other",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

/**
 * Biznes turi → turkum. Ro'yxatda bo'lmagan (kelajakda qo'shiladigan) tur
 * `other` ga tushadi — yangi retsept qo'shilganda shablon katalogdan
 * tushib qolmasin.
 */
const BY_KIND: Partial<Record<BusinessKind, TemplateCategory>> = {
  ecommerce: "sales",
  clothing: "sales",
  delivery: "sales",
  restaurant: "food",
  beauty: "services",
  booking: "services",
  education: "education",
  support: "support",
  ai_assistant: "support",
  other: "other",
};

export function categoryOf(kind: string): TemplateCategory {
  return BY_KIND[kind as BusinessKind] ?? "other";
}

export type TemplateCard = {
  id: string;
  title: string;
  emoji: string;
  tagline: string;
  features: readonly string[];
};

/**
 * Turkum bo'yicha filtr. `null` — hammasi.
 *
 * Tartib saqlanadi: retseptlar katalogdagi tartibda turadi va u ataylab
 * tanlangan (eng ko'p ishlatiladigani birinchi).
 */
export function filterByCategory<T extends { id: string }>(
  cards: readonly T[],
  category: TemplateCategory | null,
): T[] {
  if (!category) return [...cards];
  return cards.filter((card) => categoryOf(card.id) === category);
}

/** Katalogda haqiqatan mavjud turkumlar — bo'sh chip ko'rsatmaslik uchun. */
export function usedCategories<T extends { id: string }>(
  cards: readonly T[],
): TemplateCategory[] {
  const used = new Set(cards.map((card) => categoryOf(card.id)));
  return TEMPLATE_CATEGORIES.filter((category) => used.has(category));
}
