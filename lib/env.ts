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

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  appUrl: optional("APP_URL", "http://localhost:3000").replace(/\/$/, ""),
  authSecret: required("AUTH_SECRET"),

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
