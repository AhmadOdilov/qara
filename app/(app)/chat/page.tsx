import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { telegramMockMode } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/server";
import { Chat, type ChatMessage } from "@/components/chat";
import { TelegramLinkPanel, type LinkState } from "@/components/telegram-link-panel";

export const metadata: Metadata = { title: "Chat" };

const MESSAGE_SELECT = {
  id: true,
  direction: true,
  fromUser: true,
  content: true,
  kind: true,
  status: true,
  error: true,
  timestamp: true,
} as const;

export default async function ChatPage() {
  const user = await requireUser();
  const { t } = await getDictionary();

  const [link, recent, counts] = await Promise.all([
    prisma.telegramLink.findUnique({ where: { userId: user.id } }),
    prisma.message.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: "desc" },
      take: 100,
      select: MESSAGE_SELECT,
    }),
    prisma.message.groupBy({
      by: ["direction"],
      where: { userId: user.id },
      _count: { _all: true },
    }),
  ]);

  const linked = Boolean(link?.connectedAt && link.telegramChatId);

  const linkState: LinkState = linked
    ? {
        linked: true,
        mockMode: telegramMockMode,
        telegram: {
          username: link!.username,
          firstName: link!.firstName,
          chatId: link!.telegramChatId,
          connectedAt: link!.connectedAt!.toISOString(),
        },
      }
    : { linked: false, mockMode: telegramMockMode };

  const sent =
    counts.find((row) => row.direction === "outgoing")?._count._all ?? 0;
  const received =
    counts.find((row) => row.direction === "incoming")?._count._all ?? 0;

  const messages: ChatMessage[] = recent.reverse().map((message) => ({
    ...message,
    timestamp: message.timestamp.toISOString(),
  }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Sarlavha qatori — chat balandligini yemasligi uchun ixcham */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-ink">{t.chat.title}</h1>
          <p className="text-xs text-ink-subtle">
            {t.dashboard.greeting}, {user.name.split(" ")[0]}
          </p>
        </div>
        <dl className="flex items-center gap-5 text-xs">
          <Stat label={t.dashboard.statSent} value={sent} />
          <Stat label={t.dashboard.statReceived} value={received} />
          <Stat label={t.dashboard.statMessages} value={sent + received} />
        </dl>
      </div>

      {!linked ? (
        <div className="shrink-0 overflow-y-auto p-4">
          <TelegramLinkPanel initial={linkState} />
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <Chat
          initialMessages={messages}
          linked={linked}
          mockMode={telegramMockMode}
          quietDefault={user.quietHours}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <dt className="text-[11px] text-ink-subtle">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
