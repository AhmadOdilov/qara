/**
 * Sevimlilar — sof hisob.
 *
 * Savatcha bilan bir xil qoidada ishlaydi: ro'yxatda faqat mahsulot
 * tugmasining id'si saqlanadi, nomi va narxi esa HAR SAFAR nashr etilgan
 * daraxtdan o'qiladi. Shu sababli egasi narxni o'zgartirsa sevimlilar ham
 * darhol to'g'ri ko'rsatadi, o'chirilgan mahsulot esa ro'yxatdan o'zi tushib
 * qoladi.
 *
 * Saqlash joyi — `TelegramBotUser.variables.favorites`. Alohida jadval
 * qo'shilmadi: sxemani o'zgartirmasdan savatcha bilan bitta mexanizmda
 * qolishi arzonroq va migratsiya talab qilmaydi.
 *
 * Bazaga yozish bu yerda emas — router qaytgan natijani saqlaydi.
 */

import {
  productConfig,
  type ButtonRecord,
  type ProductConfig,
} from "@/lib/bots/buttons/types";

/**
 * Ro'yxatdagi mahsulotlar soni.
 *
 * Savatcha bilan bir xil qoidada: saqlash chegarasi ekranda KO'RSATILADIGAN
 * chegaraga teng. Aks holda foydalanuvchi qo'shgan sevimlisi ro'yxatda
 * umuman ko'rinmay qolardi — jim yo'qolgan ma'lumot.
 */
export const MAX_FAVORITES = 20;

export type Favorites = string[];

export const NO_FAVORITES: Favorites = [];

/** `TelegramBotUser.variables` ichidan sevimlilarni ajratib oladi. */
export function readFavorites(variables: unknown): Favorites {
  const raw = (variables as { favorites?: unknown } | null | undefined)?.favorites;
  if (!Array.isArray(raw)) return NO_FAVORITES;

  const clean: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !item) continue;
    if (clean.includes(item)) continue;
    clean.push(item);
    if (clean.length >= MAX_FAVORITES) break;
  }
  return clean;
}

/** Bitta tugma ikki vazifani bajaradi — natijada qaysi tomonga o'tgani qaytadi. */
export function toggleFavorite(
  favorites: Favorites,
  productId: string,
): { favorites: Favorites; added: boolean } {
  if (favorites.includes(productId)) {
    return { favorites: favorites.filter((id) => id !== productId), added: false };
  }
  // Chegaraga yetganda eng eskisi o'rnini yangisiga beradi.
  const kept = favorites.slice(-(MAX_FAVORITES - 1));
  return { favorites: [...kept, productId], added: true };
}

export function isFavorite(favorites: Favorites | undefined, productId: string): boolean {
  return Boolean(favorites?.includes(productId));
}

export type FavoriteItem = {
  button: ButtonRecord;
  config: ProductConfig;
};

/**
 * Sevimlilarni daraxt bilan birlashtiradi.
 *
 * Nashrdan chiqib ketgan mahsulot jim tashlab yuboriladi: foydalanuvchi
 * bosilmaydigan tugmani ko'rmasligi kerak.
 */
export function resolveFavorites(
  all: ButtonRecord[],
  favorites: Favorites,
): FavoriteItem[] {
  const items: FavoriteItem[] = [];
  for (const productId of favorites) {
    const button = all.find(
      (candidate) => candidate.id === productId && candidate.actionType === "product",
    );
    if (!button) continue;
    items.push({ button, config: productConfig(button) });
  }
  return items;
}
