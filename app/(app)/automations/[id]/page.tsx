import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWorkspace, WorkspaceError } from "@/lib/workspace";
import { getAutomation } from "@/lib/automation/service";
import {
  AutomationBuilder,
  type AutomationDetail,
} from "@/components/automations/automation-builder";
import type { AutomationStatus } from "@/components/automations/status";
import type { Action, Condition } from "@/lib/automation/types";

export const metadata: Metadata = { title: "Avtomat" };

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireWorkspace();
  const { id } = await params;

  // Begona ish maydonining avtomati uchun ham 404 — mavjudligi oshkor
  // bo'lmasin (`requireBot` bilan bir xil tartib).
  const row = await getAutomation(ctx, id).catch((error: unknown) => {
    if (error instanceof WorkspaceError) notFound();
    throw error;
  });
  if (!row) notFound();

  const detail: AutomationDetail = {
    id: row.id,
    name: row.name,
    trigger: row.trigger,
    triggerConfig: (row.triggerConfig ?? {}) as Record<string, unknown>,
    conditions: (row.conditions ?? { op: "and", rules: [] }) as Condition,
    actions: (row.actions ?? []) as Action[],
    status: row.status as AutomationStatus,
    bot: row.bot,
    runs: row.runs.map((run) => ({
      ...run,
      startedAt: run.startedAt.toISOString(),
    })),
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <AutomationBuilder initial={detail} />
      </div>
    </div>
  );
}
