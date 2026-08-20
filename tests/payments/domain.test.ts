import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canTransition,
  checkAgainstOrder,
  isPaymentStatus,
  isProviderId,
  isTerminal,
  orderStatusFor,
  PAYMENT_STATUSES,
  type PaymentStatus,
} from "@/lib/payments/types";

const ORDER = {
  botId: "bot-1",
  amount: 45_000,
  currency: "UZS",
  status: "pending",
};

describe("holat mashinasi", () => {
  it("oddiy yo'l: created → pending → processing → paid", () => {
    assert.ok(canTransition("created", "pending"));
    assert.ok(canTransition("pending", "processing"));
    assert.ok(canTransition("processing", "paid"));
  });

  it("to'g'ridan-to'g'ri to'lash ham mumkin", () => {
    assert.ok(canTransition("created", "paid"));
    assert.ok(canTransition("pending", "paid"));
  });

  it("MUVAFFAQIYATSIZ to'lov keyin to'langan bo'lib qola olmaydi", () => {
    assert.equal(canTransition("failed", "paid"), false);
    assert.equal(canTransition("expired", "paid"), false);
    assert.equal(canTransition("cancelled", "paid"), false);
  });

  it("qaytarilgan to'lov qayta to'langan bo'lmaydi", () => {
    assert.equal(canTransition("refunded", "paid"), false);
    assert.equal(canTransition("refunded", "pending"), false);
  });

  it("faqat to'langanni qaytarish mumkin", () => {
    assert.ok(canTransition("paid", "refunded"));
    assert.equal(canTransition("pending", "refunded"), false);
    assert.equal(canTransition("failed", "refunded"), false);
  });

  it("to'langandan keyin bekor qilib bo'lmaydi", () => {
    assert.equal(canTransition("paid", "cancelled"), false);
    assert.equal(canTransition("paid", "failed"), false);
    assert.equal(canTransition("paid", "expired"), false);
  });

  it("bir xil holatga o'tish har doim mumkin — takroriy callback", () => {
    for (const status of PAYMENT_STATUSES) {
      assert.ok(canTransition(status, status), status);
    }
  });

  it("yakuniy holatlar aniq", () => {
    assert.equal(isTerminal("failed"), true);
    assert.equal(isTerminal("expired"), true);
    assert.equal(isTerminal("cancelled"), true);
    assert.equal(isTerminal("refunded"), true);
    assert.equal(isTerminal("paid"), false, "to'langanni qaytarish mumkin");
    assert.equal(isTerminal("pending"), false);
  });
});

describe("buyurtma holatiga moslash", () => {
  it("to'lov holati buyurtma holatini belgilaydi", () => {
    const cases: [PaymentStatus, string][] = [
      ["created", "pending"],
      ["pending", "pending"],
      ["processing", "pending"],
      ["paid", "paid"],
      ["failed", "failed"],
      ["expired", "cancelled"],
      ["cancelled", "cancelled"],
      ["refunded", "refunded"],
    ];
    for (const [payment, order] of cases) {
      assert.equal(orderStatusFor(payment), order, payment);
    }
  });
});

describe("callback buyurtmaga solishtiriladi", () => {
  it("hammasi mos bo'lsa qabul qilinadi", () => {
    const result = checkAgainstOrder({
      order: ORDER,
      botId: "bot-1",
      amount: 45_000,
      currency: "UZS",
    });
    assert.deepEqual(result, { ok: true });
  });

  it("buyurtma topilmasa rad etiladi", () => {
    const result = checkAgainstOrder({
      order: null,
      botId: "bot-1",
      amount: 45_000,
      currency: "UZS",
    });
    assert.deepEqual(result, { ok: false, reason: "order_not_found" });
  });

  it("SUMMA farq qilsa rad etiladi — manipulyatsiyaga yo'l yo'q", () => {
    for (const amount of [1, 44_999, 45_001, 450_000, 0]) {
      const result = checkAgainstOrder({
        order: ORDER,
        botId: "bot-1",
        amount,
        currency: "UZS",
      });
      assert.deepEqual(
        result,
        { ok: false, reason: "amount_mismatch" },
        `summa ${amount}`,
      );
    }
  });

  it("VALYUTA farq qilsa rad etiladi", () => {
    const result = checkAgainstOrder({
      order: ORDER,
      botId: "bot-1",
      amount: 45_000,
      currency: "USD",
    });
    assert.deepEqual(result, { ok: false, reason: "currency_mismatch" });
  });

  it("valyuta registri e'tiborga olinmaydi", () => {
    const result = checkAgainstOrder({
      order: ORDER,
      botId: "bot-1",
      amount: 45_000,
      currency: "uzs",
    });
    assert.deepEqual(result, { ok: true });
  });

  it("BOSHQA botning buyurtmasi rad etiladi — ish maydoni izolyatsiyasi", () => {
    const result = checkAgainstOrder({
      order: ORDER,
      botId: "bot-2",
      amount: 45_000,
      currency: "UZS",
    });
    assert.deepEqual(result, { ok: false, reason: "wrong_bot" });
  });

  it("tekshiruv tartibi: avval mavjudlik, keyin egalik, keyin summa", () => {
    // Begona bot VA noto'g'ri summa — egalik xatosi birinchi aytiladi,
    // ya'ni summa haqida ma'lumot sizib chiqmaydi.
    const result = checkAgainstOrder({
      order: ORDER,
      botId: "bot-2",
      amount: 999,
      currency: "USD",
    });
    assert.deepEqual(result, { ok: false, reason: "wrong_bot" });
  });
});

describe("tur qo'riqchilari", () => {
  it("noma'lum holat qabul qilinmaydi", () => {
    assert.equal(isPaymentStatus("paid"), true);
    assert.equal(isPaymentStatus("PAID"), false);
    assert.equal(isPaymentStatus("done"), false);
    assert.equal(isPaymentStatus(null), false);
  });

  it("noma'lum provayder qabul qilinmaydi", () => {
    assert.equal(isProviderId("payme"), true);
    assert.equal(isProviderId("click"), true);
    assert.equal(isProviderId("stripe"), false);
    assert.equal(isProviderId(undefined), false);
  });
});
