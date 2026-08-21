/**
 * Klient IP manzilini ISHONCHLI aniqlash.
 *
 * Muammo. `X-Forwarded-For` — oddiy sarlavha, uni istalgan klient o'zi
 * to'ldirib yuborishi mumkin. Uning eng CHAP qiymatini olish (avvalgi
 * yechim) rate limit'ni bir qatorda ochib yuboradi: har so'rovda boshqa
 * qiymat yuborilsa har safar yangi «foydalanuvchi» hisoblanadi.
 *
 * Yechim. Zanjirning qaysi qismi ISHONCHLI ekanini konfiguratsiya aytadi:
 *
 *   TRUSTED_PROXY_HEADER — platforma o'zi yozadigan sarlavha nomi
 *     (`cf-connecting-ip`, `x-vercel-forwarded-for`, `fly-client-ip`,
 *     `true-client-ip`). Bunday sarlavhani chekka (edge) har doim QAYTA
 *     yozadi, shuning uchun klient unga ta'sir qila olmaydi.
 *
 *   TRUSTED_PROXY_HOPS — oldimizda nechta O'ZIMIZNING teskari proksi bor.
 *     Har bir proksi zanjirga O'ZI KO'RGAN manzilni QO'SHADI, ya'ni
 *     ishonchli yozuvlar har doim zanjirning O'NG tomonida bo'ladi.
 *     Klient yozgan soxta qiymatlar esa chapda qoladi va o'nggacha
 *     surila olmaydi.
 *
 * Hech biri sozlanmagan bo'lsa `X-Forwarded-For` ga UMUMAN ishonilmaydi:
 * bunday holatda hamma so'rov bitta umumiy chelakka tushadi. Bu noqulay,
 * lekin xavfsiz — rate limit ochiq qolgandan ko'ra yaxshiroq.
 *
 * Node/Next route handler'ida soket manzili berilmaydi (Next hujjatlarida
 * bunday API yo'q), shuning uchun sarlavhadan boshqa manba yo'q va
 * konfiguratsiya majburiy.
 */

export type IpSource =
  /** Platforma yozgan sarlavha — klient ta'sir qila olmaydi. */
  | "platform-header"
  /** `X-Forwarded-For` / `Forwarded` zanjirining ishonchli qismi. */
  | "forwarded-chain"
  /** Faqat development: sarlavhaga ishonildi, chunki lokal muhit. */
  | "dev-fallback"
  /** Ishonchli manba yo'q — umumiy chelak. */
  | "untrusted";

export type ResolvedIp = {
  /** Rate limit kaliti sifatida ishlatiladigan barqaror qiymat. */
  key: string;
  /** Topilgan manzil (normallashtirilgan) yoki `null`. */
  ip: string | null;
  source: IpSource;
};

export type TrustConfig = {
  /** Faqat shu sarlavhaga ishonamiz (kichik harflarda). */
  header: string | null;
  /** Oldimizdagi ishonchli proksilar soni. */
  hops: number;
  /** Development muhitida sarlavhaga ishonishga ruxsat. */
  allowDevFallback: boolean;
};

/** Ishonchli manba topilmaganda hamma so'rov shu kalitga tushadi. */
export const UNTRUSTED_KEY = "untrusted";

/**
 * Platforma sarlavhalari. Faqat ro'yxatdagilar qabul qilinadi — noto'g'ri
 * yozilgan nom jimgina «hech qanday himoya yo'q» holatiga olib bormasin.
 */
export const KNOWN_PLATFORM_HEADERS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-vercel-forwarded-for",
  "fly-client-ip",
  "x-real-ip",
] as const;

export function resolveClientIp(headers: Headers, config: TrustConfig): ResolvedIp {
  // 1. Platforma sarlavhasi — eng ishonchli manba.
  if (config.header) {
    const raw = headers.get(config.header);
    const ip = raw ? normalizeIp(firstEntry(raw)) : null;
    if (ip) return { key: bucketKey(ip), ip, source: "platform-header" };
    // Sarlavha kutilgan-u kelmagan bo'lsa — zanjirga o'tmaymiz, chunki
    // bu konfiguratsiya xatosi va XFF'ga ishonish uni yashirib qo'yardi.
    return { key: UNTRUSTED_KEY, ip: null, source: "untrusted" };
  }

  // 2. Ishonchli proksi zanjiri.
  if (config.hops > 0) {
    const chain = forwardedChain(headers);
    // Zanjirdagi o'ngdan `hops`-inchi yozuv — eng chekkadagi ishonchli
    // proksi KO'RGAN manzil. Zanjir kalta bo'lsa so'rov kutilgan yo'ldan
    // kelmagan: soxta deb hisoblaymiz.
    if (chain.length >= config.hops) {
      const ip = chain[chain.length - config.hops];
      if (ip) return { key: bucketKey(ip), ip, source: "forwarded-chain" };
    }
    return { key: UNTRUSTED_KEY, ip: null, source: "untrusted" };
  }

  // 3. Development qulayligi — prodda hech qachon ishlamaydi.
  if (config.allowDevFallback) {
    const chain = forwardedChain(headers);
    const ip = chain[0] ?? null;
    if (ip) return { key: bucketKey(ip), ip, source: "dev-fallback" };
    return { key: "local", ip: null, source: "dev-fallback" };
  }

  return { key: UNTRUSTED_KEY, ip: null, source: "untrusted" };
}

/**
 * Proksi zanjirini o'qiydi. Tartib saqlanadi: chapda klient, o'ngda bizga
 * eng yaqin proksi.
 *
 * FAQAT BITTA sarlavha o'qiladi — ikkalasi HECH QACHON birlashtirilmaydi.
 *
 * Sababi xavfsizlik. `X-Forwarded-For` va RFC 7239 `Forwarded` — bir
 * zanjirning ikki xil yozuvi (RFC 7239 XFF o'rnini bosish uchun yozilgan),
 * ya'ni to'g'ri sozlangan topologiya ularning BIRINI ishlatadi. Ilgari
 * ikkalasi ketma-ket qo'shilardi va bu zaiflik edi: `hops` o'ngdan
 * sanaydi, bizning proksi (Caddy) esa faqat `X-Forwarded-For` yozadi —
 * demak klient yuborgan `Forwarded: for=...` zanjirning ISHONCHLI o'ng
 * uchiga tushib, aniqlangan IP'ni to'liq boshqarib ketardi. Natijada
 * rate limit chelagi har so'rovda almashib, cheklov chetlab o'tilardi.
 *
 * Shuning uchun: proksi yozgan `X-Forwarded-For` bo'lsa — faqat o'sha
 * o'qiladi va klientning `Forwarded` sarlavhasi butunlay e'tiborsiz
 * qoladi. `X-Forwarded-For` umuman bo'lmaganda esa `Forwarded` yozadigan
 * proksi ortida ishlash imkoni saqlanadi.
 */
export function forwardedChain(headers: Headers): string[] {
  const parts = xffEntries(headers) ?? forwardedEntries(headers) ?? [];

  return parts
    .map((part) => normalizeIp(part))
    .filter((value): value is string => value !== null);
}

/** `X-Forwarded-For: 1.1.1.1, 2.2.2.2` — sarlavha yo'q bo'lsa `null`. */
function xffEntries(headers: Headers): string[] | null {
  const xff = headers.get("x-forwarded-for");
  return xff ? xff.split(",") : null;
}

/** `Forwarded: for=1.2.3.4;proto=https, for="[2001:db8::1]:443"` */
function forwardedEntries(headers: Headers): string[] | null {
  const forwarded = headers.get("forwarded");
  if (!forwarded) return null;

  const parts: string[] = [];
  for (const element of forwarded.split(",")) {
    for (const pair of element.split(";")) {
      const [name, ...rest] = pair.split("=");
      if (name.trim().toLowerCase() !== "for") continue;
      parts.push(rest.join("=").trim().replace(/^"|"$/g, ""));
    }
  }
  return parts;
}

/**
 * Manzilni bitta shaklga keltiradi:
 *   · port olib tashlanadi (`1.2.3.4:5678`, `[::1]:443`),
 *   · kvadrat qavslar olinadi,
 *   · IPv4-mapped IPv6 (`::ffff:1.2.3.4`) IPv4'ga qaytariladi,
 *   · noto'g'ri qiymat (`unknown`, `_hidden`, bo'sh) rad etiladi.
 */
export function normalizeIp(value: string): string | null {
  let text = value.trim().toLowerCase();
  if (!text) return null;

  // `[2001:db8::1]:443` yoki `[2001:db8::1]`
  const bracketed = text.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) {
    text = bracketed[1];
  } else if (text.includes(":")) {
    // Bitta ikki nuqta bo'lsa — bu IPv4 va port. Ko'p bo'lsa — IPv6.
    const colons = text.split(":").length - 1;
    if (colons === 1) text = text.split(":")[0];
  }

  const mapped = text.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) text = mapped[1];

  if (isIpv4(text)) return text;
  if (isIpv6(text)) return text;
  return null;
}

/**
 * Chelak kaliti.
 *
 * IPv6'da bitta abonentga odatda butun /64 blok beriladi, ya'ni to'liq
 * manzil bo'yicha cheklash bir soniyada chetlab o'tiladi. Shuning uchun
 * IPv6 uchun kalit /64 prefiksdan olinadi.
 */
export function bucketKey(ip: string): string {
  if (isIpv4(ip)) return ip;
  const groups = expandIpv6(ip);
  return groups ? `${groups.slice(0, 4).join(":")}::/64` : ip;
}

function firstEntry(value: string): string {
  return value.split(",")[0] ?? "";
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

function isIpv6(value: string): boolean {
  return expandIpv6(value) !== null;
}

/** `2001:db8::1` → sakkizta guruh. Noto'g'ri bo'lsa `null`. */
function expandIpv6(value: string): string[] | null {
  if (!value.includes(":")) return null;
  if ((value.match(/::/g) ?? []).length > 1) return null;

  const [head, tail] = value.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail !== undefined && tail ? tail.split(":") : [];

  const groups = value.includes("::")
    ? [
        ...headGroups,
        ...Array<string>(8 - headGroups.length - tailGroups.length).fill("0"),
        ...tailGroups,
      ]
    : headGroups;

  if (groups.length !== 8) return null;
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return null;

  return groups.map((group) => group.replace(/^0+(?=.)/, ""));
}

/** Muhit o'zgaruvchilaridan konfiguratsiya. */
export function trustConfigFromEnv(env: NodeJS.ProcessEnv): TrustConfig {
  const header = (env.TRUSTED_PROXY_HEADER ?? "").trim().toLowerCase();
  const hops = Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "", 10);

  return {
    header: (KNOWN_PLATFORM_HEADERS as readonly string[]).includes(header)
      ? header
      : null,
    hops: Number.isFinite(hops) && hops > 0 ? hops : 0,
    allowDevFallback: env.NODE_ENV !== "production",
  };
}
