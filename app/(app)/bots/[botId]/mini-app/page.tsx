import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { botScope, requireWorkspace } from "@/lib/workspace";
import { BotServiceError, requireBot } from "@/lib/bots/service";
import { loadBuilderState, miniAppHostingAvailable } from "@/lib/mini-app/service";
import { PageHeading } from "@/components/ui";
import { MiniAppBuilder, type BuilderData } from "@/components/mini-app/builder";
import { MiniAppCreatePanel } from "@/components/mini-app/create-panel";
import { LaunchPanel } from "@/components/mini-app/launch-panel";
import { AnalyticsPanel } from "@/components/mini-app/analytics-panel";

export const metadata: Metadata = { title: "Mini App" };

export default async function MiniAppPage({
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

  const state = await loadBuilderState(botId, botScope(ctx));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href={`/bots/${botId}`}
          className="mb-4 inline-block text-sm text-ink-muted hover:text-ink"
        >
          ← {bot.name}
        </Link>

        <PageHeading
          title="Mini App"
          subtitle="Telegram ichida ochiladigan sahifa — konstruktordan yig'iladi va bir bosishda nashr etiladi."
        />

        {state ? (
          <div className="space-y-4">
            <MiniAppBuilder
              botId={botId}
              // Sana JSON orqali satrga aylanadi — klient tipi shuni kutadi.
              initial={JSON.parse(JSON.stringify(state)) as BuilderData}
            />
            <LaunchPanel botId={botId} published={state.app.status === "published"} />
            <AnalyticsPanel botId={botId} />
          </div>
        ) : (
          <MiniAppCreatePanel
            botId={botId}
            hostingAvailable={miniAppHostingAvailable()}
          />
        )}
      </div>
    </div>
  );
}
