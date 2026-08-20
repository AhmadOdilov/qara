import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { botScope, requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import {
  botWebhookUrl,
  BotServiceError,
  requireBot,
  webhookAvailable,
} from "@/lib/bots/service";
import { loadBuilderState } from "@/lib/bots/buttons/store";
import { suggestTemplate, templateOutlines } from "@/lib/bots/buttons/templates";
import {
  BotDetail,
  type BotDetailData,
  type CommandRow,
} from "@/components/bots/bot-detail";

export const metadata: Metadata = { title: "Bot sozlamalari" };

export default async function BotPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const ctx = await requireWorkspace();
  const { botId } = await params;

  const bot = await requireBot(botId, botScope(ctx)).catch((error: unknown) => {
    if (error instanceof BotServiceError) notFound();
    throw error;
  });

  const [commands, counts, builder] = await Promise.all([
    prisma.telegramBotCommand.findMany({
      where: { botId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.telegramBot.findUniqueOrThrow({
      where: { id: botId },
      select: { _count: { select: { botUsers: true, botMessages: true } } },
    }),
    loadBuilderState(botId),
  ]);

  // Shablon taklifi bot kategoriyasidan kelib chiqadi; foydalanuvchi keyin
  // konstruktorda o'z tavsifi bilan qayta so'rashi mumkin.
  const suggestion = suggestTemplate({ category: bot.category });

  const data: BotDetailData = {
    id: bot.id,
    name: bot.name,
    username: bot.username,
    description: bot.description,
    status: bot.status,
    lastError: bot.lastError,
    webhookSet: Boolean(bot.webhookSetAt),
    userCount: counts._count.botUsers,
    messageCount: counts._count.botMessages,
  };

  const rows: CommandRow[] = commands.map((command) => ({
    command: command.command,
    description: command.description,
    // Buyruq javobi `actionConfig.text` da saqlanadi (actionType: send_message).
    text: (command.actionConfig as { text?: string } | null)?.text ?? "",
    enabled: command.enabled,
  }));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <BotDetail
        bot={data}
        commands={rows}
        webhookUrl={botWebhookUrl(bot.id)}
        webhookAvailable={webhookAvailable()}
        builder={builder}
        templates={templateOutlines()}
        suggestedTemplateId={suggestion.matched}
      />
    </div>
  );
}
