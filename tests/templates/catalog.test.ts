/**
 * Shablon katalogi (§21).
 *
 * Sahifa `lib/ai/planner` dagi retseptlar ro'yxatidan oziqlanadi — ya'ni AI
 * zaxira generatori ishlatadigan AYNAN O'SHA katalogdan. Shu bog'liqlik
 * saqlanayotganini ham shu yerda tekshiramiz: yangi retsept qo'shilsa
 * shablonlar sahifasida o'zi paydo bo'lishi kerak.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  categoryOf,
  filterByCategory,
  usedCategories,
  TEMPLATE_CATEGORIES,
} from "../../lib/ai/template-catalog";
import { templateCards } from "../../lib/ai/planner";
import { featureLabel } from "../../lib/ai/blueprint";

const cards = templateCards();

describe("katalog to'liq va ishlatishga yaroqli", () => {
  test("shablonlar bor", () => {
    assert.ok(cards.length >= 8, `kutilgan 8+, keldi ${cards.length}`);
  });

  test("har bir shablonda ko'rsatish uchun hamma narsa bor", () => {
    for (const card of cards) {
      assert.ok(card.id, "id bo'sh");
      assert.ok(card.title.length > 0, `${card.id}: sarlavha bo'sh`);
      assert.ok(card.emoji.length > 0, `${card.id}: emoji bo'sh`);
      assert.ok(card.tagline.length > 0, `${card.id}: tavsif bo'sh`);
      assert.ok(card.features.length > 0, `${card.id}: funksiya yo'q`);
    }
  });

  test("id'lar takrorlanmaydi (havola `/build?template=<id>` aniq bo'lsin)", () => {
    const ids = cards.map((card) => card.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("har bir funksiya id'si yorliqqa ega — kartada xom id chiqmaydi", () => {
    for (const card of cards) {
      for (const id of card.features) {
        const label = featureLabel(id);
        assert.notEqual(label.label, id, `${card.id}: «${id}» uchun yorliq yo'q`);
      }
    }
  });
});

describe("turkumlash", () => {
  test("har bir shablon bitta turkumga tushadi", () => {
    for (const card of cards) {
      assert.ok(
        TEMPLATE_CATEGORIES.includes(categoryOf(card.id)),
        `${card.id}: noma'lum turkum`,
      );
    }
  });

  test("noma'lum tur `other` ga tushadi — katalogdan yo'qolmaydi", () => {
    assert.equal(categoryOf("hali_yoq_biznes_turi"), "other");
  });

  test("ma'lum turlar kutilgan turkumda", () => {
    assert.equal(categoryOf("ecommerce"), "sales");
    assert.equal(categoryOf("restaurant"), "food");
    assert.equal(categoryOf("beauty"), "services");
    assert.equal(categoryOf("education"), "education");
    assert.equal(categoryOf("support"), "support");
  });
});

describe("filtr", () => {
  test("turkumsiz filtr hammasini qaytaradi", () => {
    assert.equal(filterByCategory(cards, null).length, cards.length);
  });

  test("har bir ishlatilgan turkumda kamida bitta shablon bor", () => {
    for (const category of usedCategories(cards)) {
      assert.ok(
        filterByCategory(cards, category).length > 0,
        `«${category}» chipi bo'sh ro'yxat beradi`,
      );
    }
  });

  test("turkumlar yig'indisi butun katalogga teng — hech biri yo'qolmaydi", () => {
    const total = usedCategories(cards).reduce(
      (sum, category) => sum + filterByCategory(cards, category).length,
      0,
    );
    assert.equal(total, cards.length);
  });

  test("filtr chaqiruvchining ro'yxatini o'zgartirmaydi", () => {
    const before = cards.map((card) => card.id);
    filterByCategory(cards, "sales");
    assert.deepEqual(
      cards.map((card) => card.id),
      before,
    );
  });
});
