/**
 * Urug'lantirilgan (seeded) tasodifiy generator.
 *
 * Savollar localStorage'da saqlanmaydi — faqat `seed` saqlanadi va sahifa
 * qayta yuklanganda ayni o'sha savollar qaytadan yasaladi. Shuning uchun
 * generator to'liq deterministik bo'lishi shart.
 */
export type Rng = () => number;

/** mulberry32 — kichik, tez va deterministik. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

/** Fisher–Yates — asl massivga tegmaydi. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Ro'yxatdan takrorlanmaydigan `count` ta element (yetmasa — bori). */
export function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  return shuffle(rng, items).slice(0, count);
}
