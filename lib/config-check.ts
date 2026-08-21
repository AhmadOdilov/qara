/**
 * Produksiya sozlamalarini tekshirish (§P12 PHASE 1).
 *
 * Bu modul ATAYLAB toza: hech narsa import qilmaydi va hech qayerga
 * yozmaydi. Sababi ikkita:
 *
 *   1. `instrumentation.ts` Edge muhitida ham yuklanishi mumkin, ya'ni
 *      `server-only` ni import qiladigan modullarga (`lib/log.ts`) bog'lash
 *      mumkin emas.
 *   2. Sof funksiya sifatida uni test qilish oson — muhit obyekti kirish,
 *      muammolar ro'yxati chiqish. Ilgari mantiq `register()` ichida edi va
 *      hech qachon sinalmagan.
 *
 * MUHIM: bu yerda sir QIYMATI hech qachon o'qilmaydi va qaytarilmaydi —
 * faqat "bor/yo'q" va format tekshiriladi. Xabarlarga o'zgaruvchi NOMI
 * tushadi, qiymati emas.
 */

export type ConfigProblem = {
  /** `error` — server ko'tarilmaydi. `warn` — ishlaydi, lekin operator bilsin. */
  level: "error" | "warn";
  /** Muhit o'zgaruvchisi nomi. */
  name: string;
  /** Nima noto'g'ri va nima qilish kerak. Sir qiymati BO'LMAYDI. */
  message: string;
};

/** `TRUSTED_PROXY_HEADER` uchun qabul qilinadigan nomlar. */
const KNOWN_PLATFORM_HEADERS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-vercel-forwarded-for",
  "fly-client-ip",
  "x-real-ip",
];

/**
 * Produksiyada bo'lishi SHART bo'lganlar.
 *
 * `SECRETS_KEY` shu ro'yxatda — ilgari faqat ogohlantirish edi. U yo'q
 * bo'lsa shifrlash kaliti `AUTH_SECRET` dan hosil qilinadi, ya'ni
 * `AUTH_SECRET` almashtirilishi bilan saqlangan BARCHA bot tokenlari va
 * API kalitlari qaytarib bo'lmas darajada ochilmay qoladi. Kalit
 * aylantirish esa xavfsizlik hodisasidan keyin qilinadigan birinchi ish —
 * aynan o'shanda ma'lumot yo'qolishi mumkin emas.
 */
const REQUIRED = [
  {
    name: "AUTH_SECRET",
    why: "sessiya cookie'lari shu kalit bilan imzolanadi",
    how: "openssl rand -base64 32",
  },
  {
    name: "DATABASE_URL",
    why: "bazasiz ilova hech narsa qila olmaydi",
    how: "postgresql://user:parol@host:5432/qara?schema=public",
  },
  {
    name: "SECRETS_KEY",
    why:
      "bot tokenlari va API kalitlari shu kalit bilan shifrlanadi; " +
      "belgilanmasa u AUTH_SECRET'dan hosil qilinadi va AUTH_SECRET " +
      "almashsa saqlangan sirlar OCHILMAY qoladi",
    how: "yangi o'rnatish uchun: openssl rand -base64 32",
  },
] as const;

/**
 * Mavjud bazani saqlab qolish yo'li.
 *
 * Ilova ilgari SECRETS_KEY'siz ishlagan bo'lsa, amaldagi kalit
 * `sha256("qara-secrets:" + AUTH_SECRET)` edi. Yangi tasodifiy kalit
 * qo'yilsa eski yozuvlar ochilmaydi — shuning uchun xato xabari AYNAN
 * o'sha qiymatni qanday qayd etishni ko'rsatadi.
 */
export const SECRETS_KEY_MIGRATION_HINT =
  "Ilova ilgari SECRETS_KEY'siz ishlagan bo'lsa, MAVJUD shifrlangan " +
  "qiymatlarni saqlab qolish uchun tasodifiy kalit EMAS, amaldagi hosila " +
  "kalitni qo'ying:\n" +
  "      ./scripts/derive-secrets-key.sh\n" +
  "    (yoki: printf 'qara-secrets:%s' \"$AUTH_SECRET\" | openssl dgst -sha256 -binary | base64)";

/**
 * `APP_URL` — tashqi manzil. Webhook va OAuth callback shundan quriladi,
 * shuning uchun u to'liq absolyut manzil bo'lishi kerak.
 */
function checkAppUrl(raw: string | undefined, out: ConfigProblem[]): void {
  const value = raw?.trim() ?? "";

  if (!value) {
    out.push({
      level: "warn",
      name: "APP_URL",
      message:
        "belgilanmagan — webhook va OAuth callback manzillari noto'g'ri " +
        "bo'ladi. Tashqi HTTPS manzilni qo'ying.",
    });
    return;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    out.push({
      level: "error",
      name: "APP_URL",
      message:
        "to'liq manzil emas. Sxema bilan yozing: https://qara.uz " +
        "(oxirida / shart emas).",
    });
    return;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    out.push({
      level: "error",
      name: "APP_URL",
      message: `sxemasi "${url.protocol}" — faqat http yoki https bo'ladi.`,
    });
    return;
  }

  // Telegram HTTP webhook'ni qabul qilmaydi, OAuth callback ham HTTPS kutadi.
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    out.push({
      level: "warn",
      name: "APP_URL",
      message:
        "lokal manzilga ishora qilyapti — Telegram webhook'ni bunday " +
        "manzilga yubora olmaydi. Tashqi HTTPS manzilni qo'ying.",
    });
  } else if (url.protocol === "http:") {
    out.push({
      level: "warn",
      name: "APP_URL",
      message:
        "HTTPS emas. Telegram webhook faqat HTTPS manzilga yuboriladi.",
    });
  }
}

/**
 * `SITE_DOMAIN` — Caddy shu qiymat uchun sertifikat so'raydi. Ilova o'zi
 * uni o'qimaydi, lekin xato yozilgan domen ACME so'rovini yiqitadi va
 * Let's Encrypt limiti tez tugaydi. Shuning uchun formatni shu yerda
 * ushlaymiz: konteyner ko'tarilishidan oldin.
 *
 * Majburiy EMAS — Caddy'siz (o'z proksisi bilan) deploy ham to'g'ri.
 */
function checkSiteDomain(raw: string | undefined, out: ConfigProblem[]): void {
  const value = raw?.trim() ?? "";
  if (!value) return;

  if (/^[a-z]+:\/\//i.test(value) || value.includes("/")) {
    out.push({
      level: "error",
      name: "SITE_DOMAIN",
      message:
        "faqat domen bo'lishi kerak — sxemasiz va yo'lsiz. " +
        'To\'g\'ri: "qara.uz", noto\'g\'ri: "https://qara.uz/".',
    });
    return;
  }

  if (value.includes(":")) {
    out.push({
      level: "error",
      name: "SITE_DOMAIN",
      message: "portsiz yozilishi kerak — Caddy 80 va 443 ni o'zi oladi.",
    });
    return;
  }

  // Caddy `*.example.com` shaklini qo'llab-quvvatlaydi.
  const host = value.startsWith("*.") ? value.slice(2) : value;
  const label = "[a-z0-9](?:[a-z0-9-]*[a-z0-9])?";
  if (!new RegExp(`^${label}(?:\\.${label})+$`, "i").test(host)) {
    out.push({
      level: "error",
      name: "SITE_DOMAIN",
      message:
        "domen shakliga mos emas. Kamida bitta nuqta bo'lishi kerak " +
        '(masalan "qara.uz"); Let\'s Encrypt lokal nomlarga sertifikat bermaydi.',
    });
  }
}

/**
 * `TRUSTED_PROXY_HOPS` — rate limit shunga suyanadi.
 *
 * Ilgari noto'g'ri qiymat JIMGINA 0 ga aylanardi: `resolveClientIp` hech
 * kimga ishonmay hamma so'rovni bitta chelakka solardi. Ya'ni operator
 * `TRUSTED_PROXY_HOPS=one` deb yozsa, cheklov ishlayotgandek ko'rinardi-yu
 * aslida butun sayt bitta chelakda bo'lardi. Endi bu xato.
 */
function checkProxyHops(
  hopsRaw: string | undefined,
  headerRaw: string | undefined,
  out: ConfigProblem[],
): void {
  const hops = hopsRaw?.trim() ?? "";
  const header = headerRaw?.trim().toLowerCase() ?? "";

  if (header && !KNOWN_PLATFORM_HEADERS.includes(header)) {
    out.push({
      level: "error",
      name: "TRUSTED_PROXY_HEADER",
      message:
        "tanilmagan sarlavha nomi — u e'tiborsiz qoladi va rate limit " +
        `himoyasiz qolardi. Ruxsat etilganlar: ${KNOWN_PLATFORM_HEADERS.join(", ")}.`,
    });
    return;
  }

  if (header) return; // Platforma sarlavhasi berilgan — hops kerak emas.

  if (!hops) {
    out.push({
      level: "warn",
      name: "TRUSTED_PROXY_HOPS",
      message:
        "TRUSTED_PROXY_HEADER ham sozlanmagan — X-Forwarded-For ga " +
        "ishonilmaydi va rate limit hamma so'rov uchun UMUMIY bo'ladi. " +
        "Caddy orqasida TRUSTED_PROXY_HOPS=1 qo'ying.",
    });
    return;
  }

  if (!/^\d+$/.test(hops)) {
    out.push({
      level: "error",
      name: "TRUSTED_PROXY_HOPS",
      message:
        "butun son bo'lishi kerak (0, 1, 2 …). Noto'g'ri qiymat jimgina " +
        "0 ga aylanardi va rate limit hamma so'rovni bitta chelakka solardi.",
    });
    return;
  }

  if (Number(hops) === 0) {
    out.push({
      level: "warn",
      name: "TRUSTED_PROXY_HOPS",
      message:
        "0 — ilova to'g'ridan-to'g'ri ochilgan deb hisoblanadi. Caddy yoki " +
        "boshqa teskari proksi ortida bo'lsangiz 1 qo'ying, aks holda rate " +
        "limit hamma so'rov uchun umumiy bo'ladi.",
    });
  }
}

/**
 * O'qiladigan muhit. `process.env` shu shaklga mos keladi.
 *
 * ATAYLAB `NodeJS.ProcessEnv` emas: u loyihada `NODE_ENV` ni majburiy
 * qiladi, holbuki bu funksiya faqat nom→qiymat juftliklarini o'qiydi va
 * yo'q o'zgaruvchini o'zi to'g'ri qayta ishlaydi. Tor tip testlarda
 * sun'iy `as` kastlarisiz qisman muhit yasash imkonini beradi.
 */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/**
 * Barcha tekshiruvlar. Faqat produksiya uchun — dev va testda bo'sh
 * ro'yxat qaytadi, chunki `.env` siz ham ishlab ko'rish mumkin bo'lishi kerak.
 */
export function checkProductionConfig(env: EnvSource): ConfigProblem[] {
  // Build fazasi: sir talab qilinmaydi (aks holda uni Docker build
  // argumentiga qo'yish va image qatlamlarida qoldirish kerak bo'lardi).
  if (env.NEXT_PHASE === "phase-production-build") return [];
  if (env.NODE_ENV !== "production") return [];

  const problems: ConfigProblem[] = [];

  for (const item of REQUIRED) {
    if (!env[item.name]?.trim()) {
      problems.push({
        level: "error",
        name: item.name,
        message: `${item.why}\n      misol: ${item.how}`,
      });
    }
  }

  checkAppUrl(env.APP_URL, problems);
  checkSiteDomain(env.SITE_DOMAIN, problems);
  checkProxyHops(env.TRUSTED_PROXY_HOPS, env.TRUSTED_PROXY_HEADER, problems);

  return problems;
}

/** Xatolarni bitta o'qiladigan xabarga yig'adi. Sir qiymati chiqmaydi. */
export function formatProblems(problems: ConfigProblem[]): string {
  const errors = problems.filter((p) => p.level === "error");
  const lines = errors.map((p) => `  · ${p.name} — ${p.message}`);

  let text =
    `Produksiya sozlamalari noto'g'ri:\n${lines.join("\n")}\n` +
    `\n.env.example dan nusxa oling: cp .env.example .env`;

  if (errors.some((p) => p.name === "SECRETS_KEY")) {
    text += `\n\n  ${SECRETS_KEY_MIGRATION_HINT}`;
  }

  return text;
}
