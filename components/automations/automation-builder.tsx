"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, formatDate, formatTime } from "@/lib/client";
import { friendly, type FriendlyError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/provider";
import {
  CONDITION_FIELDS,
  LIVE_ACTIONS,
  LIVE_TRIGGERS,
  OPERATORS,
  PLANNED_ACTIONS,
  PLANNED_TRIGGERS,
  type Action,
  type Condition,
  type Rule,
} from "@/lib/automation/types";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Textarea,
  type SaveStatus,
} from "@/components/ui";
import { ErrorAlert } from "@/components/error-alert";
import { Modal } from "@/components/overlays";
import { IconPlus, IconTrash } from "@/components/icons";
import { statusTone, type AutomationStatus } from "@/components/automations/status";

export type RunRow = {
  id: string;
  triggerEvent: string;
  status: string;
  actionsRun: number;
  failedAction: string | null;
  error: string | null;
  durationMs: number | null;
  startedAt: string;
};

export type AutomationDetail = {
  id: string;
  name: string;
  trigger: string;
  triggerConfig: Record<string, unknown>;
  conditions: Condition;
  actions: Action[];
  status: AutomationStatus;
  bot: { id: string; name: string };
  runs: RunRow[];
};

/**
 * WHEN → IF → THEN quruvchisi (§P4.1 PHASE 3–7).
 *
 * Ataylab vertikal kartalar: tugunlar grafi emas. Har bir bo'lim bitta
 * savolga javob beradi va foydalanuvchi tepadan pastga o'qib chiqadi.
 *
 * Trigger va amal ro'yxatlari BACKEND bilan bitta manbadan
 * (`lib/automation/types.ts`) keladi — frontend o'z sxemasini yaratmaydi.
 * Shu sababli hali qurilmagan variantlar ham shu yerdan kelib, o'chiq
 * holatda ko'rsatiladi.
 */
export function AutomationBuilder({ initial }: { initial: AutomationDetail }) {
  const { t, lang } = useI18n();
  const router = useRouter();

  const [name, setName] = useState(initial.name);
  const [trigger, setTrigger] = useState(initial.trigger);
  const [keyword, setKeyword] = useState(
    String(initial.triggerConfig?.keyword ?? ""),
  );
  const [condition, setCondition] = useState<Condition>(
    initial.conditions ?? { op: "and", rules: [] },
  );
  const [actions, setActions] = useState<Action[]>(initial.actions);
  const [status, setStatus] = useState<AutomationStatus>(initial.status);

  const [saveState, setSaveState] = useState<SaveStatus>("idle");
  const [error, setError] = useState<FriendlyError | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const tone = statusTone(status);

  function payload() {
    return {
      name: name.trim(),
      trigger,
      triggerConfig: trigger === "keyword_received" ? { keyword: keyword.trim() } : {},
      conditions: condition,
      actions,
    };
  }

  async function save() {
    setBusy(true);
    setSaveState("saving");
    setError(null);

    const result = await api(`/api/automations/${initial.id}`, {
      method: "PATCH",
      json: { action: "save", automation: payload() },
    });

    setBusy(false);
    if (result.ok) {
      setSaveState("saved");
      router.refresh();
    } else {
      setSaveState("error");
      setError(friendly(result, t));
    }
  }

  async function changeStatus(next: AutomationStatus) {
    setBusy(true);
    setError(null);

    // Nashrdan oldin o'zgarishlar saqlanadi — aks holda eski konfiguratsiya
    // nashr etilib ketardi.
    if (next === "published") {
      const saved = await api(`/api/automations/${initial.id}`, {
        method: "PATCH",
        json: { action: "save", automation: payload() },
      });
      if (!saved.ok) {
        setBusy(false);
        setError(friendly(saved, t));
        return;
      }
    }

    const result = await api(`/api/automations/${initial.id}`, {
      method: "PATCH",
      json: { action: "status", status: next },
    });

    setBusy(false);
    setConfirmPublish(false);
    if (result.ok) {
      setStatus(next);
      router.refresh();
    } else {
      setError(friendly(result, t));
    }
  }

  async function duplicate() {
    setBusy(true);
    const result = await api<{ automation: { id: string } }>(
      `/api/automations/${initial.id}`,
      { method: "PATCH", json: { action: "duplicate" } },
    );
    setBusy(false);
    if (result.ok) router.push(`/automations/${result.data.automation.id}`);
    else setError(friendly(result, t));
  }

  async function remove() {
    setBusy(true);
    const result = await api(`/api/automations/${initial.id}`, { method: "DELETE" });
    setBusy(false);
    if (result.ok) router.push("/automations");
    else {
      setConfirmDelete(false);
      setError(friendly(result, t));
    }
  }

  return (
    <div className="space-y-4">
      <ErrorAlert error={error} />

      {/* ── Tepa panel ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/automations"
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← {t.automations.title}
        </Link>
        <Badge tone={tone.tone}>{t.automations[tone.labelKey]}</Badge>
        {saveState === "saved" ? (
          <span className="text-xs text-success" role="status">
            {t.automations.saved}
          </span>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={duplicate} disabled={busy}>
            {t.automations.duplicate}
          </Button>
          <Button size="sm" variant="ghost" onClick={save} disabled={busy}>
            {t.automations.save}
          </Button>
          {status === "published" ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void changeStatus("disabled")}
              disabled={busy}
            >
              {t.automations.disable}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setConfirmPublish(true)}
              disabled={busy || name.trim().length === 0 || actions.length === 0}
            >
              {status === "disabled" ? t.automations.enable : t.automations.publish}
            </Button>
          )}
        </div>
      </div>

      <Field label={t.automations.nameLabel} htmlFor="automation-name">
        <Input
          id="automation-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t.automations.namePlaceholder}
        />
      </Field>

      {/* ── QACHON ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title={t.automations.whenTitle} subtitle={t.automations.whenHint} />
        <div className="space-y-3 p-5">
          <Select
            aria-label={t.automations.whenTitle}
            value={trigger}
            onChange={(event) => setTrigger(event.target.value)}
          >
            {LIVE_TRIGGERS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
            {/* Hali qurilmaganlar TANLANMAYDI — ular ishlayotgandek
                ko'rinmasligi kerak. */}
            {PLANNED_TRIGGERS.map((item) => (
              <option key={item} value={item} disabled>
                {item} — {t.automations.plannedBadge}
              </option>
            ))}
          </Select>

          {trigger === "keyword_received" ? (
            <Field
              label={t.automations.keywordLabel}
              hint={t.automations.keywordHint}
              htmlFor="automation-keyword"
            >
              <Input
                id="automation-keyword"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="narx"
              />
            </Field>
          ) : null}
        </div>
      </Card>

      <Arrow />

      {/* ── AGAR ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={t.automations.ifTitle}
          subtitle={t.automations.ifHint}
          action={
            <Select
              aria-label={t.automations.ifTitle}
              value={condition.op}
              onChange={(event) =>
                setCondition({ ...condition, op: event.target.value as "and" | "or" })
              }
              className="w-44"
            >
              <option value="and">{t.automations.matchAll}</option>
              <option value="or">{t.automations.matchAny}</option>
            </Select>
          }
        />
        <div className="space-y-2 p-5">
          {condition.rules.map((rule, index) => (
            <RuleRow
              key={index}
              rule={rule}
              onChange={(next) =>
                setCondition({
                  ...condition,
                  rules: condition.rules.map((item, i) => (i === index ? next : item)),
                })
              }
              onRemove={() =>
                setCondition({
                  ...condition,
                  rules: condition.rules.filter((_, i) => i !== index),
                })
              }
              removeLabel={t.automations.removeRow}
              valueLabel={t.automations.valueLabel}
            />
          ))}

          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setCondition({
                ...condition,
                rules: [
                  ...condition.rules,
                  { field: "user.tags", operator: "contains", value: "" },
                ],
              })
            }
          >
            <IconPlus width={14} height={14} />
            {t.automations.addCondition}
          </Button>
        </div>
      </Card>

      <Arrow />

      {/* ── UNDA ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={t.automations.thenTitle}
          subtitle={t.automations.thenHint}
        />
        <div className="space-y-2 p-5">
          {actions.map((action, index) => (
            <ActionRow
              key={index}
              action={action}
              labels={{
                message: t.automations.messageLabel,
                tag: t.automations.tagLabel,
                url: t.automations.urlLabel,
                remove: t.automations.removeRow,
                soon: t.automations.soonBadge,
              }}
              onChange={(next) =>
                setActions(actions.map((item, i) => (i === index ? next : item)))
              }
              onRemove={() => setActions(actions.filter((_, i) => i !== index))}
            />
          ))}

          <Button
            size="sm"
            variant="ghost"
            disabled={actions.length >= 10}
            onClick={() =>
              setActions([...actions, { type: "send_message", text: "" }])
            }
          >
            <IconPlus width={14} height={14} />
            {t.automations.addAction}
          </Button>
        </div>
      </Card>

      {/* ── Bajarilish tarixi ──────────────────────────────────────────── */}
      <Card>
        <CardHeader title={t.automations.logsTitle} />
        {initial.runs.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-ink-subtle">
            {t.automations.logsEmpty}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-sunken text-xs text-ink-subtle">
                  <th className="px-4 py-2 text-left font-medium">
                    {t.automations.logTime}
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    {t.automations.colTrigger}
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    {t.automations.logStatus}
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    {t.automations.logActions}
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    {t.automations.logDuration}
                  </th>
                </tr>
              </thead>
              <tbody>
                {initial.runs.map((run) => (
                  <tr key={run.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 text-xs text-ink-muted">
                      {formatDate(run.startedAt, lang)} {formatTime(run.startedAt, lang)}
                    </td>
                    <td className="px-4 py-2 text-xs text-ink-muted">
                      {run.triggerEvent}
                    </td>
                    <td className="px-4 py-2">
                      <RunStatus status={run.status} t={t} />
                      {run.error ? (
                        <p className="mt-0.5 text-[11px] text-danger">
                          {run.failedAction ? `${run.failedAction}: ` : ""}
                          {run.error}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-xs text-ink-muted">
                      {run.actionsRun}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-xs text-ink-muted">
                      {run.durationMs === null ? "—" : `${run.durationMs}ms`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
          <IconTrash width={14} height={14} />
          {t.automations.delete}
        </Button>
      </div>

      {confirmPublish ? (
        <Modal
          open
          onClose={() => setConfirmPublish(false)}
          busy={busy}
          size="sm"
          title={t.automations.publishConfirmTitle}
          description={t.automations.publishConfirmBody}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmPublish(false)} disabled={busy}>
                {t.common.cancel}
              </Button>
              <Button loading={busy} onClick={() => void changeStatus("published")}>
                {t.automations.publish}
              </Button>
            </>
          }
        />
      ) : null}

      {confirmDelete ? (
        <Modal
          open
          onClose={() => setConfirmDelete(false)}
          busy={busy}
          size="sm"
          title={t.automations.deleteConfirmTitle}
          description={t.automations.deleteConfirmBody}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
                {t.common.cancel}
              </Button>
              <Button variant="danger" loading={busy} onClick={remove}>
                {t.automations.delete}
              </Button>
            </>
          }
        />
      ) : null}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center text-ink-subtle" aria-hidden="true">
      ↓
    </div>
  );
}

function RunStatus({
  status,
  t,
}: {
  status: string;
  t: ReturnType<typeof useI18n>["t"];
}) {
  if (status === "completed") {
    return <Badge tone="success">{t.automations.runCompleted}</Badge>;
  }
  if (status === "failed") {
    return <Badge tone="danger">{t.automations.runFailed}</Badge>;
  }
  if (status === "skipped") {
    return <Badge tone="neutral">{t.automations.runSkipped}</Badge>;
  }
  return <Badge tone="warning">{t.automations.runRunning}</Badge>;
}

function RuleRow({
  rule,
  onChange,
  onRemove,
  removeLabel,
  valueLabel,
}: {
  rule: Rule;
  onChange: (next: Rule) => void;
  onRemove: () => void;
  removeLabel: string;
  valueLabel: string;
}) {
  const needsValue = rule.operator !== "exists" && rule.operator !== "not_exists";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2">
      <Select
        aria-label="field"
        value={rule.field}
        onChange={(event) =>
          onChange({ ...rule, field: event.target.value as Rule["field"] })
        }
        className="min-w-40 flex-1"
      >
        {CONDITION_FIELDS.map((field) => (
          <option key={field} value={field}>
            {field}
          </option>
        ))}
      </Select>

      <Select
        aria-label="operator"
        value={rule.operator}
        onChange={(event) =>
          onChange({ ...rule, operator: event.target.value as Rule["operator"] })
        }
        className="w-36"
      >
        {OPERATORS.map((operator) => (
          <option key={operator} value={operator}>
            {operator}
          </option>
        ))}
      </Select>

      {needsValue ? (
        <Input
          aria-label={valueLabel}
          value={String(rule.value ?? "")}
          onChange={(event) => onChange({ ...rule, value: event.target.value })}
          className="min-w-32 flex-1"
        />
      ) : null}

      <Button variant="ghost" size="sm" onClick={onRemove} aria-label={removeLabel}>
        <IconTrash width={14} height={14} />
      </Button>
    </div>
  );
}

function ActionRow({
  action,
  onChange,
  onRemove,
  labels,
}: {
  action: Action;
  onChange: (next: Action) => void;
  onRemove: () => void;
  labels: { message: string; tag: string; url: string; remove: string; soon: string };
}) {
  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center gap-2">
        <Select
          aria-label="action"
          value={action.type}
          onChange={(event) => onChange(blankAction(event.target.value))}
          className="flex-1"
        >
          {LIVE_ACTIONS.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
          {/* Qurilmagan amallar tanlanmaydi. */}
          {PLANNED_ACTIONS.map((type) => (
            <option key={type} value={type} disabled>
              {type} — {labels.soon}
            </option>
          ))}
        </Select>
        <Button variant="ghost" size="sm" onClick={onRemove} aria-label={labels.remove}>
          <IconTrash width={14} height={14} />
        </Button>
      </div>

      {action.type === "send_message" || action.type === "notify_admin" ? (
        <Textarea
          aria-label={labels.message}
          rows={2}
          value={action.text}
          onChange={(event) => onChange({ ...action, text: event.target.value })}
        />
      ) : null}

      {action.type === "add_tag" || action.type === "remove_tag" ? (
        <Input
          aria-label={labels.tag}
          value={action.tag}
          onChange={(event) => onChange({ ...action, tag: event.target.value })}
        />
      ) : null}

      {action.type === "call_webhook" ? (
        <Input
          aria-label={labels.url}
          value={action.url}
          placeholder="https://"
          onChange={(event) => onChange({ ...action, url: event.target.value })}
        />
      ) : null}

      {action.type === "start_automation" ? (
        <Input
          aria-label="automationId"
          value={action.automationId}
          onChange={(event) =>
            onChange({ ...action, automationId: event.target.value })
          }
        />
      ) : null}
    </div>
  );
}

/** Tur almashganda mos bo'sh shakl beradi — eski maydonlar qolib ketmasin. */
function blankAction(type: string): Action {
  switch (type) {
    case "notify_admin":
      return { type: "notify_admin", text: "" };
    case "add_tag":
      return { type: "add_tag", tag: "" };
    case "remove_tag":
      return { type: "remove_tag", tag: "" };
    case "call_webhook":
      return { type: "call_webhook", url: "" };
    case "start_automation":
      return { type: "start_automation", automationId: "" };
    case "stop":
      return { type: "stop" };
    default:
      return { type: "send_message", text: "" };
  }
}
