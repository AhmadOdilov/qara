import "server-only";
import { prisma } from "@/lib/db";
import { redactSecrets } from "@/lib/crypto";
import { assertPublicHost, assertSafeUrl, SsrfError } from "@/lib/mini-app/ssrf";

/**
 * Mini App'dan tashqi API'ga so'rov.
 *
 * XAVFSIZLIK QOIDALARI (hammasi majburiy):
 *
 *  1. Manzilni KLIENT BERMAYDI — u `MiniAppEndpoint` yozuvidan olinadi.
 *     Klient faqat endpoint id'sini va forma qiymatlarini yuboradi.
 *  2. Har so'rovdan oldin SSRF tekshiruvi: tuzilma + DNS (`ssrf.ts`).
 *  3. Qayta yo'naltirish YO'Q (`redirect: "manual"`) — aks holda tashqi
 *     server bizni ichki manzilga burib yuborardi.
 *  4. Timeout majburiy — osilgan so'rov server resursini ushlab turmasin.
 *  5. Javob hajmi cheklangan va faqat JSON o'qiladi.
 *  6. Sarlavhalar (API kalitlari) serverda qoladi, javobga tushmaydi.
 *
 * Ixtiyoriy KOD BAJARILMAYDI: shablon faqat `{{maydon}}` o'rniga qiymat
 * qo'yadi, hech qanday ifoda hisoblanmaydi.
 */

/** Javob hajmi chegarasi — katta fayl serverni to'ldirmasin. */
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_TIMEOUT_MS = 15_000;

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export type ActionOutcome =
  | { ok: true; status: number; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

/**
 * Endpointni bajaradi.
 *
 * Xato bo'lganda ham foydalanuvchiga TUSHUNARLI matn qaytadi — tashqi
 * xizmatning texnik javobi yoki ichki manzillar oshkor qilinmaydi.
 */
export async function runEndpoint(input: {
  miniAppId: string;
  endpointId: string;
  values: Record<string, string>;
  allowlist: string[];
}): Promise<ActionOutcome> {
  const endpoint = await prisma.miniAppEndpoint.findFirst({
    where: { id: input.endpointId, miniAppId: input.miniAppId },
  });
  if (!endpoint) return { ok: false, status: 404, error: "Bu amal topilmadi" };

  const values = sanitizeValues(input.values);

  /* 1. Manzil — shablon bilan to'ldiriladi va tekshiriladi */
  let url: URL;
  try {
    url = assertSafeUrl(fillTemplate(endpoint.url, values), input.allowlist);
  } catch (error) {
    if (error instanceof SsrfError) {
      return { ok: false, status: 400, error: `Manzil qabul qilinmadi: ${error.message}` };
    }
    throw error;
  }

  /* 2. DNS — domen ichki IP'ga yechilmasin */
  try {
    await assertPublicHost(url.hostname);
  } catch (error) {
    if (error instanceof SsrfError) {
      return { ok: false, status: 400, error: `Manzil qabul qilinmadi: ${error.message}` };
    }
    throw error;
  }

  /* 3. So'rovni yig'ish */
  const method = normalizeMethod(endpoint.method);
  const headers = new Headers({ accept: "application/json" });
  for (const [key, value] of Object.entries(readHeaders(endpoint.headers))) {
    headers.set(key, fillTemplate(value, values));
  }

  let body: string | undefined;
  if (method !== "GET" && endpoint.bodyTemplate) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(fillDeep(endpoint.bodyTemplate, values));
  }
  if (method === "GET" && endpoint.bodyTemplate) {
    // GET uchun tana bo'lmaydi — shablon query parametrlariga aylanadi.
    for (const [key, value] of Object.entries(
      fillDeep(endpoint.bodyTemplate, values) as Record<string, unknown>,
    )) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }

  const timeout = Math.min(Math.max(endpoint.timeoutMs, 1000), MAX_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      // Qayta yo'naltirish ichki manzilga olib borishi mumkin — o'zimiz hal qilamiz.
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      return {
        ok: false,
        status: 502,
        error: "Tashqi xizmat qayta yo'naltirdi — bu qabul qilinmaydi",
      };
    }

    const data = await readJson(response);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `Tashqi xizmat xato qaytardi (${response.status})`,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: mapResponse(data, endpoint.responseMap),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, status: 504, error: "Tashqi xizmat javob bermadi" };
    }
    // Tarmoq xatosi matnida ichki manzil bo'lishi mumkin — tozalaymiz.
    console.error("[mini-app-api]", redactSecrets(String(error)));
    return { ok: false, status: 502, error: "Tashqi xizmatga ulanib bo'lmadi" };
  } finally {
    clearTimeout(timer);
  }
}

/* ── Shablon ─────────────────────────────────────────────────────────────── */

/**
 * `{{maydon}}` o'rniga qiymat qo'yadi.
 *
 * Ataylab juda sodda: hech qanday ifoda, funksiya yoki ichma-ich yo'l yo'q.
 * Noma'lum maydon bo'sh satrga aylanadi — shablon tufayli so'rov «yarim
 * to'ldirilgan» manzilga ketmaydi.
 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_, key: string) =>
    values[key] ?? "",
  );
}

/** Obyekt va massiv ichidagi barcha satrlarda shablonni to'ldiradi. */
function fillDeep(value: unknown, values: Record<string, string>): unknown {
  if (typeof value === "string") return fillTemplate(value, values);
  if (Array.isArray(value)) return value.map((item) => fillDeep(item, values));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        fillDeep(item, values),
      ]),
    );
  }
  return value;
}

/** Forma qiymatlari — uzunlik va tur cheklanadi. */
function sanitizeValues(values: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) continue;
    if (typeof value !== "string") continue;
    clean[key] = value.slice(0, 500);
  }
  return clean;
}

/* ── Javob ───────────────────────────────────────────────────────────────── */

async function readJson(response: Response): Promise<unknown> {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("json")) return null;

  const text = await readCapped(response);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Javobni chegara bilan o'qiydi — cheksiz oqim serverni to'ldirmasin. */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let out = "";
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      break;
    }
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

/**
 * Javobdan kerakli maydonlarni ajratadi.
 *
 * Xarita berilmagan bo'lsa butun javob qaytadi (chegara bilan). Xarita
 * berilsa — faqat ko'rsatilgan yo'llar, ya'ni ortiqcha ma'lumot Mini App'ga
 * tushmaydi.
 */
function mapResponse(data: unknown, map: unknown): Record<string, unknown> {
  const rules = (map ?? {}) as Record<string, unknown>;
  const keys = Object.keys(rules);

  if (keys.length === 0) {
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return { data };
  }

  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const path = rules[key];
    if (typeof path !== "string") continue;
    out[key] = readPath(data, path);
  }
  return out;
}

/** `data.items.0.title` kabi yo'l bo'yicha qiymat oladi. */
function readPath(value: unknown, path: string): unknown {
  let current = value;
  for (const part of path.split(".")) {
    if (current === null || current === undefined) return null;
    if (Array.isArray(current)) {
      const index = Number(part);
      current = Number.isInteger(index) ? current[index] : undefined;
      continue;
    }
    if (typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current ?? null;
}

/* ── Yordamchilar ────────────────────────────────────────────────────────── */

export function normalizeMethod(value: string): HttpMethod {
  const upper = value.toUpperCase() as HttpMethod;
  return (HTTP_METHODS as readonly string[]).includes(upper) ? upper : "GET";
}

function readHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    // Hop-by-hop va xavfli sarlavhalar o'tkazilmaydi.
    if (!/^[A-Za-z0-9-]{1,64}$/.test(key)) continue;
    if (FORBIDDEN_HEADERS.has(key.toLowerCase())) continue;
    if (typeof item === "string") out[key] = item.slice(0, 1024);
  }
  return out;
}

/** Bularni egasi o'zi belgilay olmaydi — ular so'rov mantig'ini buzadi. */
const FORBIDDEN_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
  "upgrade",
  "proxy-authorization",
  "cookie",
]);

/** UI uchun xavfsiz ko'rinish: qiymat emas, faqat kalit nomlari. */
export function describeHeaders(value: unknown): string[] {
  return Object.keys(readHeaders(value));
}
