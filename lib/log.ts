import "server-only";
import { redactSecrets } from "@/lib/crypto";

/**
 * Structured logging (§P6 PHASE 12).
 *
 * Produksiyada JSON, ishlab chiqishda o'qishga qulay matn. Har bir yozuv
 * `redactSecrets()` dan o'tadi — token yoki kalit tasodifan kirib qolsa
 * ham logga ochiq tushmaydi.
 *
 * Ataylab MINIMAL: tashqi kutubxona qo'shilmadi. Loyihada allaqachon
 * `console.*` ishlatiladi va u konteyner stdout'iga chiqadi; bu modul
 * shunchaki shaklni bir xil qiladi va redaksiyani majburlaydi.
 *
 * DIQQAT: bu yerga parol, sessiya tokeni, `Authorization` sarlavhasi yoki
 * cookie'ni UZATMANG. Redaksiya — oxirgi to'siq, birinchi emas.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Loglanmasligi KERAK bo'lgan maydon nomlari. */
const FORBIDDEN = new Set([
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "webhooksecret",
  "authsecret",
  "secretskey",
  "databaseurl",
]);

export type LogFields = Record<string, unknown>;

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
  const safe: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    // Nomi shubhali maydon umuman yozilmaydi — qiymatiga qaramaymiz.
    if (FORBIDDEN.has(key.toLowerCase().replace(/[-_\s]/g, ""))) {
      safe[key] = "[REDACTED]";
      continue;
    }
    safe[key] = value;
  }

  const record = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...safe,
  };

  const line =
    process.env.NODE_ENV === "production"
      ? redactSecrets(JSON.stringify(record))
      : redactSecrets(`[${level}] ${message} ${Object.keys(safe).length ? JSON.stringify(safe) : ""}`);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (message: string, fields?: LogFields) => {
    if (process.env.NODE_ENV !== "production") emit("debug", message, fields);
  },
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};
