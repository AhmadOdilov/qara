import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getCurrentUser, verifyCsrf, type SessionUser } from "@/lib/auth";
import {
  resolveClientIp,
  trustConfigFromEnv,
  UNTRUSTED_KEY,
  type ResolvedIp,
} from "@/lib/client-ip";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ error: message, details: extra }, { status });
}

/**
 * Oddiy jarayon-ichi rate limiter (sliding window).
 * Bitta Node jarayoni uchun yetarli; bir nechta instansda ishlaganda
 * Redis'ga (masalan @upstash/ratelimit) ko'chirish kerak — README'ga qarang.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
    buckets.set(key, hits);
    return { allowed: false, retryAfter };
  }
  hits.push(now);
  buckets.set(key, hits);
  // Xotira o'smasligi uchun vaqti-vaqti bilan bo'sh kalitlarni tozalaymiz.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return { allowed: true, retryAfter: 0 };
}

/*
  Ishonchli proksi konfiguratsiyasi bir marta o'qiladi. Sozlanmagan bo'lsa
  prodda ogohlantirish chiqadi: jimgina «hamma bitta chelakda» holatiga
  tushib qolish eng yomon variant, chunki uni hech kim sezmaydi.
*/
const trustConfig = trustConfigFromEnv(process.env);
let warned = false;

function warnOnce(): void {
  if (warned || process.env.NODE_ENV !== "production") return;
  warned = true;
  console.warn(
    "[security] TRUSTED_PROXY_HOPS ham, TRUSTED_PROXY_HEADER ham " +
      "sozlanmagan. X-Forwarded-For ga ishonilmaydi va rate limit hamma " +
      "so'rov uchun UMUMIY bo'ladi. .env.example ga qarang.",
  );
}

/**
 * So'rovning klient manzili haqidagi to'liq ma'lumot.
 * Audit yozuvi manbani ham ko'rsatishi uchun ochiq eksport qilinadi.
 */
export function resolveIp(request: Request): ResolvedIp {
  const resolved = resolveClientIp(request.headers, trustConfig);
  if (resolved.source === "untrusted") warnOnce();
  return resolved;
}

/**
 * Rate limit kaliti va audit yozuvi uchun barqaror qiymat.
 *
 * DIQQAT: bu klient yuborgan sarlavhaning o'zi EMAS. Ishonchli manba
 * topilmasa `"untrusted"` qaytadi va hamma so'rov bitta chelakka tushadi —
 * ya'ni sarlavha almashtirib cheklovni chetlab o'tib bo'lmaydi.
 */
/**
 * Chelakni O'STIRMASDAN tekshiradi.
 *
 * `rateLimit()` har chaqiruvda urinishni yozadi. Muvaffaqiyatsiz kirishni
 * sanashda esa avval tekshirib, keyin faqat XATO bo'lganda yozish kerak —
 * aks holda to'g'ri parol kiritgan odam ham hisobini qulflab qo'yardi.
 */
export function rateLimitExceeded(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  buckets.set(key, hits);
  return hits.length >= limit;
}

/** Muvaffaqiyatsiz urinishni yozadi. */
export function recordFailure(key: string, windowMs: number): void {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
}

export function clientIp(request: Request): string {
  return resolveIp(request).key;
}

/** Ishonchli manba yo'qligini bilish kerak bo'lgan joylar uchun. */
export function isTrustedIp(request: Request): boolean {
  return resolveIp(request).key !== UNTRUSTED_KEY;
}

/** So'rov tanasini zod sxemasi bilan tekshiradi. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ data: T } | { response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { response: fail("JSON tanasi noto'g'ri", 400) };
  }
  try {
    return { data: schema.parse(raw) };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        response: fail(
          "Kiritilgan ma'lumot noto'g'ri",
          422,
          error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        ),
      };
    }
    throw error;
  }
}

/**
 * Himoyalangan API uchun: sessiya + (o'zgartiruvchi so'rovlarda) CSRF tekshiruvi.
 * Muvaffaqiyatda foydalanuvchini, aks holda tayyor javobni qaytaradi.
 */
export async function guard(
  request: Request,
  opts: { admin?: boolean; csrf?: boolean } = {},
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { response: fail("Avtorizatsiya talab qilinadi", 401) };
  if (opts.admin && user.role !== "admin") {
    return { response: fail("Ruxsat yo'q", 403) };
  }
  const mutating = request.method !== "GET" && request.method !== "HEAD";
  if (opts.csrf !== false && mutating && !(await verifyCsrf(request))) {
    return { response: fail("CSRF tokeni noto'g'ri", 403) };
  }
  return { user };
}

/**
 * Chat matnini normallashtirish: ko'rinmas boshqaruv belgilari olib tashlanadi
 * va matn qirqiladi. HTML escape qilinmaydi va shart emas — matn React orqali
 * matn tugun sifatida chiqariladi (dangerouslySetInnerHTML ishlatilmaydi),
 * Telegram'ga esa parse_mode'siz, ya'ni oddiy matn sifatida yuboriladi.
 */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeText(input: string): string {
  return input.replace(CONTROL_CHARS, "").trim();
}
