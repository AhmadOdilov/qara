import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateCondition,
  evaluateRule,
  readField,
  type EventContext,
} from "@/lib/automation/conditions";

const CTX: EventContext = {
  event: { name: "order_created" },
  user: {
    telegramUserId: "42",
    username: "Dilnoza",
    languageCode: "uz",
    phone: null,
    messageCount: 7,
    tags: ["new", "VIP"],
  },
  message: { text: "Salom, buyurtma bermoqchiman" },
  order: { code: "AB12CD", amount: 600_000, currency: "UZS" },
  payment: { provider: "payme", status: "pending" },
};

describe("maydonlarni o'qish", () => {
  it("yopiq ro'yxatdagi yo'llar to'g'ri qiymat beradi", () => {
    assert.equal(readField(CTX, "user.username"), "Dilnoza");
    assert.equal(readField(CTX, "order.amount"), 600_000);
    assert.equal(readField(CTX, "event.name"), "order_created");
    assert.deepEqual(readField(CTX, "user.tags"), ["new", "VIP"]);
  });

  it("bo'sh kontekstda undefined qaytadi, xato emas", () => {
    const empty: EventContext = { event: { name: "user_joined" } };
    assert.equal(readField(empty, "order.amount"), undefined);
    assert.equal(readField(empty, "message.text"), undefined);
  });
});

describe("operatorlar", () => {
  const rule = (
    field: Parameters<typeof readField>[1],
    operator: Parameters<typeof evaluateRule>[1]["operator"],
    value?: string | number | boolean,
  ) => evaluateRule(CTX, { field, operator, value });

  it("equals / not_equals registrga bog'liq emas", () => {
    assert.equal(rule("user.username", "equals", "dilnoza"), true);
    assert.equal(rule("user.username", "equals", "  DILNOZA "), true);
    assert.equal(rule("user.username", "not_equals", "boshqa"), true);
    assert.equal(rule("user.username", "not_equals", "Dilnoza"), false);
  });

  it("contains va starts_with", () => {
    assert.equal(rule("message.text", "contains", "buyurtma"), true);
    assert.equal(rule("message.text", "contains", "xayr"), false);
    assert.equal(rule("message.text", "starts_with", "Salom"), true);
    assert.equal(rule("message.text", "starts_with", "buyurtma"), false);
  });

  it("greater_than / less_than sonlar bilan ishlaydi", () => {
    assert.equal(rule("order.amount", "greater_than", 500_000), true);
    assert.equal(rule("order.amount", "greater_than", 600_000), false);
    assert.equal(rule("order.amount", "less_than", 700_000), true);
    assert.equal(rule("user.messageCount", "greater_than", 5), true);
  });

  it("son bo'lmagan qiymat bilan taqqoslash false beradi", () => {
    assert.equal(rule("user.username", "greater_than", 5), false);
    assert.equal(rule("order.amount", "greater_than", "katta"), false);
  });

  it("exists / not_exists bo'sh qiymatni to'g'ri ajratadi", () => {
    assert.equal(rule("user.username", "exists"), true);
    assert.equal(rule("user.phone", "exists"), false, "null — mavjud emas");
    assert.equal(rule("user.phone", "not_exists"), true);
    assert.equal(rule("order.code", "exists"), true);
  });

  it("bo'sh satr mavjud hisoblanmaydi", () => {
    const blank: EventContext = {
      event: { name: "x" },
      user: { username: "   " },
    };
    assert.equal(evaluateRule(blank, { field: "user.username", operator: "exists" }), false);
  });

  it("teglar ro'yxatida qidiriladi", () => {
    assert.equal(rule("user.tags", "contains", "vip"), true, "registr muhim emas");
    assert.equal(rule("user.tags", "equals", "new"), true);
    assert.equal(rule("user.tags", "contains", "yoq"), false);
    assert.equal(rule("user.tags", "not_equals", "yoq"), true);
  });

  it("qiymatsiz operator (exists'dan boshqa) bajarilmaydi", () => {
    assert.equal(
      evaluateRule(CTX, { field: "user.username", operator: "equals" }),
      false,
    );
  });
});

describe("AND / OR", () => {
  it("qoida bo'lmasa shart har doim bajariladi", () => {
    assert.equal(evaluateCondition(CTX, null), true);
    assert.equal(evaluateCondition(CTX, { op: "and", rules: [] }), true);
    assert.equal(evaluateCondition(CTX, undefined), true);
  });

  it("AND — hammasi bajarilishi kerak", () => {
    assert.equal(
      evaluateCondition(CTX, {
        op: "and",
        rules: [
          { field: "order.amount", operator: "greater_than", value: 500_000 },
          { field: "order.currency", operator: "equals", value: "UZS" },
        ],
      }),
      true,
    );

    assert.equal(
      evaluateCondition(CTX, {
        op: "and",
        rules: [
          { field: "order.amount", operator: "greater_than", value: 500_000 },
          { field: "order.currency", operator: "equals", value: "USD" },
        ],
      }),
      false,
      "bitta qoida bajarilmasa AND yiqiladi",
    );
  });

  it("OR — bittasi yetarli", () => {
    assert.equal(
      evaluateCondition(CTX, {
        op: "or",
        rules: [
          { field: "order.currency", operator: "equals", value: "USD" },
          { field: "user.tags", operator: "contains", value: "vip" },
        ],
      }),
      true,
    );

    assert.equal(
      evaluateCondition(CTX, {
        op: "or",
        rules: [
          { field: "order.currency", operator: "equals", value: "USD" },
          { field: "user.tags", operator: "contains", value: "yoq" },
        ],
      }),
      false,
    );
  });
});
