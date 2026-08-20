import "server-only";
import { prisma } from "@/lib/db";
import type { BarRow, SeriesPoint } from "@/components/charts";

/**
 * Ish maydoni analitikasi (§22).
 *
 * Platforma analitikasidan (`lib/stats.ts`, faqat admin uchun) farqi: bu yerda
 * FAQAT shu workspace'ning botlari hisoblanadi. Har bir so'rov `botId in
 * (...)` bilan cheklanadi — begona ish maydonining raqami hech qachon
 * ko'rinmaydi.
 *
 * Barcha jadvallarda `(botId, createdAt)` indeksi bor, shuning uchun davr
 * bo'yicha so'rovlar indeksdan foydalanadi.
 *
 * DIQQAT: `telegram_bot_messages.direction` — enum emas, oddiy matn va
 * `runtime.ts` unga `in`/`out` yozadi (platformadagi `messages` jadvalidagi
 * `incoming`/`outgoing` enum'i bilan adashtirmang).
 */

/** `lib/bots/runtime.ts` yozadigan qiymatlar. */
const INCOMING = "in";
const OUTGOING = "out";

export type BotAnalytics = {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  messages: number;
  incoming: number;
  outgoing: number;
  buttonClicks: number;
  series: SeriesPoint[];
  topButtons: BarRow[];
  topCommands: BarRow[];
  topBots: BarRow[];
};

export function periodStart(days: number): Date {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  return since;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Bo'sh kunlar nol bilan to'ldiriladi — aks holda chiziq bo'shliqni sakrab o'tadi. */
function emptyBuckets(since: Date, days: number) {
  const buckets = new Map<string, { sent: number; received: number }>();
  for (let i = 0; i < days; i++) {
    const date = new Date(since);
    date.setDate(date.getDate() + i);
    buckets.set(isoDay(date), { sent: 0, received: 0 });
  }
  return buckets;
}

/**
 * `/start@my_bot ref123` → `/start`. Argument va bot nomi tashlanadi,
 * registr pasaytiriladi — aks holda bitta buyruq bir necha qatorga bo'linib
 * ketadi va reyting ma'nosini yo'qotadi.
 */
export function normalizeCommand(content: string): string | null {
  const first = content.trim().split(/\s+/)[0] ?? "";
  const match = /^\/([A-Za-z0-9_]{1,32})/.exec(first);
  return match ? `/${match[1].toLowerCase()}` : null;
}

/** Eng ko'p ishlatilgan 8 ta buyruq. */
export function countCommands(rows: { content: string }[]): BarRow[] {
  const tally = new Map<string, number>();
  for (const row of rows) {
    const command = normalizeCommand(row.content);
    if (!command) continue;
    tally.set(command, (tally.get(command) ?? 0) + 1);
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ key: label, label, value }));
}

export async function getWorkspaceAnalytics(
  workspaceId: string,
  days: number,
): Promise<BotAnalytics> {
  const since = periodStart(days);

  const bots = await prisma.telegramBot.findMany({
    where: { workspaceId },
    select: { id: true, name: true },
  });
  const botIds = bots.map((b) => b.id);

  // Bot yo'q bo'lsa hech qanday so'rov yubormaymiz — `in: []` bekorga ketardi.
  if (botIds.length === 0) {
    return {
      totalUsers: 0,
      newUsers: 0,
      activeUsers: 0,
      messages: 0,
      incoming: 0,
      outgoing: 0,
      buttonClicks: 0,
      series: [...emptyBuckets(since, days)].map(([day, c]) => ({ day, ...c })),
      topButtons: [],
      topCommands: [],
      topBots: [],
    };
  }

  const [
    totalUsers,
    newUsers,
    activeUsers,
    buttonClicks,
    messageRows,
    buttonRows,
    commandRows,
    perBot,
  ] = await Promise.all([
    prisma.telegramBotUser.count({ where: { botId: { in: botIds } } }),
    prisma.telegramBotUser.count({
      where: { botId: { in: botIds }, createdAt: { gte: since } },
    }),
    prisma.telegramBotUser.count({
      where: { botId: { in: botIds }, lastActiveAt: { gte: since } },
    }),
    prisma.telegramBotButtonEvent.count({
      where: { botId: { in: botIds }, eventType: "click", createdAt: { gte: since } },
    }),

    // Kunlik chiziq uchun: sana + yo'nalish yetarli, matn tortilmaydi.
    prisma.telegramBotMessage.findMany({
      where: { botId: { in: botIds }, createdAt: { gte: since } },
      select: { createdAt: true, direction: true },
    }),

    prisma.telegramBotButtonEvent.groupBy({
      by: ["buttonId"],
      where: { botId: { in: botIds }, eventType: "click", createdAt: { gte: since } },
      _count: { buttonId: true },
      orderBy: { _count: { buttonId: "desc" } },
      take: 8,
    }),

    // Buyruqlar alohida `messageType` bilan yozilmaydi — ular oddiy matn
    // bo'lib keladi va `/` bilan boshlanadi. Shuning uchun bazadan `/` bilan
    // boshlanadiganlarini olib, argument va `@botnomi` qismini tashlab,
    // xotirada guruhlaymiz: `/start`, `/start ref123` va `/start@my_bot` —
    // bitta buyruq.
    prisma.telegramBotMessage.findMany({
      where: {
        botId: { in: botIds },
        direction: INCOMING,
        content: { startsWith: "/" },
        createdAt: { gte: since },
      },
      select: { content: true },
    }),

    prisma.telegramBotMessage.groupBy({
      by: ["botId"],
      where: { botId: { in: botIds }, createdAt: { gte: since } },
      _count: { botId: true },
      orderBy: { _count: { botId: "desc" } },
      take: 8,
    }),
  ]);

  const buckets = emptyBuckets(since, days);
  let incoming = 0;
  let outgoing = 0;
  for (const row of messageRows) {
    const isOutgoing = row.direction === OUTGOING;
    if (isOutgoing) outgoing += 1;
    else incoming += 1;

    const bucket = buckets.get(isoDay(row.createdAt));
    if (!bucket) continue;
    if (isOutgoing) bucket.sent += 1;
    else bucket.received += 1;
  }

  // Tugma nomlari alohida so'rovda — `groupBy` bog'langan jadvalni qo'shmaydi.
  const buttonNames = new Map<string, string>();
  if (buttonRows.length > 0) {
    const buttons = await prisma.telegramBotButton.findMany({
      where: { id: { in: buttonRows.map((r) => r.buttonId) } },
      select: { id: true, text: true, emoji: true },
    });
    for (const b of buttons) {
      buttonNames.set(b.id, `${b.emoji ? `${b.emoji} ` : ""}${b.text}`);
    }
  }

  const botNames = new Map(bots.map((b) => [b.id, b.name]));

  return {
    totalUsers,
    newUsers,
    activeUsers,
    messages: messageRows.length,
    incoming,
    outgoing,
    buttonClicks,
    series: [...buckets.entries()].map(([day, counts]) => ({ day, ...counts })),
    topButtons: buttonRows.map((row) => ({
      key: row.buttonId,
      // O'chirilgan tugma nomsiz qolishi mumkin — raqam baribir ko'rsatiladi.
      label: buttonNames.get(row.buttonId) ?? "—",
      value: row._count.buttonId,
    })),
    topCommands: countCommands(commandRows),
    topBots: perBot.map((row) => ({
      key: row.botId,
      label: botNames.get(row.botId) ?? "—",
      value: row._count.botId,
    })),
  };
}
