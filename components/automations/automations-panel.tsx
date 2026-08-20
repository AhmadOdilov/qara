"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { friendly, type FriendlyError } from "@/lib/errors";
import { formatDate } from "@/lib/client";
import { useI18n } from "@/lib/i18n/provider";
import { TEMPLATES } from "@/lib/automation/templates";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select } from "@/components/ui";
import { ErrorAlert } from "@/components/error-alert";
import { Modal } from "@/components/overlays";
import { IconBolt, IconPlus, IconArrowRight } from "@/components/icons";
import { statusTone, type AutomationStatus } from "@/components/automations/status";

export type AutomationRow = {
  id: string;
  name: string;
  trigger: string;
  status: AutomationStatus;
  lastRunAt: string | null;
  runs: number;
  successRate: number | null;
  bot: { id: string; name: string };
};

export type BotOption = { id: string; name: string };

/**
 * Avtomatlar ro'yxati (§P4.1 PHASE 2).
 *
 * Yaratish har doim QORALAMA beradi va foydalanuvchini quruvchiga olib
 * o'tadi — shu bilan «yaratdim-u, nima bo'ldi?» holati yuzaga kelmaydi.
 */
export function AutomationsPanel({
  initial,
  bots,
}: {
  initial: AutomationRow[];
  bots: BotOption[];
}) {
  const { t, lang } = useI18n();
  const router = useRouter();

  // Ro'yxat serverdan keladi va amaldan keyin `router.refresh()` bilan
  // yangilanadi — klientda ikkinchi nusxa saqlanmaydi.
  const rows = initial;
  const [error, setError] = useState<FriendlyError | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [botId, setBotId] = useState(bots[0]?.id ?? "");

  async function create(payload: {
    name: string;
    trigger: string;
    triggerConfig: Record<string, unknown>;
    conditions: unknown;
    actions: unknown[];
  }) {
    if (!botId) return;
    setBusy(true);
    setError(null);

    const result = await api<{ automation: { id: string } }>("/api/automations", {
      json: { botId, automation: payload },
    });

    setBusy(false);
    if (!result.ok) {
      setError(friendly(result, t));
      return;
    }
    setCreating(false);
    router.push(`/automations/${result.data.automation.id}`);
  }

  return (
    <div className="space-y-4">
      <ErrorAlert error={error} />

      {bots.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconBolt width={28} height={28} />}
            title={t.automations.needBot}
            body={t.automations.emptyBody}
            action={
              <Link
                href="/build"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover"
              >
                {t.nav.build}
                <IconArrowRight width={16} height={16} />
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setCreating(true)} disabled={busy}>
              <IconPlus width={16} height={16} />
              {t.automations.create}
            </Button>
          </div>

          {rows.length === 0 ? (
            <Card>
              <EmptyState
                icon={<IconBolt width={28} height={28} />}
                title={t.automations.empty}
                body={t.automations.emptyBody}
              />
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-sunken text-xs text-ink-subtle">
                      <th className="px-4 py-2.5 text-left font-medium">
                        {t.automations.nameLabel}
                      </th>
                      <th className="px-4 py-2.5 text-left font-medium">
                        {t.automations.colTrigger}
                      </th>
                      <th className="px-4 py-2.5 text-left font-medium">
                        {t.automations.colStatus}
                      </th>
                      <th className="px-4 py-2.5 text-left font-medium">
                        {t.automations.colRuns}
                      </th>
                      <th className="px-4 py-2.5 text-left font-medium">
                        {t.automations.colSuccess}
                      </th>
                      <th className="px-4 py-2.5 text-left font-medium">
                        {t.automations.colLastRun}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const tone = statusTone(row.status);
                      return (
                        <tr
                          key={row.id}
                          className={index === rows.length - 1 ? "" : "border-b border-line"}
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/automations/${row.id}`}
                              className="font-medium text-ink hover:text-accent"
                            >
                              {row.name}
                            </Link>
                            <p className="text-xs text-ink-subtle">{row.bot.name}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-ink-muted">
                            {row.trigger}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={tone.tone}>
                              {t.automations[tone.labelKey]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-ink-muted">
                            {row.runs}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-ink-muted">
                            {/* Ishga tushmagan avtomatda 0% yozish chalg'ituvchi. */}
                            {row.successRate === null ? "—" : `${row.successRate}%`}
                          </td>
                          <td className="px-4 py-3 text-xs text-ink-subtle">
                            {row.lastRunAt
                              ? formatDate(row.lastRunAt, lang)
                              : t.automations.never}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ── Shablonlar ────────────────────────────────────────────── */}
          <Card>
            <CardHeader
              title={t.automations.templatesTitle}
              subtitle={t.automations.templatesHint}
            />
            <div className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {TEMPLATES.map((template) => {
                const built = template.build(lang);
                return (
                  <button
                    key={template.id}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void create({
                        name: built.name,
                        trigger: built.trigger,
                        triggerConfig: built.triggerConfig,
                        conditions: built.conditions,
                        actions: built.actions,
                      })
                    }
                    className="rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-inset disabled:opacity-60"
                  >
                    <span className="text-lg">{template.emoji}</span>
                    <p className="mt-1.5 text-sm font-medium text-ink">{built.name}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle">{built.trigger}</p>
                  </button>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {creating ? (
        <Modal
          open
          onClose={() => setCreating(false)}
          busy={busy}
          size="sm"
          title={t.automations.create}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreating(false)} disabled={busy}>
                {t.common.cancel}
              </Button>
              <Button
                loading={busy}
                disabled={name.trim().length === 0}
                onClick={() =>
                  void create({
                    name: name.trim(),
                    // Yangi avtomat eng sodda ishlaydigan holatdan boshlanadi.
                    trigger: "user_joined",
                    triggerConfig: {},
                    conditions: { op: "and", rules: [] },
                    actions: [{ type: "send_message", text: "..." }],
                  })
                }
              >
                {t.automations.create}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label={t.automations.nameLabel} htmlFor="automation-name">
              <Input
                id="automation-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.automations.namePlaceholder}
                autoFocus
              />
            </Field>
            {bots.length > 1 ? (
              <Field label={t.automations.botLabel} htmlFor="automation-bot">
                <Select
                  id="automation-bot"
                  value={botId}
                  onChange={(event) => setBotId(event.target.value)}
                >
                  {bots.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
