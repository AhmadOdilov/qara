import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/workspace";
import { templateCards } from "@/lib/ai/planner";
import { aiEnabled } from "@/lib/ai/claude";
import { BuildFlow } from "@/components/build/build-flow";

export const metadata: Metadata = { title: "Yaratish" };

/**
 * Birinchi ekran har doim bitta savol (§71): "nima yaratmoqchisiz?".
 * `?template=<id>` bilan kelinsa shablon oldindan tanlangan bo'ladi.
 */
export default async function BuildPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  await requireWorkspace();
  const { template } = await searchParams;

  const templates = templateCards();
  const initial = templates.some((card) => card.id === template)
    ? (template as string)
    : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-4 py-10 sm:px-6">
        <BuildFlow
          templates={templates}
          initialTemplate={initial}
          aiEnabled={aiEnabled()}
        />
      </div>
    </div>
  );
}
