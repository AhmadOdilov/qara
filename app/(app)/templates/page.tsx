import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/workspace";
import { templateCards } from "@/lib/ai/planner";
import { TemplatesPanel } from "@/components/templates-panel";

export const metadata: Metadata = { title: "Shablonlar" };

/**
 * Shablonlar katalogi (§21).
 *
 * Ma'lumot `templateCards()` dan — ya'ni AI generatori zaxira sifatida
 * ishlatadigan AYNAN O'SHA retseptlar ro'yxatidan. Katalog ikki joyda
 * takrorlanmasin: yangi retsept qo'shilsa bu sahifada o'zi paydo bo'ladi.
 */
export default async function TemplatesPage() {
  await requireWorkspace();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <TemplatesPanel templates={templateCards()} />
      </div>
    </div>
  );
}
