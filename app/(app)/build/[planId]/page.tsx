import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { blueprintSchema } from "@/lib/ai/blueprint";
import { pendingActionsIn, templateCards } from "@/lib/ai/planner";
import { aiEnabled } from "@/lib/ai/claude";
import { BuildFlow, type PlanResponse } from "@/components/build/build-flow";

export const metadata: Metadata = { title: "Reja" };

/**
 * Telegramda tuzilgan rejani dashboardda davom ettirish (§10).
 *
 * Bot odamni aynan shu manzilga yuboradi: suhbat Telegramda boshlangan,
 * ko'rib chiqish va nashr esa shu yerda tugaydi.
 */
export default async function PlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const ctx = await requireWorkspace();
  const { planId } = await params;

  const draft = await prisma.botBlueprint.findFirst({
    where: { id: planId, workspaceId: ctx.workspaceId },
  });
  if (!draft) notFound();

  // Allaqachon qo'llangan bo'lsa — rejaga emas, tayyor botga yuboramiz.
  if (draft.status === "applied" && draft.botId) {
    redirect(`/bots/${draft.botId}`);
  }

  const parsed = blueprintSchema.safeParse(draft.plan);
  if (!parsed.success) notFound();

  const plan: PlanResponse = {
    id: draft.id,
    blueprint: parsed.data,
    source: draft.source === "claude" ? "claude" : "rule_based",
    fallbackReason: null,
    pendingActions: pendingActionsIn(parsed.data),
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-4 py-10 sm:px-6">
        <BuildFlow
          templates={templateCards()}
          initialTemplate={null}
          aiEnabled={aiEnabled()}
          initialPlan={plan}
        />
      </div>
    </div>
  );
}
