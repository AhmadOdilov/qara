"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { api } from "@/lib/client";
import { Alert, Badge, Button, Field, Input, Textarea, Toggle } from "@/components/ui";

export type BotConfig = {
  welcomeMessage: string;
  autoReply: string;
  maintenanceMode: boolean;
  rateLimitPerMin: number;
  tokenSet: boolean;
  botUsername: string;
  webhookUrl: string;
};

export function BotSettingsForm({ config }: { config: BotConfig }) {
  const { t } = useI18n();
  const router = useRouter();

  const [welcome, setWelcome] = useState(config.welcomeMessage);
  const [autoReply, setAutoReply] = useState(config.autoReply);
  const [maintenance, setMaintenance] = useState(config.maintenanceMode);
  const [rateLimit, setRateLimit] = useState(String(config.rateLimitPerMin));

  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [webhookNote, setWebhookNote] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);

    const result = await api("/api/admin/bot", {
      method: "PATCH",
      json: {
        welcomeMessage: welcome,
        autoReply: autoReply.trim() ? autoReply : null,
        maintenanceMode: maintenance,
        rateLimitPerMin: Number(rateLimit) || 20,
      },
    });

    if (!result.ok) {
      setStatus("idle");
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }

    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
    router.refresh();
  }

  async function webhook(action: "set" | "delete") {
    setWebhookNote(null);
    setError(null);
    const result = await api<{ mockMode: boolean }>(
      `/api/admin/bot?action=${action}`,
      { method: "POST", json: {} },
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setWebhookNote(
      result.data.mockMode
        ? `${action}: mock (${t.admin.botTokenMissing})`
        : `${action}: OK`,
    );
  }

  return (
    <form onSubmit={save} className="space-y-5 p-5">
      {error ? <Alert>{error}</Alert> : null}

      {/* Faqat o'qish uchun server holati */}
      <dl className="grid gap-3 rounded-lg bg-surface-inset p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-ink-subtle">{t.admin.botToken}</dt>
          <dd className="mt-1">
            {config.tokenSet ? (
              <Badge tone="success">{t.admin.botTokenSet}</Badge>
            ) : (
              <Badge tone="accent">{t.admin.botTokenMissing}</Badge>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-subtle">{t.admin.botUsername}</dt>
          <dd className="mt-1 font-mono text-xs text-ink">@{config.botUsername}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-ink-subtle">{t.admin.webhookUrl}</dt>
          <dd className="mt-1 break-all font-mono text-xs text-ink">
            {config.webhookUrl}
          </dd>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => webhook("set")}
            >
              setWebhook
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => webhook("delete")}
            >
              deleteWebhook
            </Button>
            {webhookNote ? (
              <span className="text-xs text-ink-muted">{webhookNote}</span>
            ) : null}
          </div>
        </div>
      </dl>

      <Field label={t.admin.welcomeMessage} htmlFor="welcome">
        <Textarea
          id="welcome"
          rows={3}
          value={welcome}
          onChange={(event) => setWelcome(event.target.value)}
          maxLength={1000}
        />
      </Field>

      <Field
        label={t.admin.autoReply}
        htmlFor="autoReply"
        hint={t.admin.autoReplyHint}
      >
        <Textarea
          id="autoReply"
          rows={2}
          value={autoReply}
          onChange={(event) => setAutoReply(event.target.value)}
          maxLength={1000}
        />
      </Field>

      <Field label={t.admin.rateLimit} htmlFor="rateLimit">
        <Input
          id="rateLimit"
          type="number"
          min={1}
          max={300}
          value={rateLimit}
          onChange={(event) => setRateLimit(event.target.value)}
          className="max-w-32"
        />
      </Field>

      <div className="border-t border-line pt-1">
        <Toggle
          checked={maintenance}
          onChange={setMaintenance}
          label={t.admin.maintenance}
          hint={t.admin.maintenanceHint}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? t.common.loading : t.common.save}
        </Button>
        {status === "saved" ? (
          <span className="text-sm text-success">{t.common.saved}</span>
        ) : null}
      </div>
    </form>
  );
}
