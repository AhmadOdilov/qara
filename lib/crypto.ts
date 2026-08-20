import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/lib/env";

/*
  Sirlarni saqlash: AES-256-GCM.

  Kalit `SECRETS_KEY` muhit o'zgaruvchisidan olinadi (yo'q bo'lsa AUTH_SECRET'dan
  hosil qilinadi). Shifrlangan qiymat quyidagi shaklda saqlanadi:

      v1.<iv-base64url>.<authTag-base64url>.<ciphertext-base64url>

  Versiya prefiksi kelajakda kalitni almashtirish (rotation) uchun: eski
  yozuvlarni v1 bilan o'qib, yangisini v2 bilan yozish mumkin bo'ladi.

  Bu qatlamdan tashqariga ochiq matn sir CHIQMAYDI: API javoblarida faqat
  maskalangan ko'rinish (`maskSecret`) yoki `hasValue` bayrog'i qaytariladi.
*/

const VERSION = "v1";

function key(): Buffer {
  const raw = process.env.SECRETS_KEY?.trim();
  if (raw) {
    // 32 baytlik base64 kalit afzal; boshqa uzunlikda SHA-256 bilan siqamiz.
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
    return createHash("sha256").update(raw).digest();
  }
  // Alohida kalit berilmagan bo'lsa AUTH_SECRET'dan olinadi — dev uchun qulay,
  // lekin prodda SECRETS_KEY ni alohida belgilash tavsiya etiladi.
  return createHash("sha256").update(`qara-secrets:${env.authSecret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(stored: string): string {
  const [version, ivPart, tagPart, dataPart] = stored.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !dataPart) {
    throw new Error("Shifrlangan qiymat formati noto'g'ri");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Xato bo'lsa `null` — chaqiruvchi kodni try/catch bilan to'ldirmaslik uchun. */
export function tryDecryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    return decryptSecret(stored);
  } catch (error) {
    console.error("[crypto] sirni ochib bo'lmadi (kalit almashganmi?)", error);
    return null;
  }
}

/**
 * UI'da ko'rsatish uchun: `123456789:AAH…xYz` → `1234•••••xYz`.
 * Hech qachon to'liq qiymat qaytarilmaydi.
 */
export function maskSecret(plain: string): string {
  if (plain.length <= 8) return "•".repeat(plain.length);
  return `${plain.slice(0, 4)}${"•".repeat(6)}${plain.slice(-4)}`;
}

/** Webhook secret'ini har bir bot uchun alohida generatsiya qilamiz. */
export function newWebhookSecret(): string {
  // Telegram secret_token uchun ruxsat etilgan belgilar: A-Z a-z 0-9 _ -
  return randomBytes(24).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Loglar va xato xabarlariga sir tushib qolmasligi uchun oxirgi to'siq.
 * Telegram tokeni, `sk-…`, `Bearer …` kabi naqshlarni almashtiradi.
 */
const SECRET_PATTERNS: RegExp[] = [
  /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/g, // Telegram bot token
  /\bsk-[A-Za-z0-9_-]{16,}\b/g, // OpenAI-uslubidagi kalit
  /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g, // Anthropic
  /\btvly-[A-Za-z0-9_-]{16,}\b/g, // Tavily
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi,
];

export function redactSecrets(input: string): string {
  let output = input;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, "[REDACTED]");
  }
  return output;
}
