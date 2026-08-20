import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Mini App autentifikatsiyasi — `Telegram.WebApp.initData` ni tekshirish.
 *
 * QOIDA: `initDataUnsafe` HECH QACHON autentifikatsiya manbai emas. Klient
 * uni istalgancha o'zgartira oladi. Ishonch faqat shu moduldan chiqadi:
 * imzo bot tokeni bilan qayta hisoblanadi va faqat mos kelsa foydalanuvchi
 * tanilgan hisoblanadi.
 *
 * Telegram sxemasi (Bot API, Web Apps → Validating data):
 *
 *   data_check_string = "k=v" juftliklari, `hash` dan tashqari, kalit bo'yicha
 *                       tartiblanib "\n" bilan ulanadi
 *   secret_key        = HMAC_SHA256(key="WebAppData", message=<bot_token>)
 *   computed          = HMAC_SHA256(key=secret_key, message=data_check_string)
 *
 * `computed === hash` bo'lsa ma'lumot Telegram'dan kelgan va buzilmagan.
 *
 * Bot tokeni bu qatlamdan tashqariga chiqmaydi va hech qachon klientga
 * yuborilmaydi — chaqiruvchi uni `readSecret()` orqali serverda oladi.
 */

/** Imzo to'g'ri, lekin ma'lumot eskirgan bo'lishi mumkin — sabab ajratiladi. */
export type InitDataFailure =
  | "missing"
  | "malformed"
  | "bad_signature"
  | "expired"
  | "no_user";

export class InitDataError extends Error {
  constructor(readonly reason: InitDataFailure) {
    super(`initData tekshiruvdan o'tmadi: ${reason}`);
    this.name = "InitDataError";
  }
}

/** `initData` ichidagi Telegram foydalanuvchisi. */
export type TelegramWebAppUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  languageCode: string | null;
  photoUrl: string | null;
  isPremium: boolean;
};

export type VerifiedInitData = {
  user: TelegramWebAppUser;
  /// `chat_instance` / `start_param` kabi qo'shimchalar
  startParam: string | null;
  authDate: Date;
  queryId: string | null;
};

/**
 * `auth_date` qancha vaqt yaroqli.
 *
 * Telegram muddat belgilamaydi — bu bizning qarorimiz. 24 soat: Mini App
 * uzoq ochiq turishi mumkin (foydalanuvchi ilovani fonda qoldiradi), lekin
 * o'g'irlangan `initData` cheksiz ishlab turmasligi kerak.
 */
export const INIT_DATA_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * `initData` ni tekshiradi va foydalanuvchini qaytaradi.
 *
 * Xato bo'lsa `InitDataError` tashlaydi — chaqiruvchi so'rovni rad etadi.
 * Hech qanday holatda «tekshirib bo'lmadi, lekin davom etamiz» yo'li yo'q.
 */
export function verifyInitData(
  botToken: string,
  initData: string,
  now: Date = new Date(),
): VerifiedInitData {
  if (!initData.trim()) throw new InitDataError("missing");

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    throw new InitDataError("malformed");
  }

  const hash = params.get("hash");
  if (!hash) throw new InitDataError("malformed");

  // `hash` dan tashqari hamma juftlik, kalit bo'yicha tartiblangan holda.
  const checkString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(checkString).digest("hex");

  if (!safeEqualHex(computed, hash)) throw new InitDataError("bad_signature");

  // Imzo to'g'ri — endi yangiligini tekshiramiz.
  const authDateRaw = Number(params.get("auth_date"));
  if (!Number.isFinite(authDateRaw) || authDateRaw <= 0) {
    throw new InitDataError("malformed");
  }
  const authDate = new Date(authDateRaw * 1000);
  if (now.getTime() - authDate.getTime() > INIT_DATA_TTL_MS) {
    throw new InitDataError("expired");
  }

  const user = parseUser(params.get("user"));
  if (!user) throw new InitDataError("no_user");

  return {
    user,
    startParam: params.get("start_param"),
    authDate,
    queryId: params.get("query_id"),
  };
}

function parseUser(raw: string | null): TelegramWebAppUser | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const value = parsed as Record<string, unknown>;
  // Telegram `id` ni son sifatida beradi; bazada satr bo'lib saqlanadi
  // (`TelegramBotUser.telegramUserId`), shuning uchun shu yerda o'giramiz.
  const id = value.id;
  if (typeof id !== "number" || !Number.isFinite(id)) return null;

  return {
    id: String(id),
    firstName: str(value.first_name),
    lastName: str(value.last_name),
    username: str(value.username),
    languageCode: str(value.language_code),
    photoUrl: str(value.photo_url),
    isPremium: value.is_premium === true,
  };
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Uzunlik ham, mazmun ham — vaqt bo'yicha sizib chiqmasin. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
