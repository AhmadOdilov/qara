"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { api } from "@/lib/client";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Textarea,
} from "@/components/ui";
import {
  IconAlert,
  IconArrowRight,
  IconBot,
  IconPlus,
  IconSend,
  IconTelegram,
  IconTrash,
} from "@/components/icons";
import {
  ButtonBuilder,
  type BuilderState,
} from "@/components/bots/button-builder";
import { statusTone, type BotStatusValue } from "@/components/bots/status";
import type { TemplateOutline } from "@/lib/bots/buttons/templates";

export type BotDetailData = {
  id: string;
  name: string;
  username: string;
  description: string | null;
  status: BotStatusValue;
  lastError: string | null;
  webhookSet: boolean;
  userCount: number;
  messageCount: number;
};

export type CommandRow = {
  command: string;
  description: string;
  text: string;
  enabled: boolean;
};

export function BotDetail({
  bot,
  commands: initialCommands,
  webhookUrl,
  webhookAvailable,
  builder,
  templates,
  suggestedTemplateId,
}: {
  bot: BotDetailData;
  commands: CommandRow[];
  webhookUrl: string;
  webhookAvailable: boolean;
  builder: BuilderState;
  templates: TemplateOutline[];
  suggestedTemplateId: string | null;
}) {
  const { t } = useI18n();
  const tone = statusTone(bot.status);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
      <Link
        href="/bots"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
      >
        <IconArrowRight width={14} height={14} className="rotate-180" />
        {t.bots.backToList}
      </Link>

      {/* Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <IconBot width={22} height={22} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-ink">
              {bot.name}
            </h1>
            <a
              href={`https://t.me/${bot.username}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-accent"
            >
              <IconTelegram width={13} height={13} />@{bot.username}
            </a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <dl className="flex gap-4 text-xs">
            <div className="text-right">
              <dt className="text-[11px] text-ink-subtle">{t.bots.statUsers}</dt>
              <dd className="font-semibold tabular-nums text-ink">{bot.userCount}</dd>
            </div>
            <div className="text-right">
              <dt className="text-[11px] text-ink-subtle">{t.bots.statMessages}</dt>
              <dd className="font-semibold tabular-nums text-ink">{bot.messageCount}</dd>
            </div>
          </dl>
          <Badge tone={tone.tone}>{t.bots[tone.labelKey]}</Badge>
        </div>
      </div>

      {bot.lastError ? (
        <Alert>
          <span className="flex items-start gap-2">
            <IconAlert width={16} height={16} className="mt-0.5 shrink-0" />
            <span>
              <strong className="font-medium">{t.bots.lastError}:</strong> {bot.lastError}
            </span>
          </span>
        </Alert>
      ) : null}

      {/* Mini App alohida sahifada quriladi — konstruktor uchun keng joy kerak. */}
      <Link
        href={`/bots/${bot.id}/mini-app`}
        className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface-raised px-5 py-4 transition-colors hover:border-line-strong"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">Mini App</span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            Telegram ichida ochiladigan sahifa — katalog, forma yoki buyurtma oynasi
          </span>
        </span>
        <IconArrowRight width={16} height={16} className="shrink-0 text-ink-subtle" />
      </Link>

      <WebhookCard
        botId={bot.id}
        webhookSet={bot.webhookSet}
        webhookUrl={webhookUrl}
        webhookAvailable={webhookAvailable}
      />
      <CommandsCard botId={bot.id} initial={initialCommands} />
      <ButtonBuilder
        botId={bot.id}
        botName={bot.name}
        initial={builder}
        templates={templates}
        suggestedTemplateId={suggestedTemplateId}
      />
      <TestCard botId={bot.id} />
      <DangerCard botId={bot.id} paused={bot.status === "disabled"} />
    </div>
  );
}

/* ── Webhook ─────────────────────────────────────────────────────────────── */

function WebhookCard({
  botId,
  webhookSet,
  webhookUrl,
  webhookAvailable,
}: {
  botId: string;
  webhookSet: boolean;
  webhookUrl: string;
  webhookAvailable: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: "set" | "delete") {
    setBusy(true);
    setError("");
    const result = await api<{
      webhook?: { ok: boolean; reason?: string };
    }>(`/api/bots/${botId}/webhook?action=${action}`, { method: "POST" });
    setBusy(false);

    if (!result.ok) {
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }
    if (result.data.webhook && !result.data.webhook.ok) {
      setError(result.data.webhook.reason ?? "");
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title={t.bots.webhookTitle}
        subtitle={t.bots.webhookSubtitle}
        action={
          <Badge tone={webhookSet ? "success" : "neutral"}>
            {webhookSet ? t.bots.webhookOn : t.bots.webhookOff}
          </Badge>
        }
      />
      <div className="space-y-3 p-5">
        <p className="break-all rounded-lg bg-surface-inset px-3 py-2 font-mono text-xs text-ink-muted">
          {webhookUrl}
        </p>

        {!webhookAvailable ? (
          <p className="text-xs text-ink-muted">{t.bots.webhookNeedsHttps}</p>
        ) : null}

        {error ? <Alert>{error}</Alert> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => run("set")}
            disabled={busy || !webhookAvailable}
          >
            {t.bots.webhookSet}
          </Button>
          {webhookSet ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => run("delete")}
              disabled={busy}
            >
              {t.bots.webhookRemove}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/* ── Buyruqlar ───────────────────────────────────────────────────────────── */

function CommandsCard({
  botId,
  initial,
}: {
  botId: string;
  initial: CommandRow[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [rows, setRows] = useState<CommandRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function patch(index: number, next: Partial<CommandRow>) {
    setSaved(false);
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...next } : row)),
    );
  }

  function add() {
    setSaved(false);
    setRows((current) => [
      ...current,
      { command: "", description: "", text: "", enabled: true },
    ]);
  }

  function remove(index: number) {
    setSaved(false);
    setRows((current) => current.filter((_, i) => i !== index));
  }

  async function save() {
    setBusy(true);
    setError("");
    const result = await api<{ commands: unknown[] }>(`/api/bots/${botId}/commands`, {
      method: "PUT",
      json: { commands: rows },
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title={t.bots.commandsTitle}
        subtitle={t.bots.commandsSubtitle}
        action={
          <Button size="sm" variant="secondary" onClick={add}>
            <IconPlus width={15} height={15} />
            {t.bots.commandAdd}
          </Button>
        }
      />
      <div className="space-y-4 p-5">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.bots.commandsEmpty}</p>
        ) : null}

        {rows.map((row, index) => (
          <div
            key={index}
            className="space-y-3 rounded-lg border border-line bg-surface p-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.bots.commandName} htmlFor={`cmd-${index}`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-ink-subtle">/</span>
                  <Input
                    id={`cmd-${index}`}
                    value={row.command}
                    onChange={(e) => patch(index, { command: e.target.value })}
                    placeholder="start"
                    spellCheck={false}
                    maxLength={32}
                  />
                </div>
              </Field>
              <Field label={t.bots.commandDescription} htmlFor={`cmd-desc-${index}`}>
                <Input
                  id={`cmd-desc-${index}`}
                  value={row.description}
                  onChange={(e) => patch(index, { description: e.target.value })}
                  maxLength={256}
                />
              </Field>
            </div>

            <Field label={t.bots.commandReply} htmlFor={`cmd-text-${index}`}>
              <Textarea
                id={`cmd-text-${index}`}
                value={row.text}
                onChange={(e) => patch(index, { text: e.target.value })}
                rows={2}
                maxLength={4096}
              />
            </Field>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => patch(index, { enabled: e.target.checked })}
                  className="size-4 accent-[var(--color-accent)]"
                />
                {t.common.on}
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove(index)}
                aria-label={t.bots.commandRemove}
              >
                <IconTrash width={15} height={15} />
                {t.common.delete}
              </Button>
            </div>
          </div>
        ))}

        {error ? <Alert>{error}</Alert> : null}
        {saved ? <Alert tone="success">{t.common.saved}</Alert> : null}

        <Button onClick={save} disabled={busy}>
          {t.common.save}
        </Button>
      </div>
    </Card>
  );
}

/* ── Sinov ───────────────────────────────────────────────────────────────── */

/** Simulyator qaytargan klaviatura — bosish uchun kerakli minimal shakl. */
type TestKey = { text: string; callback?: string };

type TestLine = { from: "you" | "bot"; text: string; keys?: TestKey[][] };

type SimulateReply = { text: string; keyboard: unknown };

/**
 * Sinov oynasi.
 *
 * Klaviatura bosiladigan holda ko'rsatiladi: inline tugma `callback_data` ni,
 * reply tugmasi esa o'z matnini yuboradi — ya'ni ichma-ich menyu bo'ylab
 * yurishni Telegram'ga chiqmasdan, aynan botning marshrutizatori bilan
 * tekshirib bo'ladi.
 */
function TestCard({ botId }: { botId: string }) {
  const { t } = useI18n();
  const [text, setText] = useState("/start");
  const [lines, setLines] = useState<TestLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function dispatch(
    payload: { text: string } | { callback: string },
    shown: string,
  ) {
    setBusy(true);
    setError("");
    setLines((current) => [...current, { from: "you", text: shown }]);

    const result = await api<{ replies: SimulateReply[]; toasts: string[] }>(
      `/api/bots/${botId}/simulate`,
      { json: payload },
    );
    setBusy(false);

    if (!result.ok) {
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }

    const { replies, toasts } = result.data;
    setLines((current) => [
      ...current,
      ...(replies.length > 0
        ? replies.map((reply) => ({
            from: "bot" as const,
            text: reply.text,
            keys: keysOf(reply.keyboard),
          }))
        : [
            {
              from: "bot" as const,
              text: toasts[0] ?? t.bots.testNoReply,
            },
          ]),
    ]);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const outgoing = text.trim();
    if (!outgoing) return;
    setText("");
    await dispatch({ text: outgoing }, outgoing);
  }

  /** Oxirgi javobdagi klaviatura — faqat u bosiladi, xuddi Telegram'da. */
  const active = [...lines].reverse().find((line) => line.from === "bot" && line.keys);

  return (
    <Card>
      <CardHeader title={t.bots.testTitle} subtitle={t.bots.testSubtitle} />
      <div className="space-y-3 p-5">
        {lines.length > 0 ? (
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg bg-surface-inset p-3">
            {lines.map((line, index) => (
              <div
                key={index}
                className={line.from === "you" ? "text-right" : "text-left"}
              >
                <span
                  className={
                    line.from === "you"
                      ? "inline-block max-w-[85%] whitespace-pre-wrap rounded-lg bg-accent px-3 py-1.5 text-left text-sm text-accent-fg"
                      : "inline-block max-w-[85%] whitespace-pre-wrap rounded-lg bg-surface-raised px-3 py-1.5 text-sm text-ink"
                  }
                >
                  {line.text}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {active?.keys?.length ? (
          <div className="space-y-1">
            {active.keys.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1">
                {row.map((key, index) => (
                  <button
                    key={`${rowIndex}-${index}`}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      dispatch(
                        key.callback ? { callback: key.callback } : { text: key.text },
                        key.text,
                      )
                    }
                    className="min-w-0 flex-1 truncate rounded-lg bg-accent-soft px-2 py-1.5 text-xs font-medium text-accent transition hover:opacity-80 disabled:opacity-50"
                  >
                    {key.text}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        {error ? <Alert>{error}</Alert> : null}

        <form onSubmit={send} className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.bots.testPlaceholder}
            aria-label={t.bots.testTitle}
          />
          <Button type="submit" disabled={busy || !text.trim()}>
            <IconSend width={16} height={16} />
            {t.bots.testSend}
          </Button>
        </form>
      </div>
    </Card>
  );
}

/** Telegram `reply_markup` ichidan bosiladigan tugmalarni ajratib oladi. */
function keysOf(markup: unknown): TestKey[][] | undefined {
  if (!markup || typeof markup !== "object") return undefined;

  const inline = (markup as { inline_keyboard?: { text: string; callback_data?: string }[][] })
    .inline_keyboard;
  if (inline) {
    return inline.map((row) =>
      row.map((button) => ({ text: button.text, callback: button.callback_data })),
    );
  }

  const reply = (markup as { keyboard?: { text: string }[][] }).keyboard;
  if (reply) return reply.map((row) => row.map((button) => ({ text: button.text })));

  return undefined;
}

/* ── Xavfli hudud ────────────────────────────────────────────────────────── */

function DangerCard({ botId, paused }: { botId: string; paused: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function togglePause() {
    setBusy(true);
    setError("");
    const result = await api(`/api/bots/${botId}`, {
      method: "PATCH",
      json: { paused: !paused },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError("");
    const result = await api(`/api/bots/${botId}`, { method: "DELETE" });
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }
    router.push("/bots");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title={t.bots.dangerTitle} />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">{t.bots.pauseHint}</p>
          <Button size="sm" variant="secondary" onClick={togglePause} disabled={busy}>
            {paused ? t.bots.resume : t.bots.pause}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-ink-muted">{t.bots.deleteHint}</p>
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-danger">{t.bots.deleteConfirm}</span>
              <Button size="sm" variant="danger" onClick={remove} disabled={busy}>
                {t.common.yes}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                {t.common.cancel}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
              <IconTrash width={15} height={15} />
              {t.bots.deleteBot}
            </Button>
          )}
        </div>

        {error ? <Alert>{error}</Alert> : null}
      </div>
    </Card>
  );
}
