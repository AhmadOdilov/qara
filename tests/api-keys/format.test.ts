/**
 * API kalitlarining sir bilan bog'liq qismi.
 *
 * Bu testlar "ishlaydimi" degan savolga emas, "sir sizib chiqmaydimi" degan
 * savolga javob beradi: xesh qaytarilmasligi, maskada to'liq qiymat
 * qolmasligi va formatga to'g'ri kelmagan qiymat bazagacha yetib bormasligi.
 *
 * Bazasiz: tekshirilayotgan uch funksiya ham sof.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  API_KEY_PREFIX,
  hashApiKey,
  looksLikeApiKey,
  maskApiKey,
} from "../../lib/api-keys";

describe("hashApiKey", () => {
  test("bir xil kalit — bir xil xesh (qidiruv indeks bo'yicha ketadi)", () => {
    const key = `${API_KEY_PREFIX}_abcdefghijklmnopqrstuvwxyz012345`;
    assert.equal(hashApiKey(key), hashApiKey(key));
  });

  test("SHA-256: 64 ta hex belgi", () => {
    const hash = hashApiKey("nimadir");
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  test("bir belgi farq qilsa xesh butunlay boshqacha", () => {
    const a = hashApiKey(`${API_KEY_PREFIX}_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`);
    const b = hashApiKey(`${API_KEY_PREFIX}_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab`);
    assert.notEqual(a, b);
  });

  test("xeshda kalitning o'zi qolmaydi", () => {
    const key = `${API_KEY_PREFIX}_sirlisirlisirlisirlisirlisirli12`;
    assert.ok(!hashApiKey(key).includes(key));
    assert.ok(!hashApiKey(key).includes("sirli"));
  });
});

describe("maskApiKey", () => {
  test("faqat prefiks va oxirgi 4 belgi ko'rinadi", () => {
    assert.equal(maskApiKey("qara_sk", "9xYz"), "qara_sk_••••••9xYz");
  });

  test("maskaning uzunligi kalit uzunligini oshkor qilmaydi", () => {
    const qisqa = maskApiKey("qara_sk", "abcd");
    const uzun = maskApiKey("qara_sk", "wxyz");
    assert.equal(qisqa.length, uzun.length);
  });
});

describe("looksLikeApiKey", () => {
  test("shu ilova bergan shakl qabul qilinadi", () => {
    assert.ok(looksLikeApiKey(`${API_KEY_PREFIX}_abcdefghijklmnopqrstuvwxyz012345`));
  });

  test("atrofdagi bo'shliq xalaqit bermaydi", () => {
    assert.ok(looksLikeApiKey(`  ${API_KEY_PREFIX}_abcdefghijklmnopqrstuvwxyz012345\n`));
  });

  const rad = [
    ["", "bo'sh"],
    ["qara_sk_", "faqat prefiks"],
    ["qara_sk_qisqa", "juda qisqa"],
    ["boshqa_sk_abcdefghijklmnopqrstuvwxyz012345", "begona prefiks"],
    ["qara_sk_abcdefghijklmnopqrstuvwxyz01234!", "ruxsatsiz belgi"],
    ["123456789:AAHqweqweqweqweqweqweqweqweqweqwe", "Telegram tokeni"],
    ["' OR 1=1 --", "SQL urinishi"],
  ] as const;

  for (const [value, nima] of rad) {
    test(`rad etiladi: ${nima}`, () => {
      assert.equal(looksLikeApiKey(value), false);
    });
  }
});
