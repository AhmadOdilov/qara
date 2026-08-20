"use client";

/** `qara_csrf` cookie'sini o'qiydi (httpOnly emas — ataylab). */
function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)qara_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

/**
 * API chaqiruvi: JSON, CSRF sarlavhasi va bir xil xato shakli.
 * Har bir komponentda fetch mantiqi takrorlanmasin.
 */
export async function api<T>(
  url: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<ApiResult<T>> {
  const { json, headers, ...rest } = init;
  const method = rest.method ?? (json ? "POST" : "GET");

  try {
    const response = await fetch(url, {
      ...rest,
      method,
      headers: {
        ...(json ? { "content-type": "application/json" } : {}),
        ...(method !== "GET" && method !== "HEAD"
          ? { "x-csrf-token": csrfToken() }
          : {}),
        ...headers,
      },
      ...(json ? { body: JSON.stringify(json) } : {}),
    });

    const payload = (await response.json().catch(() => ({}))) as
      | (T & { error?: string; details?: { message: string }[] })
      | undefined;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error:
          payload?.details?.[0]?.message ??
          payload?.error ??
          `HTTP ${response.status}`,
      };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, status: 0, error: "network" };
  }
}

/*
  Sana formatlash.

  O'zbekcha `Intl` orqali berilmaydi: brauzerlarning ICU ma'lumotlari uz
  uchun to'liq emas (Chromium'da `month: "long"` «M08» qaytaradi). Shuning
  uchun uz oy nomlari qo'lda beriladi — natija hamma joyda bir xil.
  ru va en uchun `Intl` yetarli.
*/
const UZ_MONTHS_LONG = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

const UZ_MONTHS_SHORT = [
  "yan", "fev", "mar", "apr", "may", "iyn",
  "iyl", "avg", "sen", "okt", "noy", "dek",
];

/** Xabar vaqtini foydalanuvchi tiliga mos qisqa formatda ko'rsatadi. */
export function formatTime(value: string | Date, locale: string): string {
  return new Date(value).toLocaleTimeString(localeTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** «12 avg 2026» */
export function formatDate(value: string | Date, locale: string): string {
  const date = new Date(value);
  if (locale === "uz") {
    return `${date.getDate()} ${UZ_MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
  }
  return date.toLocaleDateString(localeTag(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Chatdagi kun ajratgichi: «12-avgust» */
export function formatDayLabel(value: string | Date, locale: string): string {
  const date = new Date(value);
  if (locale === "uz") {
    return `${date.getDate()}-${UZ_MONTHS_LONG[date.getMonth()]}`;
  }
  return date.toLocaleDateString(localeTag(locale), {
    day: "numeric",
    month: "long",
  });
}

/** Grafik o'qi uchun eng ixcham shakl: «12 avg» */
export function formatAxisDay(value: string | Date, locale: string): string {
  const date = new Date(value);
  if (locale === "uz") {
    return `${date.getDate()} ${UZ_MONTHS_SHORT[date.getMonth()]}`;
  }
  return date.toLocaleDateString(localeTag(locale), {
    day: "numeric",
    month: "short",
  });
}

function localeTag(lang: string): string {
  return lang === "ru" ? "ru-RU" : "en-US";
}
