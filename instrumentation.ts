/**
 * Ishga tushishdagi tekshiruv (§P10 PHASE 1, §P12 PHASE 1).
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
 * chaqirilmaydi. Shu sababli bu yer sirlarni tekshirish uchun to'g'ri joy:
 * build sirsiz o'tadi, noto'g'ri sozlangan konteyner esa umuman ko'tarilmaydi.
 *
 * Tekshiruv MANTIG'I `lib/config-check.ts` da — u sof funksiya va testlar
 * bilan qoplangan. Bu fayl faqat natijani qo'llaydi: ogohlantirishlarni
 * yozadi, xatolarda esa serverni ko'tarmaydi.
 */

import { checkProductionConfig, formatProblems } from "@/lib/config-check";

export function register(): void {
  const problems = checkProductionConfig(process.env);

  // Ogohlantirishlar ishga tushishni to'xtatmaydi: ilova ishlaydi, lekin
  // operator buni BILISHI kerak.
  for (const problem of problems) {
    if (problem.level !== "warn") continue;
    warn(`${problem.name} — ${problem.message}`);
  }

  if (problems.some((problem) => problem.level === "error")) {
    // `throw` ataylab: Next server ko'tarilmaydi, konteyner
    // healthcheck'dan o'tmaydi va noto'g'ri sozlangan nusxa trafik olmaydi.
    throw new Error(formatProblems(problems));
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
