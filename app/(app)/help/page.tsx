import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { HelpPanel } from "@/components/help-panel";

export const metadata: Metadata = { title: "Yordam" };

/**
 * Yordam markazi (§20).
 *
 * Workspace talab qilmaydi — yordam har qanday kirgan foydalanuvchiga ochiq.
 * Aloqa havolasi platformaning o'z boti orqali (`TELEGRAM_BOT_USERNAME`).
 */
export default async function HelpPage() {
  await requireUser();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <HelpPanel botUsername={env.telegram.username} />
      </div>
    </div>
  );
}
