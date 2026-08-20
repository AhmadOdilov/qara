/**
 * Sahifalash yordamchilari (§P6 PHASE 14).
 *
 * Ilgari admin paneli `take: 200` bilan ishlardi — foydalanuvchi soni
 * o'sgach bu bitta so'rovda butun jadvalni tortib olardi va sahifa
 * sekinlashardi.
 *
 * Sof funksiyalar: URL parametrini xavfsiz songa aylantiradi va
 * chegaradan chiqmasligini kafolatlaydi.
 */

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export type PageParams = { page: number; size: number; skip: number };

/**
 * `?page=` va `?size=` ni o'qiydi.
 *
 * Har qanday buzuq qiymat (manfiy, harf, juda katta) standart qiymatga
 * tushadi — klient yuborgan parametr bilan bazaga og'ir so'rov
 * yuborib bo'lmaydi.
 */
export function readPage(
  params: { page?: string; size?: string } | undefined,
  defaultSize = DEFAULT_PAGE_SIZE,
): PageParams {
  const page = clamp(Number.parseInt(params?.page ?? "", 10), 1, 10_000, 1);
  const size = clamp(Number.parseInt(params?.size ?? "", 10), 1, MAX_PAGE_SIZE, defaultSize);
  return { page, size, skip: (page - 1) * size };
}

/** Umumiy sondan sahifalar sonini hisoblaydi. */
export function pageCount(total: number, size: number): number {
  if (size <= 0) return 1;
  return Math.max(1, Math.ceil(total / size));
}

/** «51–100 / 240» ko'rinishidagi diapazon. */
export function pageRange(
  page: number,
  size: number,
  total: number,
): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  const from = (page - 1) * size + 1;
  return { from, to: Math.min(page * size, total) };
}

/**
 * Chegaraga soladi.
 *
 * Pastdan chiqqan qiymat (`size=-1`) STANDART qiymatga tushadi, minimumga
 * emas: `size=1` texnik jihatdan haqiqiy, lekin foydalanuvchi buni
 * so'ramagan — bu buzuq kiritish. Yuqoridan chiqqani esa maksimumga
 * qisqaradi, chunki u aniq niyat («ko'proq ko'rsat»), faqat juda katta.
 */
function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const whole = Math.trunc(value);
  if (whole < min) return fallback;
  return Math.min(whole, max);
}
