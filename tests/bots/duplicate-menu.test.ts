/**
 * Nusxalashda menyu daraxtini rejaga o'girish (§28, §10).
 *
 * Eng nozik joyi — chuqurlik: jonli bot daraxti istalgancha chuqur bo'lishi
 * mumkin, reja sxemasi esa ikki qatlam bilan cheklangan. Tushib qolgan
 * shoxlar JIM YO'QOLMASLIGI kerak — ular sanaladi va foydalanuvchiga
 * aytiladi. Shu xatti-harakat mana shu yerda qulflanadi.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { buildMenuFromButtons } from "../../lib/bots/duplicate";

type Row = Parameters<typeof buildMenuFromButtons>[0][number];

function row(partial: Partial<Row> & { id: string }): Row {
  return {
    parentId: null,
    text: partial.id,
    emoji: null,
    actionType: "send_message",
    actionConfig: {},
    sortOrder: 0,
    ...partial,
  };
}

describe("ildiz menyusi", () => {
  test("tartib `sortOrder` bo'yicha saqlanadi", () => {
    const { menu } = buildMenuFromButtons([
      row({ id: "b", text: "Ikkinchi", sortOrder: 1 }),
      row({ id: "a", text: "Birinchi", sortOrder: 0 }),
      row({ id: "c", text: "Uchinchi", sortOrder: 2 }),
    ]);
    assert.deepEqual(
      menu.map((item) => item.text),
      ["Birinchi", "Ikkinchi", "Uchinchi"],
    );
  });

  test("javob matni `actionConfig.text` dan olinadi", () => {
    const { menu } = buildMenuFromButtons([
      row({ id: "a", text: "Narxlar", actionConfig: { text: "Oylik 100 000" } }),
    ]);
    assert.equal(menu[0].reply, "Oylik 100 000");
  });

  test("matnsiz amalda javob bo'sh qoladi, xato bo'lmaydi", () => {
    const { menu } = buildMenuFromButtons([
      row({ id: "a", actionType: "collect_phone", actionConfig: {} }),
    ]);
    assert.equal(menu[0].reply, "");
    assert.equal(menu[0].actionType, "collect_phone");
  });

  test("emoji ko'chiriladi, yo'q bo'lsa bo'sh satr", () => {
    const { menu } = buildMenuFromButtons([
      row({ id: "a", emoji: "📚" }),
      row({ id: "b", emoji: null, sortOrder: 1 }),
    ]);
    assert.equal(menu[0].emoji, "📚");
    assert.equal(menu[1].emoji, "");
  });

  test("notanish amal `send_message` ga tushiriladi", () => {
    const { menu } = buildMenuFromButtons([
      row({ id: "a", actionType: "kelajakdagi_amal" }),
    ]);
    assert.equal(menu[0].actionType, "send_message");
  });
});

describe("ichma-ich menyu", () => {
  const tree = [
    row({ id: "courses", text: "Kurslar", sortOrder: 0 }),
    row({ id: "python", text: "Python", parentId: "courses", sortOrder: 0 }),
    row({ id: "java", text: "Java", parentId: "courses", sortOrder: 1 }),
    row({ id: "pricing", text: "Narxlar", sortOrder: 1 }),
  ];

  test("bolalar ota tugmaga biriktiriladi", () => {
    const { menu } = buildMenuFromButtons(tree);
    assert.deepEqual(
      menu.map((item) => item.text),
      ["Kurslar", "Narxlar"],
    );
    assert.deepEqual(
      menu[0].children.map((child) => child.text),
      ["Python", "Java"],
    );
    assert.deepEqual(menu[1].children, []);
  });

  test("ikki qatlamli daraxtda hech narsa tushib qolmaydi", () => {
    const { droppedDeeper } = buildMenuFromButtons(tree);
    assert.equal(droppedDeeper, 0);
  });
});

describe("uch va undan chuqur qatlamlar", () => {
  const deep = [
    row({ id: "courses", text: "Kurslar" }),
    row({ id: "python", text: "Python", parentId: "courses" }),
    row({ id: "basic", text: "Boshlang'ich", parentId: "python" }),
    row({ id: "advanced", text: "Ilg'or", parentId: "python" }),
    row({ id: "lesson1", text: "1-dars", parentId: "basic" }),
  ];

  test("uchinchi qatlam rejaga tushmaydi", () => {
    const { menu } = buildMenuFromButtons(deep);
    assert.deepEqual(
      menu[0].children.map((child) => child.text),
      ["Python"],
    );
    // `children` — yassi ro'yxat, uning o'z bolalari yo'q.
    assert.equal(Object.hasOwn(menu[0].children[0], "children"), false);
  });

  test("tushib qolganlar JIM yo'qolmaydi — sanaladi", () => {
    const { droppedDeeper } = buildMenuFromButtons(deep);
    // Python ostidagi: Boshlang'ich, Ilg'or, 1-dars
    assert.equal(droppedDeeper, 3);
  });
});

describe("Telegram/reja cheklovlari", () => {
  test("ildizda ko'pi bilan 12 ta tugma", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      row({ id: `b${i}`, text: `Tugma ${i}`, sortOrder: i }),
    );
    assert.equal(buildMenuFromButtons(many).menu.length, 12);
  });

  test("bitta tugma ostida ko'pi bilan 10 ta bola", () => {
    const rows = [
      row({ id: "root", text: "Ildiz" }),
      ...Array.from({ length: 15 }, (_, i) =>
        row({ id: `c${i}`, text: `Bola ${i}`, parentId: "root", sortOrder: i }),
      ),
    ];
    assert.equal(buildMenuFromButtons(rows).menu[0].children.length, 10);
  });

  test("bo'sh daraxt — bo'sh menyu, xatosiz", () => {
    assert.deepEqual(buildMenuFromButtons([]), { menu: [], droppedDeeper: 0 });
  });

  test("otasi yo'q (yetim) tugma ildizga chiqib ketmaydi", () => {
    const { menu } = buildMenuFromButtons([
      row({ id: "a", text: "Ildiz" }),
      row({ id: "orphan", text: "Yetim", parentId: "yoq_bunday_id" }),
    ]);
    assert.deepEqual(
      menu.map((item) => item.text),
      ["Ildiz"],
    );
  });
});
