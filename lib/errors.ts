import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Xatolarni odam tiliga o'girish (§10).
 *
 * Foydalanuvchi hech qachon `HTTP 500`, `ECONNREFUSED` yoki `network` degan
 * so'zni ko'rmaydi. Uning o'rniga uchta narsa beriladi:
 *   · nima bo'ldi   — sarlavha,
 *   · nega bo'ldi   — bir jumla,
 *   · nima qilaman  — aniq amal.
 *
 * Server allaqachon odamona yozilgan xabar qaytarsa (masalan «Token noto'g'ri.
 * @BotFather bergan tokenni to'liq nusxalang.») — u o'zgarishsiz ko'rsatiladi.
 * Faqat texnik qoldiqlar almashtiriladi.
 */

export type ErrorAction = "retry" | "token" | "signIn" | null;

export type FriendlyError = {
  title: string;
  body?: string;
  action: ErrorAction;
  /** Server bergan asl matn — «texnik tafsilot» ostida ochiladi. */
  raw?: string;
};

/** Odamga ko'rsatib bo'lmaydigan texnik shakllar. */
function isTechnical(raw: string): boolean {
  return (
    raw === "" ||
    raw === "network" ||
    /^HTTP \d+$/.test(raw) ||
    /^[A-Z_]{4,}$/.test(raw) ||
    /ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(raw) ||
    /^Internal Server Error$/i.test(raw) ||
    /^Bad Request$/i.test(raw) ||
    // «action=set yoki action=delete bo'lishi kerak» kabi ichki kontrakt xatolari
    /^action=/.test(raw)
  );
}

/** Token bilan bog'liq xatolar alohida amal taklif qiladi. */
function isTokenProblem(raw: string): boolean {
  return /token/i.test(raw) && !/csrf/i.test(raw);
}

export function humanizeError(
  raw: string,
  status: number,
  t: Dictionary,
): FriendlyError {
  const message = (raw ?? "").trim();

  // Tarmoq — `api()` shu sentinelni beradi, status 0 bo'ladi.
  if (message === "network" || status === 0) {
    return {
      title: t.errors.networkTitle,
      body: t.errors.networkBody,
      action: "retry",
    };
  }

  if (status === 401) {
    return { title: t.errors.authTitle, body: t.errors.authBody, action: "signIn" };
  }

  if (status === 429) {
    return { title: t.errors.rateTitle, body: t.errors.rateBody, action: "retry" };
  }

  if (status >= 500) {
    return {
      title: t.errors.serverTitle,
      body: t.errors.serverBody,
      action: "retry",
      raw: isTechnical(message) ? undefined : message,
    };
  }

  // Serverning o'z matni odamona bo'lsa — aynan shuni ko'rsatamiz. Backend
  // xabarlari allaqachon tekshirilgan va sir tutmaydi.
  if (!isTechnical(message)) {
    return {
      title: message,
      action: isTokenProblem(message) ? "token" : null,
    };
  }

  if (status === 403) {
    return { title: t.errors.forbiddenTitle, body: t.errors.forbiddenBody, action: null };
  }

  if (status === 404) {
    return { title: t.errors.missingTitle, body: t.errors.missingBody, action: null };
  }

  return {
    title: t.errors.serverTitle,
    body: t.errors.serverBody,
    action: "retry",
  };
}

/** `api()` natijasini to'g'ridan-to'g'ri o'giradi. */
export function friendly(
  result: { ok: false; error: string; status: number },
  t: Dictionary,
): FriendlyError {
  return humanizeError(result.error, result.status, t);
}
