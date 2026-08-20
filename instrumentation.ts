/**
 * Ishga tushishdagi tekshiruv (§P10 PHASE 1).
 *
 * MUAMMO. Sirlar DANGASA o'qiladi (`lib/env.ts`) — bu ataylab qilingan,
 * chunki `next build` sahifa ma'lumotini yig'ayotganda route modullarini
 * baholaydi va sir build vaqtida talab qilinmasligi kerak (aks holda uni
 * Docker build argumentiga qo'yish va image qatlamlarida qoldirish kerak
 * bo'lardi).
 *
 * Lekin dangasa o'qishning narxi bor: `AUTH_SECRET` yo'q bo'lsa konteyner
 * SOG'LOM ko'rinib turadi va xato faqat birinchi kirish urinishida
 * chiqadi — ya'ni foydalanuvchi topadi, siz emas.
 *
 * YECHIM. `register()` server ishga tushganda BIR MARTA chaqiriladi va
 * so'rovlarni qabul qilishdan OLDIN tugashi kerak. Build fazasida esa
 * chaqirilmaydi (`NEXT_PHASE` bilan qo'shimcha himoyalangan). Shu sababli
 * bu yer sirlarni tekshirish uchun to'g'ri joy: build sirsiz o'tadi,
 * noto'g'ri sozlangan konteyner esa umuman ko'tarilmaydi.
 */

/** Produksiyada bo'lishi SHART. Yo'q bo'lsa server ishga tushmaydi. */
const REQUIRED = [
  {
    name: "AUTH_SECRET",
    why: "sessiya cookie'lari shu kalit bilan imzolanadi",
    how: "openssl rand -base64 32",
  },
  {
    name: "DATABASE_URL",
    why: "bazasiz ilova hech narsa qila olmaydi",
    how: "postgresql://user:parol@host:5432/qara?schema=public",
  },
] as const;

export function register(): void {
  // Build fazasi: sir talab qilinmaydi.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Dev va test — yumshoq rejim. `.env` bo'lmasa ham ishlab ko'rish mumkin.
  if (process.env.NODE_ENV !== "production") return;

  const missing = REQUIRED.filter(
    (item) => !process.env[item.name]?.trim(),
  );

  if (missing.length > 0) {
    const lines = missing.map(
      (item) => `  · ${item.name} — ${item.why}\n      misol: ${item.how}`,
    );
    // Bu yerda `throw` ataylab: Next server ko'tarilmaydi, konteyner
    // healthcheck'dan o'tmaydi va noto'g'ri sozlangan nusxa trafik olmaydi.
    throw new Error(
      `Produksiya uchun majburiy muhit o'zgaruvchilari yo'q:\n${lines.join("\n")}\n` +
        `\n.env.example dan nusxa oling: cp .env.example .env`,
    );
  }

  // ── Xato emas, lekin xavfli standart qiymatlar ─────────────────────────
  // Bular ishga tushishni to'xtatmaydi: ilova ishlaydi, lekin operator
  // buni BILISHI kerak.

  if (!process.env.SECRETS_KEY?.trim()) {
    warn(
      "SECRETS_KEY belgilanmagan — shifrlash kaliti AUTH_SECRET'dan hosil " +
        "qilinadi. AUTH_SECRET almashsa saqlangan bot tokenlari OCHILMAY qoladi.",
    );
  }

  const appUrl = process.env.APP_URL?.trim() ?? "";
  if (!appUrl || appUrl.startsWith("http://localhost")) {
    warn(
      `APP_URL "${appUrl || "belgilanmagan"}" — webhook va OAuth callback ` +
        "manzillari noto'g'ri bo'ladi. Tashqi HTTPS manzilni qo'ying.",
    );
  }

  const hops = process.env.TRUSTED_PROXY_HOPS?.trim();
  const header = process.env.TRUSTED_PROXY_HEADER?.trim();
  if (!hops && !header) {
    warn(
      "TRUSTED_PROXY_HOPS ham, TRUSTED_PROXY_HEADER ham sozlanmagan — " +
        "X-Forwarded-For ga ishonilmaydi va rate limit hamma so'rov uchun " +
        "UMUMIY bo'ladi. Caddy orqasida TRUSTED_PROXY_HOPS=1 qo'ying.",
    );
  }
}

/**
 * `lib/log.ts` bu yerda ATAYLAB ishlatilmaydi: u `server-only` ni import
 * qiladi va instrumentation Edge muhitida ham yuklanishi mumkin. Bu
 * funksiya sir emas, faqat sozlama nomlarini yozadi.
 */
function warn(message: string): void {
  console.warn(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "warn",
      msg: `startup: ${message}`,
    }),
  );
}
