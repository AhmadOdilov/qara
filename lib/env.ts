import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} muhit o'zgaruvchisi belgilanmagan. .env.example dan nusxa oling: cp .env.example .env`,
    );
  }
  return value;
}

/**
 * Sirni DANGASA o'qiydi — birinchi ishlatilganda, modul yuklanganda emas.
 *
 * NEGA MUHIM. `next build` sahifa ma'lumotini yig'ish uchun route
 * modullarini BAHOLAYDI. Sir modul darajasida o'qilsa build sirni talab
 * qiladi — ya'ni uni Docker build argumentiga qo'yish kerak bo'lardi va u
 * image qatlamlarida qolib ketardi. Bu esa `.dockerignore` dagi butun
 * ehtiyotkorlikni bekor qiladi.
 *
 * Dangasa o'qishda build sirsiz o'tadi, runtime esa sir yo'q bo'lsa
 * O'SHA aniq xato bilan to'xtaydi — xatti-harakat o'zgarmaydi, faqat
 * vaqti siljiydi.
 */
function lazyRequired(name: string): () => string {
  let cached: string | null = null;
  return () => {
    if (cached === null) cached = required(name);
    return cached;
  };
}

const readAuthSecret = lazyRequired("AUTH_SECRET");

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  appUrl: optional("APP_URL", "http://localhost:3000").replace(/\/$/, ""),

  /**
   * Sessiya imzosi kaliti.
   *
   * Getter — qiymat faqat O'QILGANDA talab qilinadi. `env.authSecret`
   * ishlatilishi avvalgidek qoladi.
   */
  get authSecret(): string {
    return readAuthSecret();
  },

  telegram: {
    token: optional("TELEGRAM_BOT_TOKEN"),
    username: optional("TELEGRAM_BOT_USERNAME", "qara_dev_bot"),
    webhookSecret: optional("TELEGRAM_WEBHOOK_SECRET"),
  },

  google: {
    clientId: optional("GOOGLE_CLIENT_ID"),
    clientSecret: optional("GOOGLE_CLIENT_SECRET"),
  },

  isProd: process.env.NODE_ENV === "production",
};

/**
 * Bot tokeni yo'q bo'lsa ilova MOCK rejimda ishlaydi: Telegram API'ga
 * chaqiruv yuborilmaydi, xabarlar bazada saqlanadi va bot javoblari
 * simulyatsiya qilinadi. Bu tokensiz ham to'liq oqimni sinash imkonini beradi.
 */
export const telegramMockMode = !env.telegram.token;

/** Google tugmasi faqat client id/secret to'ldirilganda ko'rsatiladi. */
export const googleOAuthEnabled = Boolean(
  env.google.clientId && env.google.clientSecret,
);
