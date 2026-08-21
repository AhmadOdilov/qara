import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkProductionConfig,
  formatProblems,
  type ConfigProblem,
  type EnvSource,
} from "@/lib/config-check";

/**
 * Produksiya sozlamalari tekshiruvi (§P12 PHASE 1).
 *
 * Bu mantiq ilgari `instrumentation.ts` ichida edi va HECH QACHON
 * sinalmagan — noto'g'ri sozlangan konteyner jimgina ko'tarilib ketishi
 * mumkin edi.
 */

/** To'g'ri sozlangan produksiya muhiti — testlar shundan chetlashadi. */
function prodEnv(overrides: Record<string, string> = {}): EnvSource {
  return {
    NODE_ENV: "production",
    AUTH_SECRET: "x".repeat(44),
    DATABASE_URL: "postgresql://qara:parol@db:5432/qara?schema=public",
    SECRETS_KEY: "y".repeat(44),
    APP_URL: "https://qara.uz",
    SITE_DOMAIN: "qara.uz",
    ACME_EMAIL: "admin@qara.uz",
    TRUSTED_PROXY_HOPS: "1",
    ...overrides,
  };
}

function names(problems: ConfigProblem[], level: "error" | "warn"): string[] {
  return problems.filter((p) => p.level === level).map((p) => p.name).sort();
}

describe("checkProductionConfig — qachon umuman tekshiradi", () => {
  it("to'g'ri sozlangan produksiyada hech qanday muammo yo'q", () => {
    assert.deepEqual(checkProductionConfig(prodEnv()), []);
  });

  it("development'da tekshirmaydi — .env siz ishlab ko'rish mumkin bo'lsin", () => {
    const env: EnvSource = { NODE_ENV: "development" };
    assert.deepEqual(checkProductionConfig(env), []);
  });

  it("test muhitida ham tekshirmaydi", () => {
    const env: EnvSource = { NODE_ENV: "test" };
    assert.deepEqual(checkProductionConfig(env), []);
  });

  it("BUILD fazasida sir talab qilinmaydi", () => {
    // Aks holda sirni Docker build argumentiga qo'yish kerak bo'lardi va u
    // image qatlamlarida qolib ketardi.
    const env = prodEnv({
      NEXT_PHASE: "phase-production-build",
      AUTH_SECRET: "",
      DATABASE_URL: "",
      SECRETS_KEY: "",
    });
    assert.deepEqual(checkProductionConfig(env), []);
  });
});

describe("checkProductionConfig — majburiy sirlar", () => {
  it("AUTH_SECRET yo'q bo'lsa xato", () => {
    const p = checkProductionConfig(prodEnv({ AUTH_SECRET: "" }));
    assert.deepEqual(names(p, "error"), ["AUTH_SECRET"]);
  });

  it("DATABASE_URL yo'q bo'lsa xato", () => {
    const p = checkProductionConfig(prodEnv({ DATABASE_URL: "" }));
    assert.deepEqual(names(p, "error"), ["DATABASE_URL"]);
  });

  it("SECRETS_KEY yo'q bo'lsa XATO — ogohlantirish emas", () => {
    // Ilgari bu faqat warn edi. Kalit AUTH_SECRET'dan hosil qilinardi,
    // ya'ni AUTH_SECRET aylantirilishi bilan saqlangan bot tokenlari
    // qaytarib bo'lmas darajada ochilmay qolardi.
    const p = checkProductionConfig(prodEnv({ SECRETS_KEY: "" }));
    assert.deepEqual(names(p, "error"), ["SECRETS_KEY"]);
  });

  it("faqat bo'shliqdan iborat qiymat berilmagan deb hisoblanadi", () => {
    const p = checkProductionConfig(prodEnv({ SECRETS_KEY: "   " }));
    assert.deepEqual(names(p, "error"), ["SECRETS_KEY"]);
  });

  it("hammasi yo'q bo'lsa uchalasi ham sanaladi", () => {
    const p = checkProductionConfig(
      prodEnv({ AUTH_SECRET: "", DATABASE_URL: "", SECRETS_KEY: "" }),
    );
    assert.deepEqual(names(p, "error"), [
      "AUTH_SECRET",
      "DATABASE_URL",
      "SECRETS_KEY",
    ]);
  });

  it("xabarlarda sir QIYMATI chiqmaydi", () => {
    const secret = "juda-maxfiy-qiymat-123";
    const p = checkProductionConfig(
      prodEnv({ AUTH_SECRET: secret, SECRETS_KEY: "" }),
    );
    const text = formatProblems(p);
    assert.ok(!text.includes(secret), "sir qiymati xabarga tushmasligi kerak");
  });
});

describe("checkProductionConfig — APP_URL", () => {
  it("to'liq HTTPS manzil qabul qilinadi", () => {
    const p = checkProductionConfig(prodEnv({ APP_URL: "https://qara.uz" }));
    assert.deepEqual(p, []);
  });

  it("sxemasiz manzil XATO", () => {
    const p = checkProductionConfig(prodEnv({ APP_URL: "qara.uz" }));
    assert.deepEqual(names(p, "error"), ["APP_URL"]);
  });

  it("http/https bo'lmagan sxema XATO", () => {
    const p = checkProductionConfig(prodEnv({ APP_URL: "ftp://qara.uz" }));
    assert.deepEqual(names(p, "error"), ["APP_URL"]);
  });

  it("localhost — ogohlantirish (Telegram webhook yubora olmaydi)", () => {
    const p = checkProductionConfig(
      prodEnv({ APP_URL: "http://localhost:3000" }),
    );
    assert.deepEqual(names(p, "error"), []);
    assert.deepEqual(names(p, "warn"), ["APP_URL"]);
  });

  it("tashqi HTTP manzil — ogohlantirish", () => {
    const p = checkProductionConfig(prodEnv({ APP_URL: "http://qara.uz" }));
    assert.deepEqual(names(p, "warn"), ["APP_URL"]);
  });

  it("belgilanmagan bo'lsa — ogohlantirish", () => {
    const p = checkProductionConfig(prodEnv({ APP_URL: "" }));
    assert.deepEqual(names(p, "warn"), ["APP_URL"]);
  });
});

describe("checkProductionConfig — SITE_DOMAIN", () => {
  it("oddiy domen qabul qilinadi", () => {
    assert.deepEqual(checkProductionConfig(prodEnv({ SITE_DOMAIN: "qara.uz" })), []);
  });

  it("subdomen va wildcard qabul qilinadi", () => {
    for (const domain of ["app.qara.uz", "*.qara.uz", "a.b.c.qara.uz"]) {
      assert.deepEqual(
        checkProductionConfig(prodEnv({ SITE_DOMAIN: domain })),
        [],
        domain,
      );
    }
  });

  it("bo'sh bo'lsa muammo emas — Caddy'siz deploy ham to'g'ri", () => {
    assert.deepEqual(checkProductionConfig(prodEnv({ SITE_DOMAIN: "" })), []);
  });

  it("sxema bilan yozilsa XATO", () => {
    const p = checkProductionConfig(prodEnv({ SITE_DOMAIN: "https://qara.uz" }));
    assert.deepEqual(names(p, "error"), ["SITE_DOMAIN"]);
  });

  it("yo'l bilan yozilsa XATO", () => {
    const p = checkProductionConfig(prodEnv({ SITE_DOMAIN: "qara.uz/app" }));
    assert.deepEqual(names(p, "error"), ["SITE_DOMAIN"]);
  });

  it("port bilan yozilsa XATO", () => {
    const p = checkProductionConfig(prodEnv({ SITE_DOMAIN: "qara.uz:443" }));
    assert.deepEqual(names(p, "error"), ["SITE_DOMAIN"]);
  });

  it("nuqtasiz nom XATO — Let's Encrypt sertifikat bermaydi", () => {
    for (const bad of ["localhost", "qara", "my_host.uz", "-qara.uz"]) {
      const p = checkProductionConfig(prodEnv({ SITE_DOMAIN: bad }));
      assert.deepEqual(names(p, "error"), ["SITE_DOMAIN"], bad);
    }
  });
});

describe("checkProductionConfig — TRUSTED_PROXY_HOPS", () => {
  it("butun son qabul qilinadi", () => {
    for (const hops of ["1", "2", "10"]) {
      assert.deepEqual(
        checkProductionConfig(prodEnv({ TRUSTED_PROXY_HOPS: hops })),
        [],
        hops,
      );
    }
  });

  it("son bo'lmagan qiymat XATO — ilgari jimgina 0 ga aylanardi", () => {
    // Aynan shu jimlik xavfli edi: operator xato yozsa ham rate limit
    // ishlayotgandek ko'rinardi, aslida butun sayt bitta chelakda edi.
    for (const bad of ["one", "1.5", "-1", "1x", "abc"]) {
      const p = checkProductionConfig(prodEnv({ TRUSTED_PROXY_HOPS: bad }));
      assert.deepEqual(names(p, "error"), ["TRUSTED_PROXY_HOPS"], bad);
    }
  });

  it("0 — ogohlantirish (proksi ortida bo'lsa xato sozlama)", () => {
    const p = checkProductionConfig(prodEnv({ TRUSTED_PROXY_HOPS: "0" }));
    assert.deepEqual(names(p, "error"), []);
    assert.deepEqual(names(p, "warn"), ["TRUSTED_PROXY_HOPS"]);
  });

  it("ikkalasi ham sozlanmagan bo'lsa — ogohlantirish", () => {
    const p = checkProductionConfig(
      prodEnv({ TRUSTED_PROXY_HOPS: "", TRUSTED_PROXY_HEADER: "" }),
    );
    assert.deepEqual(names(p, "warn"), ["TRUSTED_PROXY_HOPS"]);
  });
});

describe("checkProductionConfig — TRUSTED_PROXY_HEADER", () => {
  it("tanilgan platforma sarlavhasi qabul qilinadi va hops'ni almashtiradi", () => {
    const p = checkProductionConfig(
      prodEnv({ TRUSTED_PROXY_HOPS: "", TRUSTED_PROXY_HEADER: "cf-connecting-ip" }),
    );
    assert.deepEqual(p, []);
  });

  it("tanilmagan sarlavha XATO — u e'tiborsiz qolib himoyani ochardi", () => {
    const p = checkProductionConfig(
      prodEnv({ TRUSTED_PROXY_HEADER: "x-my-own-header" }),
    );
    assert.deepEqual(names(p, "error"), ["TRUSTED_PROXY_HEADER"]);
  });

  it("katta-kichik harf farq qilmaydi", () => {
    const p = checkProductionConfig(
      prodEnv({ TRUSTED_PROXY_HOPS: "", TRUSTED_PROXY_HEADER: "CF-Connecting-IP" }),
    );
    assert.deepEqual(p, []);
  });
});

describe("formatProblems", () => {
  it("SECRETS_KEY yo'q bo'lsa migratsiya yo'riqnomasi qo'shiladi", () => {
    // Yangi tasodifiy kalit qo'yilsa mavjud shifrlangan tokenlar ochilmaydi,
    // shuning uchun xabar amaldagi kalitni qanday saqlab qolishni aytishi kerak.
    const p = checkProductionConfig(prodEnv({ SECRETS_KEY: "" }));
    const text = formatProblems(p);
    assert.match(text, /derive-secrets-key\.sh/);
  });

  it("boshqa xatolarda migratsiya yo'riqnomasi qo'shilmaydi", () => {
    const p = checkProductionConfig(prodEnv({ DATABASE_URL: "" }));
    const text = formatProblems(p);
    assert.ok(!text.includes("derive-secrets-key.sh"));
  });

  it("har bir xato o'zgaruvchi nomi bilan sanaladi", () => {
    const p = checkProductionConfig(
      prodEnv({ AUTH_SECRET: "", DATABASE_URL: "" }),
    );
    const text = formatProblems(p);
    assert.match(text, /AUTH_SECRET/);
    assert.match(text, /DATABASE_URL/);
  });
});
