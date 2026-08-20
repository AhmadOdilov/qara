import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF himoyasi — Mini App API chaqiruvlari uchun.
 *
 * TAHDID: egasi konstruktorda ixtiyoriy manzil yozadi va server o'sha manzilga
 * chiqadi. Agar cheklanmasa, u server ichidagi tarmoqni (`localhost`, ichki
 * xizmatlar) yoki bulut metadata endpointini (`169.254.169.254`) o'qib,
 * kalitlarni o'g'irlashi mumkin.
 *
 * HIMOYA IKKI QAVAT:
 *
 *   1. Tuzilma tekshiruvi (`assertSafeUrl`) — protokol, port, hostname.
 *      Konfiguratsiya saqlanayotganda ham, so'rov ketishidan oldin ham
 *      chaqiriladi.
 *
 *   2. DNS tekshiruvi (`assertPublicHost`) — hostname ochiq IP'ga
 *      yechiladimi. So'rovdan HAR SAFAR oldin bajariladi, chunki domen
 *      egasi DNS yozuvini keyin ichki manzilga burishi mumkin.
 *
 * DNS REBINDING. To'liq yopish uchun yechilgan IP'ga to'g'ridan-to'g'ri
 * ulanish kerak bo'lardi (`Host` sarlavhasi bilan), lekin bu TLS
 * sertifikatini buzadi. Shuning uchun amaliy chora: yechilgan HAMMA manzil
 * tekshiriladi, so'rov qayta yo'naltirishsiz (`redirect: "manual"`) va qisqa
 * timeout bilan ketadi — bu oynani juda tor qiladi. Qolgan xavf README'da
 * yozilgan.
 */

export class SsrfError extends Error {
  constructor(
    message: string,
    readonly code:
      | "protocol"
      | "port"
      | "hostname"
      | "private_ip"
      | "dns"
      | "not_allowed",
  ) {
    super(message);
    this.name = "SsrfError";
  }
}

/** Hostname bo'yicha ochiq taqiq — DNS'gacha kesiladi. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "169.254.169.254",
]);

/** `.local`, `.internal` kabi ichki tarmoq zonalari. */
const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".intranet", ".home.arpa"];

/** Faqat standart veb portlari — `:22`, `:6379` kabi ichki xizmatlar yopiq. */
const ALLOWED_PORTS = new Set([443]);

/**
 * URL tuzilishi xavfsizmi.
 *
 * `allowlist` berilsa — faqat shu domenlarga (va ularning subdomenlariga)
 * ruxsat beriladi. Bu eng qattiq va tavsiya etiladigan rejim.
 */
export function assertSafeUrl(raw: string, allowlist: string[] = []): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError("Manzil noto'g'ri", "hostname");
  }

  // HTTPS majburiy: ichki xizmatlarning ko'pi HTTP'da yashaydi va trafik
  // ochiq ketmasligi kerak.
  if (url.protocol !== "https:") {
    throw new SsrfError("Faqat HTTPS manzil qabul qilinadi", "protocol");
  }

  const port = url.port ? Number(url.port) : 443;
  if (!ALLOWED_PORTS.has(port)) {
    throw new SsrfError(`${port}-port yopiq — faqat 443 ruxsat etilgan`, "port");
  }

  const host = normalizeHost(url.hostname);
  if (!host) throw new SsrfError("Manzilda host yo'q", "hostname");

  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new SsrfError("Bu manzil ichki tarmoqqa tegishli", "hostname");
  }
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new SsrfError("Ichki tarmoq domeni qabul qilinmaydi", "hostname");
  }

  // Foydalanuvchi to'g'ridan-to'g'ri IP yozgan bo'lsa — shu yerda tekshiramiz.
  if (isIP(host) && !isPublicIp(host)) {
    throw new SsrfError("Ichki IP manzilga so'rov yuborilmaydi", "private_ip");
  }

  // `user:pass@host` — hujumchi parserni chalg'itishi mumkin, kerak ham emas.
  if (url.username || url.password) {
    throw new SsrfError("Manzilda login/parol bo'lmasligi kerak", "hostname");
  }

  if (allowlist.length > 0 && !matchesAllowlist(host, allowlist)) {
    throw new SsrfError(
      `«${host}» ruxsat etilgan domenlar ro'yxatida yo'q`,
      "not_allowed",
    );
  }

  return url;
}

/**
 * Hostname'ni solishtirishga tayyorlaydi.
 *
 * `URL.hostname` IPv6 literalni KVADRAT QAVSLAR bilan qaytaradi
 * (`https://[::1]/` → `[::1]`), qavsli satr esa `isIP()` uchun IP emas —
 * ya'ni qavslarni olib tashlamasa loopback tekshiruvdan butunlay o'tib
 * ketardi. Nuqta bilan tugagan («root») shakli ham normallashtiriladi.
 */
function normalizeHost(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
}

/** `api.example.com` → `example.com` ro'yxatiga tushadi. */
function matchesAllowlist(host: string, allowlist: string[]): boolean {
  return allowlist.some((entry) => {
    const domain = entry.trim().toLowerCase().replace(/^\.+/, "");
    if (!domain) return false;
    return host === domain || host.endsWith(`.${domain}`);
  });
}

/**
 * Hostname ochiq IP'ga yechiladimi.
 *
 * `lookup(all: true)` bilan HAMMA manzil olinadi: domen bir vaqtda ochiq va
 * ichki IP berishi mumkin, bittasi ham ichki bo'lsa so'rov to'xtaydi.
 */
export async function assertPublicHost(hostname: string): Promise<string[]> {
  const host = normalizeHost(hostname);

  if (isIP(host)) {
    if (!isPublicIp(host)) {
      throw new SsrfError("Ichki IP manzilga so'rov yuborilmaydi", "private_ip");
    }
    return [host];
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new SsrfError("Domen manzili aniqlanmadi", "dns");
  }

  if (addresses.length === 0) {
    throw new SsrfError("Domen manzili aniqlanmadi", "dns");
  }

  for (const { address } of addresses) {
    if (!isPublicIp(address)) {
      throw new SsrfError("Domen ichki IP manzilga yechiladi", "private_ip");
    }
  }

  return addresses.map((entry) => entry.address);
}

/* ── IP tekshiruvi ───────────────────────────────────────────────────────── */

/** Manzil ochiq internetga tegishlimi. */
export function isPublicIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPublicIpv4(address);
  if (version === 6) return isPublicIpv6(address);
  return false;
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;

  if (a === 0) return false; // 0.0.0.0/8
  if (a === 10) return false; // xususiy
  if (a === 127) return false; // loopback
  if (a === 169 && b === 254) return false; // link-local + bulut metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // xususiy
  if (a === 192 && b === 168) return false; // xususiy
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT (Alibaba metadata ham)
  if (a === 192 && b === 0) return false; // 192.0.0.0/24, 192.0.2.0/24
  if (a === 192 && b === 88) return false; // 6to4 relay
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmark
  if (a === 198 && b === 51) return false; // TEST-NET-2
  if (a === 203 && b === 0) return false; // TEST-NET-3
  if (a >= 224) return false; // multicast (224/4) va rezerv (240/4)

  return true;
}

/**
 * IPv6 manzilni 8 ta guruhga yoyadi (`::` siqilishini ochib).
 *
 * Satr solishtirish yetmaydi: `[::ffff:127.0.0.1]` ni `URL` HEX ko'rinishga
 * (`::ffff:7f00:1`) normallashtiradi — ya'ni naqsh bo'yicha izlagan tekshiruv
 * IPv4-mapped loopback'ni o'tkazib yuborardi. Shuning uchun manzil raqamga
 * aylantirilib, diapazonlar bit bo'yicha tekshiriladi.
 */
function expandIpv6(address: string): number[] | null {
  let value = address;

  // Oxiridagi nuqtali IPv4 qismi (`::ffff:1.2.3.4`) ikki guruhga aylanadi.
  const dotted = value.match(/(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const octets = dotted[2].split(".").map(Number);
    if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return null;
    }
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    value = `${dotted[1]}${high}:${low}`;
  }

  const halves = value.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 1 && head.length !== 8) return null;
  if (halves.length === 2 && fill < 0) return null;

  const groups = [
    ...head,
    ...Array.from({ length: halves.length === 2 ? fill : 0 }, () => "0"),
    ...tail,
  ];
  if (groups.length !== 8) return null;

  const numbers = groups.map((group) => Number.parseInt(group || "0", 16));
  return numbers.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff) ? null : numbers;
}

function isPublicIpv6(address: string): boolean {
  // Zona identifikatori (`fe80::1%eth0`) tekshiruvga kirmaydi.
  const groups = expandIpv6(address.toLowerCase().split("%")[0]);
  if (!groups) return false;

  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  const allZeroHead = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;

  // `::` va `::1`
  if (allZeroHead && g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) return false;

  // IPv4-mapped (`::ffff:a.b.c.d`) va IPv4-compatible (`::a.b.c.d`) —
  // ichkaridagi IPv4 bo'yicha hukm qilamiz.
  if (allZeroHead && (g5 === 0xffff || g5 === 0)) {
    return isPublicIpv4(ipv4From(g6, g7));
  }

  // NAT64 (`64:ff9b::/96`) ham IPv4 ni o'rab oladi.
  if (g0 === 0x64 && g1 === 0xff9b) return false;

  if ((g0 & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((g0 & 0xff00) === 0xff00) return false; // ff00::/8 multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return false; // hujjat uchun

  return true;
}

function ipv4From(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}
