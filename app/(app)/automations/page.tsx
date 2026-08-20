import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/workspace";
import { getDictionary } from "@/lib/i18n/server";
import { listAutomations } from "@/lib/automation/service";
import { listBots } from "@/lib/bots/service";
import { PageHeading } from "@/components/ui";
import {
  AutomationsPanel,
  type AutomationRow,
} from "@/components/automations/automations-panel";
import type { AutomationStatus } from "@/components/automations/status";

export const metadata: Metadata = { title: "Avtomatlar" };

/**
 * Avtomatlar (§P4.1).
 *
 * Ilgari bu sahifa butunlay «tez orada» edi. Endi dvigatel runtime'da
 * ishlaydi va foydalanuvchi avtomat yarata oladi.
 */
export default async function AutomationsPage() {
  const ctx = await requireWorkspace();
  const { t } = await getDictionary();

  const [rows, bots] = await Promise.all([
    listAutomations(ctx),
    listBots(ctx.workspaceId),
  ]);

  const automations: AutomationRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    trigger: row.trigger,
    status: row.status as AutomationStatus,
    lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
    runs: row.runs,
    successRate: row.successRate,
    bot: row.bot,
  }));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <PageHeading title={t.automations.title} subtitle={t.automations.subtitle} />
        <AutomationsPanel
          initial={automations}
          bots={bots.map((bot) => ({ id: bot.id, name: bot.name }))}
        />
      </div>
    </div>
  );
}
