import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/bots/audit";
import {
  canTransition,
  checkAgainstOrder,
  orderStatusFor,
  type PaymentProviderId,
  type PaymentStatus,
  type RejectReason,
} from "@/lib/payments/types";

/**
 * To'lov xizmati (§P3 PHASE 5–7).
 *
 * Uchta kafolat:
 *
 *   1. IDEMPOTENTLIK. Bir xil callback necha marta kelsa ham buyurtma
 *      bir marta to'langan bo'ladi. Himoya `(provider, providerTransactionId)`
 *      unikal indeksida — «avval o'qib, keyin yozish» emas, INSERT. Shuning
 *      uchun bir vaqtda kelgan ikki nusxa poyga hosil qilmaydi.
 *
 *   2. ATOMIKLIK. To'lov va buyurtma holati BITTA tranzaksiyada yangilanadi.
 *      «To'lov PAID, buyurtma PENDING» holati yuzaga kelmaydi.
 *
 *   3. HOLAT MASHINASI. Noto'g'ri o'tish (`failed → paid`) bazaga
 *      yetib bormaydi.
 */

export type ApplyResult =
  | { ok: true; status: PaymentStatus; alreadyApplied: boolean }
  | { ok: false; reason: RejectReason };

/**
 * Buyurtma uchun to'lov urinishini yaratadi.
 *
 * Buyurtma allaqachon to'langan bo'lsa yangi urinish ochilmaydi — foydalanuvchi
 * «to'lash» tugmasini ikki marta bossa ham ikkinchi to'lov boshlanmaydi.
 */
export async function startPayment(input: {
  orderCode: string;
  botId: string;
  provider: PaymentProviderId;
}): Promise<
  { ok: true; transactionId: string; amount: number; currency: string } | {
    ok: false;
    reason: RejectReason;
  }
> {
  const order = await prisma.telegramBotPayment.findFirst({
    where: { botId: input.botId, orderId: input.orderCode },
    select: { id: true, botId: true, amount: true, currency: true, status: true },
  });

  if (!order) return { ok: false, reason: "order_not_found" };
  if (order.status === "paid" || order.status === "refunded") {
    return { ok: false, reason: "already_finalized" };
  }

  // Shu buyurtma va provayder bo'yicha ochiq urinish bo'lsa — qayta
  // ishlatamiz. Aks holda har bosishda yangi yozuv paydo bo'lardi.
  const open = await prisma.telegramBotPaymentTransaction.findFirst({
    where: {
      orderId: order.id,
      provider: input.provider,
      status: { in: ["created", "pending", "processing"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (open) {
    return {
      ok: true,
      transactionId: open.id,
      amount: order.amount,
      currency: order.currency,
    };
  }

  const created = await prisma.telegramBotPaymentTransaction.create({
    data: {
      orderId: order.id,
      botId: order.botId,
      provider: input.provider,
      status: "created",
      amount: order.amount,
      currency: order.currency,
    },
    select: { id: true },
  });

  return {
    ok: true,
    transactionId: created.id,
    amount: order.amount,
    currency: order.currency,
  };
}

/**
 * Provayder callback'ini qo'llaydi.
 *
 * Adapter allaqachon imzoni tekshirgan va nima bo'lishini aytgan; bu yerda
 * ma'lumot buyurtmaga solishtiriladi va atomik yoziladi.
 */
export async function applyCallback(input: {
  botId: string;
  provider: PaymentProviderId;
  providerTransactionId: string;
  orderCode: string;
  amount: number;
  currency: string;
  nextStatus: PaymentStatus;
  metadata?: Record<string, unknown>;
}): Promise<ApplyResult> {
  const order = await prisma.telegramBotPayment.findFirst({
    where: { botId: input.botId, orderId: input.orderCode },
    select: { id: true, botId: true, amount: true, currency: true, status: true },
  });

  // Summa, valyuta, egalik — hammasi yozishdan OLDIN.
  const check = checkAgainstOrder({
    order,
    botId: input.botId,
    amount: input.amount,
    currency: input.currency,
  });
  if (!check.ok) return { ok: false, reason: check.reason };
  if (!order) return { ok: false, reason: "order_not_found" };

  try {
    return await prisma.$transaction(async (tx) => {
      // Provayder tranzaksiyasini BAND QILAMIZ. Unikal indeks tufayli bir
      // vaqtda kelgan ikkinchi callback shu yerda to'xtaydi.
      let record = await tx.telegramBotPaymentTransaction.findUnique({
        where: {
          provider_providerTransactionId: {
            provider: input.provider,
            providerTransactionId: input.providerTransactionId,
          },
        },
        select: { id: true, status: true, orderId: true, amount: true, currency: true },
      });

      if (!record) {
        // Ochiq urinishni shu provayder tranzaksiyasiga bog'laymiz.
        const open = await tx.telegramBotPaymentTransaction.findFirst({
          where: {
            orderId: order.id,
            provider: input.provider,
            providerTransactionId: null,
            status: { in: ["created", "pending", "processing"] },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, orderId: true, amount: true, currency: true },
        });

        record = open
          ? await tx.telegramBotPaymentTransaction.update({
              where: { id: open.id },
              data: { providerTransactionId: input.providerTransactionId },
              select: {
                id: true,
                status: true,
                orderId: true,
                amount: true,
                currency: true,
              },
            })
          : await tx.telegramBotPaymentTransaction.create({
              data: {
                orderId: order.id,
                botId: order.botId,
                provider: input.provider,
                providerTransactionId: input.providerTransactionId,
                status: "created",
                amount: input.amount,
                currency: input.currency,
              },
              select: {
                id: true,
                status: true,
                orderId: true,
                amount: true,
                currency: true,
              },
            });
      }

      const current = record.status as PaymentStatus;

      // Takroriy callback — hech narsa o'zgarmaydi, lekin XATO ham emas.
      if (current === input.nextStatus) {
        return { ok: true as const, status: current, alreadyApplied: true };
      }

      if (!canTransition(current, input.nextStatus)) {
        return { ok: false as const, reason: "invalid_state" as RejectReason };
      }

      await tx.telegramBotPaymentTransaction.update({
        where: { id: record.id },
        data: {
          status: input.nextStatus,
          paidAt: input.nextStatus === "paid" ? new Date() : undefined,
          cancelledAt:
            input.nextStatus === "cancelled" || input.nextStatus === "expired"
              ? new Date()
              : undefined,
          metadata: input.metadata
            ? (input.metadata as Prisma.InputJsonValue)
            : undefined,
        },
      });

      // Buyurtma holati AYNAN shu tranzaksiyada yangilanadi.
      await tx.telegramBotPayment.update({
        where: { id: order.id },
        data: {
          status: orderStatusFor(input.nextStatus),
          providerPaymentId: input.providerTransactionId,
        },
      });

      return { ok: true as const, status: input.nextStatus, alreadyApplied: false };
    });
  } catch (error) {
    // Unikal cheklov — ikkinchi parallel callback. Bu XATO emas: birinchisi
    // ishni bajargan, natija bir xil.
    if (isUniqueViolation(error)) {
      const existing = await prisma.telegramBotPaymentTransaction.findUnique({
        where: {
          provider_providerTransactionId: {
            provider: input.provider,
            providerTransactionId: input.providerTransactionId,
          },
        },
        select: { status: true },
      });
      if (existing) {
        return {
          ok: true,
          status: existing.status as PaymentStatus,
          alreadyApplied: true,
        };
      }
    }
    throw error;
  }
}

/** Buyurtma va uning to'lov urinishlari — admin va foydalanuvchi uchun. */
export async function orderWithPayments(botId: string, orderCode: string) {
  return prisma.telegramBotPayment.findFirst({
    where: { botId, orderId: orderCode },
    select: {
      id: true,
      orderId: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
      transactions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          provider: true,
          providerTransactionId: true,
          status: true,
          amount: true,
          currency: true,
          paidAt: true,
          cancelledAt: true,
          failureReason: true,
          createdAt: true,
        },
      },
    },
  });
}

/** Audit — sirlar yozilmaydi, faqat identifikatorlar. */
export async function auditPayment(
  event: string,
  input: {
    botId: string;
    provider: PaymentProviderId;
    orderCode: string;
    providerTransactionId?: string;
    status?: string;
    reason?: string;
  },
): Promise<void> {
  await audit("PAYMENT_UPDATED", {
    botId: input.botId,
    metadata: {
      event,
      provider: input.provider,
      orderCode: input.orderCode,
      providerTransactionId: input.providerTransactionId ?? null,
      status: input.status ?? null,
      reason: input.reason ?? null,
    },
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
