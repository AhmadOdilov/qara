import type { Metadata } from "next";
import { requireWorkspace, can } from "@/lib/workspace";
import { listApiKeys } from "@/lib/api-keys";
import { getDictionary } from "@/lib/i18n/server";
import { Card, EmptyState } from "@/components/ui";
import { IconShield } from "@/components/icons";
import { ApiKeysPanel } from "@/components/api-keys-panel";

export const metadata: Metadata = { title: "API kalitlari" };

/**
 * API kalitlari (§8).
 *
 * Kalitlar ish maydoniga tegishli, shaxsiy emas — jamoadagi boshqa admin ham
 * ularni ko'ra oladi va bekor qila oladi. `editor` va quyi rollar bu sahifaga
 * umuman kira olmaydi: kalit token bilan bir xil darajadagi sir.
 */
export default async function ApiKeysPage() {
  const ctx = await requireWorkspace();
  const { t } = await getDictionary();

  if (!can(ctx.role, "apikey:read")) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <Card>
            <EmptyState
              icon={<IconShield width={28} height={28} />}
              title={t.errors.forbiddenTitle}
              body={t.errors.forbiddenBody}
            />
          </Card>
        </div>
      </div>
    );
  }

  const keys = await listApiKeys(ctx.workspaceId);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <ApiKeysPanel
          canManage={can(ctx.role, "apikey:manage")}
          initial={keys.map((key) => ({
            ...key,
            createdAt: key.createdAt.toISOString(),
            lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
            revokedAt: key.revokedAt?.toISOString() ?? null,
          }))}
        />
      </div>
    </div>
  );
}
