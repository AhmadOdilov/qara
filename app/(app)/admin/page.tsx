import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { env, telegramMockMode } from "@/lib/env";
import { webhookUrl } from "@/lib/telegram";
import { getDictionary } from "@/lib/i18n/server";
import { getOverview, periodStart } from "@/lib/stats";
import { Card, CardHeader, PageHeading } from "@/components/ui";
import { StatTile } from "@/components/charts";
import {
  MessagesTable,
  UsersTable,
  type AdminMessageRow,
  type AdminUserRow,
} from "@/components/admin-tables";
import { BotSettingsForm } from "@/components/bot-settings-form";
import { Pager } from "@/components/pager";
import { pageCount, pageRange, readPage } from "@/lib/pagination";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string; q?: string }>;
}) {
  const currentUser = await requireUser();
  const { t } = await getDictionary();

  const params = await searchParams;
  const { page, size, skip } = readPage(params);
  const query = (params.q ?? "").trim().slice(0, 80);

  // Qidiruv SERVER tomonda: ilgari klient faqat yuklangan 200 qatorni
  // filtrlardi, ya'ni 201-chi foydalanuvchi topilmasdi.
  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [overview, userTotal, users, messages, settings] = await Promise.all([
    getOverview(periodStart(30)),
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: size,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lang: true,
        createdAt: true,
        telegramLink: { select: { connectedAt: true, username: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.message.findMany({
      orderBy: { timestamp: "desc" },
      take: 60,
      select: {
        id: true,
        direction: true,
        content: true,
        status: true,
        timestamp: true,
        user: { select: { name: true } },
      },
    }),
    prisma.botSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
  ]);

  const userRows: AdminUserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    lang: user.lang,
    linked: Boolean(user.telegramLink?.connectedAt),
    telegramUsername: user.telegramLink?.username ?? null,
    messages: user._count.messages,
    createdAt: user.createdAt.toISOString(),
  }));

  const pages = pageCount(userTotal, size);
  const range = pageRange(page, size, userTotal);

  const messageRows: AdminMessageRow[] = messages.map((message) => ({
    id: message.id,
    userName: message.user.name,
    direction: message.direction,
    content: message.content,
    status: message.status,
    timestamp: message.timestamp.toISOString(),
  }));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <PageHeading title={t.admin.title} subtitle={t.admin.subtitle} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label={t.admin.usersTotal} value={overview.users} />
          <StatTile
            label={t.admin.usersLinked}
            value={overview.linkedUsers}
            hint={`${overview.linkRate}%`}
          />
          <StatTile
            label={t.admin.messagesTotal}
            value={overview.messages}
            hint={t.analytics.range30}
          />
          <StatTile label={t.admin.activeToday} value={overview.activeToday} />
        </div>

        <section className="mt-6">
          <Card>
            <CardHeader title={t.admin.tabUsers} />
            <UsersTable
              rows={userRows}
              currentUserId={currentUser.id}
              query={query}
            />
            <Pager
              page={page}
              pages={pages}
              from={range.from}
              to={range.to}
              total={userTotal}
              basePath="/admin"
              params={{ q: query, size: String(size) }}
              labels={{
                prev: t.common.prev,
                next: t.common.next,
                of: t.common.of,
              }}
            />
          </Card>
        </section>

        <section className="mt-6">
          <Card>
            <CardHeader title={t.admin.tabBot} />
            <BotSettingsForm
              config={{
                welcomeMessage: settings.welcomeMessage,
                autoReply: settings.autoReply ?? "",
                maintenanceMode: settings.maintenanceMode,
                rateLimitPerMin: settings.rateLimitPerMin,
                tokenSet: !telegramMockMode,
                botUsername: env.telegram.username,
                webhookUrl: webhookUrl(),
              }}
            />
          </Card>
        </section>

        <section className="mt-6">
          <Card>
            <CardHeader title={t.admin.tabMessages} />
            <MessagesTable rows={messageRows} />
          </Card>
        </section>
      </div>
    </div>
  );
}
