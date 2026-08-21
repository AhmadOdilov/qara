import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bucketKey,
  forwardedChain,
  normalizeIp,
  resolveClientIp,
  trustConfigFromEnv,
  UNTRUSTED_KEY,
  type TrustConfig,
} from "@/lib/client-ip";

/** Sozlamalarni qisqa yozish uchun. */
function config(overrides: Partial<TrustConfig> = {}): TrustConfig {
  return { header: null, hops: 0, allowDevFallback: false, ...overrides };
}

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("normalizeIp", () => {
  it("IPv4 va portli IPv4 ni bir shaklga keltiradi", () => {
    assert.equal(normalizeIp("1.2.3.4"), "1.2.3.4");
    assert.equal(normalizeIp("1.2.3.4:5678"), "1.2.3.4");
    assert.equal(normalizeIp("  1.2.3.4  "), "1.2.3.4");
  });

  it("qavsli va portli IPv6 ni ochadi", () => {
    assert.equal(normalizeIp("[2001:db8::1]:443"), "2001:db8::1");
    assert.equal(normalizeIp("[2001:db8::1]"), "2001:db8::1");
    assert.equal(normalizeIp("2001:DB8::1"), "2001:db8::1");
  });

  it("IPv4-mapped IPv6 ni IPv4 ga qaytaradi", () => {
    assert.equal(normalizeIp("::ffff:203.0.113.9"), "203.0.113.9");
  });

  it("manzil bo'lmagan qiymatni rad etadi", () => {
    for (const bad of ["", "unknown", "_hidden", "not-an-ip", "999.1.1.1", "1.2.3"]) {
      assert.equal(normalizeIp(bad), null, bad);
    }
  });
});

describe("bucketKey", () => {
  it("IPv4 uchun manzilning o'zi", () => {
    assert.equal(bucketKey("203.0.113.9"), "203.0.113.9");
  });

  it("IPv6 uchun /64 prefiks — bitta abonent butun blokni oladi", () => {
    const a = bucketKey("2001:db8:1:2:aaaa::1");
    const b = bucketKey("2001:db8:1:2:bbbb::2");
    assert.equal(a, b, "bir xil /64 bir xil chelakka tushishi kerak");

    const other = bucketKey("2001:db8:1:3::1");
    assert.notEqual(a, other, "boshqa /64 boshqa chelak");
  });
});

describe("forwardedChain", () => {
  it("X-Forwarded-For zanjirini tartibda o'qiydi", () => {
    const chain = forwardedChain(
      headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" }),
    );
    assert.deepEqual(chain, ["1.1.1.1", "2.2.2.2", "3.3.3.3"]);
  });

  it("RFC 7239 Forwarded sarlavhasini ham tushunadi", () => {
    const chain = forwardedChain(
      headers({ forwarded: 'for=1.1.1.1;proto=https, for="[2001:db8::1]:443"' }),
    );
    assert.deepEqual(chain, ["1.1.1.1", "2001:db8::1"]);
  });

  it("buzuq yozuvlarni tashlab ketadi", () => {
    const chain = forwardedChain(
      headers({ "x-forwarded-for": "unknown, 2.2.2.2, , _hidden" }),
    );
    assert.deepEqual(chain, ["2.2.2.2"]);
  });

  it("ikkala sarlavha kelsa FAQAT X-Forwarded-For o'qiladi", () => {
    // Bizning proksi (Caddy) `X-Forwarded-For` yozadi. Klient qo'shimcha
    // `Forwarded` yuborsa, u zanjirga UMUMAN qo'shilmasligi kerak — aks
    // holda `hops` o'ngdan sanagani uchun soxta qiymat ishonchli o'ng
    // uchga tushib qolardi.
    const chain = forwardedChain(
      headers({ "x-forwarded-for": "198.18.0.7", forwarded: "for=9.9.9.9" }),
    );
    assert.deepEqual(chain, ["198.18.0.7"], "Forwarded e'tiborsiz qolishi kerak");
  });

  it("X-Forwarded-For bo'lmasa Forwarded ishlatiladi", () => {
    const chain = forwardedChain(headers({ forwarded: "for=198.18.0.7" }));
    assert.deepEqual(chain, ["198.18.0.7"]);
  });
});

describe("resolveClientIp — ishonchli proksi yo'q", () => {
  it("X-Forwarded-For ga UMUMAN ishonmaydi", () => {
    const resolved = resolveClientIp(
      headers({ "x-forwarded-for": "1.1.1.1" }),
      config(),
    );
    assert.equal(resolved.key, UNTRUSTED_KEY);
    assert.equal(resolved.source, "untrusted");
    assert.equal(resolved.ip, null);
  });

  it("har xil soxta qiymat bir xil chelakka tushadi — cheklov ochilmaydi", () => {
    const keys = new Set(
      ["1.1.1.1", "2.2.2.2", "3.3.3.3", "9.9.9.9"].map(
        (fake) =>
          resolveClientIp(headers({ "x-forwarded-for": fake }), config()).key,
      ),
    );
    assert.equal(keys.size, 1, "hamma soxta qiymat bitta kalitga tushishi kerak");
    assert.ok(keys.has(UNTRUSTED_KEY));
  });
});

describe("resolveClientIp — bitta ishonchli proksi (hops = 1)", () => {
  const cfg = config({ hops: 1 });

  it("zanjirning eng O'NG yozuvini oladi — uni proksi yozgan", () => {
    const resolved = resolveClientIp(
      headers({ "x-forwarded-for": "203.0.113.9" }),
      cfg,
    );
    assert.equal(resolved.ip, "203.0.113.9");
    assert.equal(resolved.source, "forwarded-chain");
  });

  it("hujumchi chapga qiymat qo'shsa ham natija o'zgarmaydi", () => {
    // Proksi haqiqiy manzilni (203.0.113.9) o'ngga QO'SHADI; klient yozgan
    // 1.1.1.1 chapda qoladi va e'tiborga olinmaydi.
    const spoofed = resolveClientIp(
      headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }),
      cfg,
    );
    assert.equal(spoofed.ip, "203.0.113.9");

    const many = resolveClientIp(
      headers({ "x-forwarded-for": "6.6.6.6, 7.7.7.7, 8.8.8.8, 203.0.113.9" }),
      cfg,
    );
    assert.equal(many.ip, "203.0.113.9", "chapdagi qiymatlar ta'sir qilmaydi");
  });

  it("hujumchi har safar boshqa qiymat yuborsa ham kalit BARQAROR qoladi", () => {
    const keys = new Set(
      ["1.1.1.1", "2.2.2.2", "3.3.3.3"].map(
        (fake) =>
          resolveClientIp(
            headers({ "x-forwarded-for": `${fake}, 203.0.113.9` }),
            cfg,
          ).key,
      ),
    );
    assert.deepEqual([...keys], ["203.0.113.9"]);
  });

  it("hujumchi 'Forwarded' sarlavhasi bilan o'ng uchni EGALLAY OLMAYDI", () => {
    // Haqiqiy zaiflik edi: Caddy `X-Forwarded-For` yozadi, klient esa
    // qo'shimcha `Forwarded` yuboradi. Ilgari ikkala sarlavha ketma-ket
    // birlashtirilardi va klient qiymati zanjirning eng o'ngiga —
    // ya'ni `hops` ishonchli deb bilgan joyga — tushardi.
    const resolved = resolveClientIp(
      headers({ "x-forwarded-for": "203.0.113.9", forwarded: "for=9.9.9.9" }),
      cfg,
    );
    assert.equal(resolved.ip, "203.0.113.9", "proksi yozgan manzil g'olib bo'lishi kerak");
    assert.notEqual(resolved.ip, "9.9.9.9", "klient yuborgan qiymat qabul qilinmasin");
  });

  it("'Forwarded' har safar o'zgarsa ham rate limit chelagi BITTA qoladi", () => {
    // Chelak almashsa cheklovni cheksiz chetlab o'tish mumkin bo'lardi.
    const keys = new Set(
      ["9.9.9.1", "9.9.9.2", "9.9.9.3", "9.9.9.4"].map(
        (fake) =>
          resolveClientIp(
            headers({ "x-forwarded-for": "203.0.113.9", forwarded: `for=${fake}` }),
            cfg,
          ).key,
      ),
    );
    assert.deepEqual([...keys], ["203.0.113.9"]);
  });

  it("zanjir bo'sh bo'lsa — so'rov kutilgan yo'ldan kelmagan", () => {
    const resolved = resolveClientIp(headers({}), cfg);
    assert.equal(resolved.key, UNTRUSTED_KEY);
  });
});

describe("resolveClientIp — ikkita ishonchli proksi (hops = 2)", () => {
  const cfg = config({ hops: 2 });

  it("o'ngdan ikkinchi yozuvni oladi", () => {
    const resolved = resolveClientIp(
      headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9, 10.0.0.5" }),
      cfg,
    );
    assert.equal(resolved.ip, "203.0.113.9");
  });

  it("zanjir kutilganidan kalta bo'lsa ishonmaydi", () => {
    const resolved = resolveClientIp(
      headers({ "x-forwarded-for": "203.0.113.9" }),
      cfg,
    );
    assert.equal(resolved.key, UNTRUSTED_KEY);
  });
});

describe("resolveClientIp — platforma sarlavhasi", () => {
  const cfg = config({ header: "cf-connecting-ip" });

  it("faqat o'sha sarlavhaga ishonadi", () => {
    const resolved = resolveClientIp(
      headers({
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "1.1.1.1",
      }),
      cfg,
    );
    assert.equal(resolved.ip, "203.0.113.9");
    assert.equal(resolved.source, "platform-header");
  });

  it("sarlavha kelmasa X-Forwarded-For ga tushib ketmaydi", () => {
    const resolved = resolveClientIp(
      headers({ "x-forwarded-for": "1.1.1.1" }),
      cfg,
    );
    assert.equal(resolved.key, UNTRUSTED_KEY);
  });
});

describe("resolveClientIp — development", () => {
  it("lokal muhitda sarlavhaga ishonadi (qulaylik uchun)", () => {
    const resolved = resolveClientIp(
      headers({ "x-forwarded-for": "1.2.3.4" }),
      config({ allowDevFallback: true }),
    );
    assert.equal(resolved.ip, "1.2.3.4");
    assert.equal(resolved.source, "dev-fallback");
  });

  it("sarlavhasiz so'rov uchun barqaror kalit beradi", () => {
    const resolved = resolveClientIp(headers({}), config({ allowDevFallback: true }));
    assert.equal(resolved.key, "local");
  });
});

describe("trustConfigFromEnv", () => {
  it("standart holat — hech narsaga ishonilmaydi", () => {
    const cfg = trustConfigFromEnv({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
    assert.equal(cfg.header, null);
    assert.equal(cfg.hops, 0);
    assert.equal(cfg.allowDevFallback, false);
  });

  it("noma'lum sarlavha nomi qabul qilinmaydi", () => {
    const cfg = trustConfigFromEnv({
      NODE_ENV: "production",
      TRUSTED_PROXY_HEADER: "x-my-own-header",
    } as NodeJS.ProcessEnv);
    assert.equal(cfg.header, null, "ro'yxatda yo'q sarlavhaga ishonilmaydi");
  });

  it("hops manfiy yoki noto'g'ri bo'lsa nolga tushadi", () => {
    for (const value of ["-1", "abc", "", "0"]) {
      const cfg = trustConfigFromEnv({
        NODE_ENV: "production",
        TRUSTED_PROXY_HOPS: value,
      } as NodeJS.ProcessEnv);
      assert.equal(cfg.hops, 0, value);
    }
  });

  it("to'g'ri qiymatlarni o'qiydi", () => {
    const cfg = trustConfigFromEnv({
      NODE_ENV: "production",
      TRUSTED_PROXY_HOPS: "2",
      TRUSTED_PROXY_HEADER: "CF-Connecting-IP",
    } as NodeJS.ProcessEnv);
    assert.equal(cfg.hops, 2);
    assert.equal(cfg.header, "cf-connecting-ip");
  });

  it("development'da fallback yoqiladi", () => {
    const cfg = trustConfigFromEnv({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
    assert.equal(cfg.allowDevFallback, true);
  });
});
