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

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const currentUser = await requireUser();
  const { t } = await getDictionary();

  const [overview, users, messages, settings] = await Promise.all([
    getOverview(periodStart(30)),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
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
            <UsersTable rows={userRows} currentUserId={currentUser.id} />
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
