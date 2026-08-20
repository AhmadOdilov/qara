import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UnconfiguredProvider } from "@/lib/payments/provider";
import type { PaymentProviderId } from "@/lib/payments/types";

/** Sozlanmagan provayder namunasi. */
class Stub extends UnconfiguredProvider {
  readonly id: PaymentProviderId = "payme";
}

describe("sozlanmagan provayder HECH QACHON soxta muvaffaqiyat qaytarmaydi", () => {
  const provider = new Stub();

  it("imkoniyatlari yopiq", () => {
    assert.deepEqual(provider.capabilities(), {
      configured: false,
      refund: false,
      cancel: false,
    });
  });

  it("to'lovni boshlay olmaydi", async () => {
    const result = await provider.initializePayment();
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "not_configured");
  });

  it("callback'ni qabul qilmaydi", async () => {
    const result = await provider.handleCallback();
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 503);
  });

  it("qaytarish va bekor qilish qo'llab-quvvatlanmaydi", async () => {
    const refund = await provider.refundPayment();
    const cancel = await provider.cancelPayment();
    assert.equal(refund.ok, false);
    assert.equal(refund.ok === false && refund.reason, "unsupported");
    assert.equal(cancel.ok, false);
    assert.equal(cancel.ok === false && cancel.reason, "unsupported");
  });

  it("holatni so'ray olmaydi", async () => {
    const result = await provider.getPaymentStatus();
    assert.equal(result.ok, false);
  });
});
