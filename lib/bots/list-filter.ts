import type { BotStatusValue } from "@/components/bots/status";

/**
 * «Botlarim» ro'yxatini qidirish, filtrlash va saralash (§20).
 *
 * Klient tomonda bajariladi: bir ish maydonidagi botlar soni odatda o'nlab,
 * shuning uchun har bir harf uchun serverga chiqish ortiqcha kechikish
 * bo'lardi. Ro'yxat yuzlab bo'lguncha bu yondashuv yetarli; undan keyin
 * serverdagi sahifalashga o'tiladi.
 *
 * Alohida modulda — komponentsiz sinash uchun.
 */

export type Filter = "all" | "active" | "inactive";
export type Sort = "recent" | "name" | "created";

export type FilterableBot = {
  name: string;
  username: string;
  description: string | null;
  status: BotStatusValue;
  createdAt: string;
  updatedAt: string;
};

export function applyFilters<T extends FilterableBot>(
  bots: readonly T[],
  query: string,
  filter: Filter,
  sort: Sort,
): T[] {
  const needle = query.trim().toLowerCase();

  const filtered = bots.filter((bot) => {
    // «Faol emas» — `active` dan boshqa hamma holat: sozlanmagan, xato va
    // to'xtatilgan. Foydalanuvchi uchun ular bitta savolning javobi:
    // «bu bot hozir ishlayaptimi?»
    if (filter === "active" && bot.status !== "active") return false;
    if (filter === "inactive" && bot.status === "active") return false;

    if (!needle) return true;
    return (
      bot.name.toLowerCase().includes(needle) ||
      bot.username.toLowerCase().includes(needle) ||
      (bot.description?.toLowerCase().includes(needle) ?? false)
    );
  });

  // `filter` allaqachon yangi massiv qaytardi — joyida saralash xavfsiz va
  // chaqiruvchining ro'yxatiga tegmaydi.
  return filtered.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "created") return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}
