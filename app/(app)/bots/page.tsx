import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/workspace";
import { listBots } from "@/lib/bots/service";
import { BotsPanel, type BotCard } from "@/components/bots/bots-panel";

export const metadata: Metadata = { title: "Botlarim" };

export default async function BotsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const ctx = await requireWorkspace();
  const { filter } = await searchParams;
  const bots = await listBots(ctx.workspaceId);

  const cards: BotCard[] = bots.map((bot) => ({
    id: bot.id,
    username: bot.username,
    name: bot.name,
    description: bot.description,
    status: bot.status,
    userCount: bot.userCount,
    messageCount: bot.messageCount,
    createdAt: bot.createdAt.toISOString(),
    updatedAt: bot.updatedAt.toISOString(),
  }));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <BotsPanel
          initial={cards}
          initialFilter={
            filter === "active" || filter === "inactive" ? filter : "all"
          }
        />
      </div>
    </div>
  );
}
