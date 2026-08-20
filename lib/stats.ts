import "server-only";
import { prisma } from "@/lib/db";
import type { SeriesPoint } from "@/components/charts";

export type Overview = {
  users: number;
  linkedUsers: number;
  messages: number;
  activeToday: number;
  signups: number;
  avgPerUser: number;
  linkRate: number;
};

export async function getOverview(since: Date): Promise<Overview> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [users, linkedUsers, messages, activeToday, signups] = await Promise.all([
    prisma.user.count(),
    prisma.telegramLink.count({ where: { connectedAt: { not: null } } }),
    prisma.message.count({ where: { timestamp: { gte: since } } }),
    prisma.message
      .findMany({
        where: { timestamp: { gte: startOfToday } },
        distinct: ["userId"],
        select: { userId: true },
      })
      .then((rows) => rows.length),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
  ]);

  return {
    users,
    linkedUsers,
    messages,
    activeToday,
    signups,
    avgPerUser: users ? Math.round((messages / users) * 10) / 10 : 0,
    linkRate: users ? Math.round((linkedUsers / users) * 100) : 0,
  };
}

/**
 * Kunlik xabarlar. Bo'sh kunlar ham nol bilan to'ldiriladi — aks holda
 * chiziq bo'shliqlarni "sakrab" o'tib, dinamikani noto'g'ri ko'rsatadi.
 */
export async function getDailySeries(
  since: Date,
  days: number,
  userId?: string,
): Promise<SeriesPoint[]> {
  const rows = await prisma.message.findMany({
    where: {
      timestamp: { gte: since },
      ...(userId ? { userId } : {}),
    },
    select: { timestamp: true, direction: true },
  });

  const buckets = new Map<string, { sent: number; received: number }>();
  for (let i = 0; i < days; i++) {
    const date = new Date(since);
    date.setDate(date.getDate() + i);
    buckets.set(isoDay(date), { sent: 0, received: 0 });
  }

  for (const row of rows) {
    const bucket = buckets.get(isoDay(row.timestamp));
    if (!bucket) continue;
    if (row.direction === "outgoing") bucket.sent += 1;
    else bucket.received += 1;
  }

  return [...buckets.entries()].map(([day, counts]) => ({ day, ...counts }));
}

export async function getLanguageSplit(): Promise<
  { key: string; label: string; value: number }[]
> {
  const rows = await prisma.user.groupBy({
    by: ["lang"],
    _count: { _all: true },
  });

  const labels: Record<string, string> = {
    uz: "O'zbekcha",
    ru: "Русский",
    en: "English",
  };

  return (["uz", "ru", "en"] as const).map((code) => ({
    key: code,
    label: labels[code],
    value: rows.find((row) => row.lang === code)?._count._all ?? 0,
  }));
}

export async function getTopUsers(
  since: Date,
  limit = 6,
): Promise<{ key: string; label: string; value: number }[]> {
  const grouped = await prisma.message.groupBy({
    by: ["userId"],
    where: { timestamp: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { userId: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((row) => row.userId) } },
    select: { id: true, name: true },
  });
  const names = new Map(users.map((user) => [user.id, user.name]));

  return grouped.map((row) => ({
    key: row.userId,
    label: names.get(row.userId) ?? "—",
    value: row._count._all,
  }));
}

/** Davr boshlanish sanasi (bugundan `days` kun oldin, kun boshiga tekislangan). */
export function periodStart(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
}

function isoDay(date: Date): string {
  // Lokal vaqt zonasida kun — foydalanuvchi ko'rgan sana bilan mos bo'lsin.
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
