"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { friendly, type FriendlyError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/provider";
import { Card, CardHeader, Select } from "@/components/ui";
import { ErrorAlert } from "@/components/error-alert";

export type WorkspaceOption = {
  id: string;
  name: string;
  role: string;
};

/**
 * Ish maydonini almashtirish (§21).
 *
 * Faqat bittadan ko'p a'zolik bo'lganda ko'rinadi — bitta ish maydoni bilan
 * ishlaydigan odamga keraksiz tanlov ko'rsatilmaydi.
 *
 * Tanlov cookie'ga yoziladi, keyin `router.refresh()` bilan sahifa qayta
 * o'qiladi: barcha server komponentlari yangi ish maydoni bo'yicha yuklanadi.
 */
export function WorkspaceSwitcher({
  options,
  activeId,
}: {
  options: WorkspaceOption[];
  activeId: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  if (options.length < 2) return null;

  async function switchTo(workspaceId: string) {
    if (workspaceId === activeId) return;
    setBusy(true);
    setError(null);

    const result = await api("/api/workspace/active", {
      json: { workspaceId },
    });

    if (result.ok) {
      router.refresh();
    } else {
      setError(friendly(result, t));
    }
    setBusy(false);
  }

  return (
    <div className="mb-4 space-y-3">
      <ErrorAlert error={error} />
      <Card>
        <CardHeader
          title={t.workspace.switchTitle}
          subtitle={t.workspace.switchHint}
        />
        <div className="px-5 py-4">
          <Select
            aria-label={t.workspace.switchTitle}
            value={activeId}
            disabled={busy}
            onChange={(event) => void switchTo(event.target.value)}
            className="w-full sm:w-72"
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>
    </div>
  );
}
