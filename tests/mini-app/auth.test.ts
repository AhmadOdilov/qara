/**
 * `initData` tekshiruvi — Mini App autentifikatsiyasining yagona ishonch nuqtasi.
 *
 * Bu yerda sinaladigan narsa oddiy: SOXTA ma'lumot hech qanday yo'l bilan
 * o'tmasligi kerak. Shuning uchun testlar imzoni haqiqiy Telegram algoritmi
 * bilan yasaydi va har bir buzilgan holatni alohida tekshiradi.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { createHmac } from "node:crypto";

import {
  InitDataError,
  INIT_DATA_TTL_MS,
  verifyInitData,
} from "../../lib/mini-app/auth";

const TOKEN = "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw";

const USER = {
  id: 55501234,
  first_name: "Dilnoza",
  last_name: "Karimova",
  username: "dilnoza",
  language_code: "uz",
  photo_url: "https://t.me/i/userpic/320/abc.jpg",
  is_premium: true,
};

/** Telegram aynan shunday imzolaydi — test soxta emas, haqiqiy algoritm. */
function signInitData(
  fields: Record<string, string>,
  token = TOKEN,
): string {
  const checkString = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secretKey).update(checkString).digest("hex");

  return new URLSearchParams({ ...fields, hash }).toString();
}

function freshFields(overrides: Record<string, string> = {}) {
  return {
    user: JSON.stringify(USER),
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "AAH123",
    ...overrides,
  };
}

function reasonOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof InitDataError, "InitDataError kutilgan edi");
    return error.reason;
  }
  throw new Error("xato kutilgan edi, lekin o'tib ketdi");
}

describe("initData — haqiqiy imzo", () => {
  test("to'g'ri imzolangan ma'lumot qabul qilinadi", () => {
    const result = verifyInitData(TOKEN, signInitData(freshFields()));

    assert.equal(result.user.id, "55501234");
    assert.equal(result.user.firstName, "Dilnoza");
    assert.equal(result.user.username, "dilnoza");
    assert.equal(result.user.languageCode, "uz");
    assert.equal(result.user.isPremium, true);
    assert.equal(result.queryId, "AAH123");
  });

  test("id satrga o'giriladi — bazadagi telegramUserId bilan bir xil tur", () => {
    const result = verifyInitData(TOKEN, signInitData(freshFields()));
    assert.equal(typeof result.user.id, "string");
  });

  test("start_param o'qiladi", () => {
    const data = signInitData(freshFields({ start_param: "promo7" }));
    assert.equal(verifyInitData(TOKEN, data).startParam, "promo7");
  });
});

describe("initData — soxta ma'lumot rad etiladi", () => {
  test("bo'sh satr", () => {
    assert.equal(reasonOf(() => verifyInitData(TOKEN, "")), "missing");
  });

  test("hash umuman yo'q", () => {
    const data = new URLSearchParams(freshFields()).toString();
    assert.equal(reasonOf(() => verifyInitData(TOKEN, data)), "malformed");
  });

  test("hash boshqa qiymatga almashtirilgan", () => {
    const data = signInitData(freshFields()).replace(/hash=[0-9a-f]+/, `hash=${"0".repeat(64)}`);
    assert.equal(reasonOf(() => verifyInitData(TOKEN, data)), "bad_signature");
  });

  test("imzolangandan keyin foydalanuvchi o'zgartirilgan", () => {
    // Eng muhim holat: hujumchi o'zini boshqa odam qilib ko'rsatmoqchi.
    const honest = signInitData(freshFields());
    const tampered = honest.replace(
      encodeURIComponent(JSON.stringify(USER)),
      encodeURIComponent(JSON.stringify({ ...USER, id: 99999999 })),
    );
    assert.notEqual(honest, tampered, "test o'zgartira olmadi");
    assert.equal(reasonOf(() => verifyInitData(TOKEN, tampered)), "bad_signature");
  });

  test("boshqa botning tokeni bilan imzolangan", () => {
    const data = signInitData(freshFields(), "987654321:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
    assert.equal(reasonOf(() => verifyInitData(TOKEN, data)), "bad_signature");
  });

  test("muddati o'tgan auth_date", () => {
    const old = Math.floor((Date.now() - INIT_DATA_TTL_MS - 60_000) / 1000);
    const data = signInitData(freshFields({ auth_date: String(old) }));
    assert.equal(reasonOf(() => verifyInitData(TOKEN, data)), "expired");
  });

  test("chegaraning ichidagi auth_date hamon yaroqli", () => {
    const edge = Math.floor((Date.now() - INIT_DATA_TTL_MS + 60_000) / 1000);
    const data = signInitData(freshFields({ auth_date: String(edge) }));
    assert.equal(verifyInitData(TOKEN, data).user.id, "55501234");
  });

  test("auth_date buzilgan", () => {
    const data = signInitData(freshFields({ auth_date: "keyinroq" }));
    assert.equal(reasonOf(() => verifyInitData(TOKEN, data)), "malformed");
  });

  test("user maydoni yo'q", () => {
    const fields = freshFields();
    delete (fields as Record<string, string>).user;
    assert.equal(reasonOf(() => verifyInitData(TOKEN, signInitData(fields))), "no_user");
  });

  test("user JSON emas", () => {
    const data = signInitData(freshFields({ user: "{buzilgan" }));
    assert.equal(reasonOf(() => verifyInitData(TOKEN, data)), "no_user");
  });

  test("user.id son emas", () => {
    const data = signInitData(freshFields({ user: JSON.stringify({ ...USER, id: "55501234" }) }));
    assert.equal(reasonOf(() => verifyInitData(TOKEN, data)), "no_user");
  });
});
