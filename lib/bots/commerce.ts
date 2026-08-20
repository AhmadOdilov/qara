import "server-only";
import { prisma } from "@/lib/db";
import type { BotStatusValue } from "@/components/bots/status";

/**
 * Ish maydonidagi savdo holati (§7).
 *
 * Qara'da alohida «do'kon» ob'ekti yo'q: do'kon — bu botning tugma daraxti.
 * Mahsulot `product` amalli tugma, savat va buyurtma esa o'sha daraxt ustida
 * ishlaydi. Shuning uchun bu modul yangi ma'lumot modeli yaratmaydi —
 * mavjud jadvallardan savdo ko'rsatkichlarini yig'ib beradi.
 *
 * `telegram_bot_payments` hozir BUYURTMA yozuvi sifatida ishlatiladi:
 * `providerPaymentId` bo'sh, chunki to'lov provayderi hali ulanmagan.
 */

/** Do'kon deb hisoblash uchun kamida shuncha mahsulot bo'lishi kerak. */
const MIN_PRODUCTS = 1;

export type StoreSummary = {
  botId: string;
  name: string;
  username: string;
  status: BotStatusValue;
  productCount: number;
  categoryCount: number;
  orderCount: number;
  pendingOrders: number;
  /** Buyurtmalar summasi — faqat `pending` bo'lmaganlari emas, hammasi. */
  grossAmount: number;
  currency: string;
  lastOrderAt: Date | null;
};

/**
 * Ish maydonidagi har bir bot uchun savdo suratini qaytaradi.
 *
 * Bitta so'rovda hamma bot uchun sanaymiz (`groupBy`), keyin xotirada
 * birlashtiramiz — bot soniga qarab so'rov ko'paymasin.
 */
export async function listStores(workspaceId: string): Promise<StoreSummary[]> {
  const bots = await prisma.telegramBot.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, username: true, status: true },
  });

  if (bots.length === 0) return [];

  const botIds = bots.map((bot) => bot.id);

  const [buttons, orderGroups, lastOrders] = await Promise.all([
    prisma.telegramBotButton.groupBy({
      by: ["botId", "actionType"],
      where: { botId: { in: botIds }, actionType: { in: ["product", "category"] } },
      _count: { _all: true },
    }),
    prisma.telegramBotPayment.groupBy({
      by: ["botId", "status", "currency"],
      where: { botId: { in: botIds } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.telegramBotPayment.groupBy({
      by: ["botId"],
      where: { botId: { in: botIds } },
      _max: { createdAt: true },
    }),
  ]);

  const lastByBot = new Map(
    lastOrders.map((row) => [row.botId, row._max.createdAt ?? null]),
  );

  return bots.map((bot) => {
    const productCount = countButtons(buttons, bot.id, "product");
    const categoryCount = countButtons(buttons, bot.id, "category");

    const rows = orderGroups.filter((row) => row.botId === bot.id);
    const orderCount = rows.reduce((total, row) => total + row._count._all, 0);
    const pendingOrders = rows
      .filter((row) => row.status === "pending")
      .reduce((total, row) => total + row._count._all, 0);
    const grossAmount = rows.reduce((total, row) => total + (row._sum.amount ?? 0), 0);

    return {
      botId: bot.id,
      name: bot.name,
      username: bot.username,
      // Baza `String` saqlaydi; qiymatlar to'plami `BotStatusValue` bilan bir xil.
      status: bot.status as BotStatusValue,
      productCount,
      categoryCount,
      orderCount,
      pendingOrders,
      grossAmount,
      // Aralash valyuta bo'lsa birinchisini olamiz — summa baribir ko'rsatkich,
      // hisob-kitob emas. Valyuta yo'q bo'lsa summa ham ko'rsatilmaydi.
      currency: rows[0]?.currency ?? "",
      lastOrderAt: lastByBot.get(bot.id) ?? null,
    };
  });
}

/** Kamida bitta mahsuloti bor bot — do'kon. */
export function isStore(store: StoreSummary): boolean {
  return store.productCount >= MIN_PRODUCTS;
}

function countButtons(
  rows: { botId: string; actionType: string; _count: { _all: number } }[],
  botId: string,
  actionType: string,
): number {
  return (
    rows.find((row) => row.botId === botId && row.actionType === actionType)?._count
      ._all ?? 0
  );
}
