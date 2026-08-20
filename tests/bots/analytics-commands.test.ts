/**
 * Buyruqlar reytingi (§22).
 *
 * Buyruqlar bazaga alohida tur bilan emas, oddiy matn sifatida tushadi
 * (`lib/bots/runtime.ts` → `extractContent` hamma matnni `text` deb yozadi).
 * Shuning uchun reyting matnni normallashtirishga tayanadi — shu qism
 * sinaladi.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { countCommands, normalizeCommand } from "../../lib/bots/analytics";

describe("normalizeCommand", () => {
  test("oddiy buyruq o'zgarishsiz qoladi", () => {
    assert.equal(normalizeCommand("/start"), "/start");
  });

  test("argument tashlanadi", () => {
    assert.equal(normalizeCommand("/start ref123"), "/start");
  });

  test("bot nomi tashlanadi", () => {
    assert.equal(normalizeCommand("/start@my_bot"), "/start");
  });

  test("bot nomi va argument birga", () => {
    assert.equal(normalizeCommand("/start@my_bot ref123"), "/start");
  });

  test("registr pasaytiriladi", () => {
    assert.equal(normalizeCommand("/START"), "/start");
  });

  test("atrofdagi bo'shliq xalaqit bermaydi", () => {
    assert.equal(normalizeCommand("  /help  "), "/help");
  });

  test("pastki chiziqli buyruq qabul qilinadi", () => {
    assert.equal(normalizeCommand("/my_orders"), "/my_orders");
  });

  const rad = [
    ["", "bo'sh"],
    ["salom", "oddiy matn"],
    ["/", "faqat slash"],
    ["/ start", "slashdan keyin bo'shliq"],
    ["so'z /start", "buyruq boshida emas"],
    ["[rasm]", "media belgisi"],
  ] as const;

  for (const [value, nima] of rad) {
    test(`buyruq emas: ${nima}`, () => {
      assert.equal(normalizeCommand(value), null);
    });
  }
});

describe("countCommands", () => {
  test("bir xil buyruqning turli shakllari bitta qatorga yig'iladi", () => {
    const rows = [
      { content: "/start" },
      { content: "/start ref1" },
      { content: "/start@my_bot" },
      { content: "/START" },
    ];
    assert.deepEqual(countCommands(rows), [
      { key: "/start", label: "/start", value: 4 },
    ]);
  });

  test("ko'p ishlatilgani birinchi turadi", () => {
    const rows = [
      { content: "/help" },
      { content: "/start" },
      { content: "/start" },
      { content: "/start" },
      { content: "/menu" },
      { content: "/menu" },
    ];
    assert.deepEqual(
      countCommands(rows).map((r) => [r.label, r.value]),
      [
        ["/start", 3],
        ["/menu", 2],
        ["/help", 1],
      ],
    );
  });

  test("buyruq bo'lmagan matn hisobga olinmaydi", () => {
    const rows = [{ content: "salom" }, { content: "/start" }, { content: "[rasm]" }];
    assert.deepEqual(countCommands(rows), [
      { key: "/start", label: "/start", value: 1 },
    ]);
  });

  test("ko'pi bilan 8 ta qator qaytadi", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ content: `/cmd${i}` }));
    assert.equal(countCommands(rows).length, 8);
  });

  test("bo'sh kirish — bo'sh natija", () => {
    assert.deepEqual(countCommands([]), []);
  });
});
