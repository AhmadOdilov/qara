/**
 * «Botlarim» ro'yxatidagi qidiruv, filtr va saralash (§20).
 *
 * Bazasiz va komponentsiz: mantiq `lib/bots/list-filter` da sof funksiya.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  applyFilters,
  type FilterableBot,
} from "../../lib/bots/list-filter";

function bot(partial: Partial<FilterableBot> & { name: string }): FilterableBot {
  return {
    username: partial.name.toLowerCase().replace(/\s+/g, "_") + "_bot",
    description: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const dokon = bot({
  name: "Do'kon",
  username: "dokon_bot",
  description: "Mahsulot sotadi",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
});
const yordam = bot({
  name: "Yordam",
  username: "support_bot",
  description: "Savollarga javob beradi",
  status: "setup_required",
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-10T00:00:00.000Z",
});
const buyurtma = bot({
  name: "Buyurtma",
  username: "order_bot",
  description: null,
  status: "error",
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-01-05T00:00:00.000Z",
});

const hammasi = [dokon, yordam, buyurtma];

describe("filtr", () => {
  test("«hammasi» hech kimni chiqarib tashlamaydi", () => {
    assert.equal(applyFilters(hammasi, "", "all", "recent").length, 3);
  });

  test("«faol» — faqat active", () => {
    const result = applyFilters(hammasi, "", "active", "recent");
    assert.deepEqual(
      result.map((b) => b.name),
      ["Do'kon"],
    );
  });

  test("«faol emas» — sozlanmagan va xatolik ham kiradi", () => {
    const result = applyFilters(hammasi, "", "inactive", "recent");
    assert.deepEqual(
      result.map((b) => b.name).sort(),
      ["Buyurtma", "Yordam"],
    );
  });
});

describe("qidiruv", () => {
  test("nom bo'yicha topadi", () => {
    const result = applyFilters(hammasi, "do'kon", "all", "recent");
    assert.deepEqual(
      result.map((b) => b.name),
      ["Do'kon"],
    );
  });

  test("username bo'yicha topadi (nomi boshqacha bo'lsa ham)", () => {
    const result = applyFilters(hammasi, "support", "all", "recent");
    assert.deepEqual(
      result.map((b) => b.name),
      ["Yordam"],
    );
  });

  test("tavsif bo'yicha ham topadi", () => {
    const result = applyFilters(hammasi, "savollarga", "all", "recent");
    assert.deepEqual(
      result.map((b) => b.name),
      ["Yordam"],
    );
  });

  test("registr ahamiyatsiz", () => {
    assert.equal(applyFilters(hammasi, "SUPPORT", "all", "recent").length, 1);
  });

  test("faqat bo'shliqdan iborat so'rov filtrlamaydi", () => {
    assert.equal(applyFilters(hammasi, "   ", "all", "recent").length, 3);
  });

  test("tavsifi yo'q bot qidiruvda xato bermaydi", () => {
    assert.equal(applyFilters([buyurtma], "mahsulot", "all", "recent").length, 0);
  });

  test("qidiruv va filtr birga ishlaydi", () => {
    // «bot» hammasining username'ida bor, lekin faol bo'lgani bitta.
    const result = applyFilters(hammasi, "bot", "active", "recent");
    assert.deepEqual(
      result.map((b) => b.name),
      ["Do'kon"],
    );
  });

  test("mos kelmasa bo'sh ro'yxat", () => {
    assert.deepEqual(applyFilters(hammasi, "yo'q-bunday-bot", "all", "recent"), []);
  });
});

describe("saralash", () => {
  test("«oxirgi o'zgargan» — updatedAt bo'yicha kamayish tartibida", () => {
    const result = applyFilters(hammasi, "", "all", "recent");
    assert.deepEqual(
      result.map((b) => b.name),
      ["Do'kon", "Yordam", "Buyurtma"],
    );
  });

  test("«yaratilgan sana» — createdAt bo'yicha, updatedAt dan farqli", () => {
    const result = applyFilters(hammasi, "", "all", "created");
    assert.deepEqual(
      result.map((b) => b.name),
      ["Buyurtma", "Yordam", "Do'kon"],
    );
  });

  test("«nomi bo'yicha» — alifbo tartibida", () => {
    const result = applyFilters(hammasi, "", "all", "name");
    assert.deepEqual(
      result.map((b) => b.name),
      ["Buyurtma", "Do'kon", "Yordam"],
    );
  });
});

describe("chaqiruvchining ro'yxati o'zgarmaydi", () => {
  test("saralash asl massivni joyida almashtirmaydi", () => {
    const asl = [...hammasi];
    applyFilters(hammasi, "", "all", "name");
    assert.deepEqual(hammasi, asl, "kirish massivi o'zgarib ketdi");
  });
});
