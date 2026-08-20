import "server-only";
import type { ButtonRecord } from "@/lib/bots/buttons/types";

/**
 * Nashr etilgan daraxtning jarayon ichidagi keshi (§15).
 *
 * Har bir tugma bosilishi kamida bitta menyuni qayta yig'adi, bu esa
 * nashr suratini o'qishni talab qiladi. Surat faqat «Nashr etish» bosilganda
 * o'zgaradi — demak har callback uchun bazaga borish keraksiz ish. Kesh
 * bilan bosishdan javobga qadar bitta ham qo'shimcha so'rov ketmaydi.
 *
 * Bir nechta instansda ishlaganda: nashr o'z instansidagi keshni darhol
 * tozalaydi, qolganlari esa TTL ichida (60 s) yangilanadi. Aniq bir zumda
 * tarqalish kerak bo'lsa shu joyni Redis pub/sub bilan almashtirish yetarli —
 * chaqiruvchilar uchun interfeys o'zgarmaydi.
 */

type Entry = { tree: ButtonRecord[]; expires: number };

const TTL_MS = 60_000;
/// Bitta jarayonda nechta botning daraxti saqlansin
const MAX_ENTRIES = 500;

const cache = new Map<string, Entry>();

let hits = 0;
let misses = 0;

export function cachedTree(botId: string): ButtonRecord[] | null {
  const entry = cache.get(botId);
  if (!entry) {
    misses += 1;
    return null;
  }
  if (entry.expires < Date.now()) {
    cache.delete(botId);
    misses += 1;
    return null;
  }
  hits += 1;
  return entry.tree;
}

export function cacheTree(botId: string, tree: ButtonRecord[]): void {
  // Eng eski yozuvni chiqarib tashlaymiz: Map kiritish tartibini saqlaydi.
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(botId, { tree, expires: Date.now() + TTL_MS });
}

/**
 * Nashr etilganda va bot o'chirilganda chaqiriladi.
 *
 * Versiyani tiklash bu ro'yxatda YO'Q: tiklash suratni qoralamaga qaytaradi,
 * jonli bot esa hamon oxirgi nashrda ishlaydi — kesh to'g'ri qiymatni saqlab
 * turadi.
 */
export function invalidateTree(botId: string): void {
  cache.delete(botId);
}

/** Sinov va diagnostika uchun. */
export function cacheStats(): { size: number; hits: number; misses: number } {
  return { size: cache.size, hits, misses };
}

export function resetCache(): void {
  cache.clear();
  hits = 0;
  misses = 0;
}
