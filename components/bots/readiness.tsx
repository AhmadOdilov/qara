"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { friendly, type FriendlyError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/provider";
import { fill } from "@/lib/i18n/dictionaries";
import { Modal } from "@/components/overlays";
import { Alert, Badge, Button, Card, CardHeader } from "@/components/ui";
import { ErrorAlert } from "@/components/error-alert";
import { IconCheck, IconTelegram } from "@/components/icons";

/**
 * Ishga tushirishdan oldingi tekshiruv (§8) va nashr oqimi (§9).
 *
 * Foydalanuvchining eng katta savoli — «bot tayyormi?». Bu savolga taxmin
 * bilan emas, ro'yxat bilan javob beriladi: har bir band yo bajarilgan, yo
 * uni tuzatadigan havolasi bor. Hammasi yashil bo'lgandagina asosiy tugma
 * yonadi — ya'ni «ishga tushirish» hech qachon jimgina muvaffaqiyatsiz
 * tugamaydi.
 */

export type ReadinessInput = {
  botId: string;
  botName: string;
  username: string;
  tokenConnected: boolean;
  hasStartCommand: boolean;
  rootButtonCount: number;
  validationErrors: number;
  live: boolean;
  /** Webhook o'rnatish imkoni bor-yo'qligi (HTTPS talab qilinadi). */
  canGoLive: boolean;
};

type CheckItem = {
  id: string;
  done: boolean;
  label: string;
  /** Bajarilmagan band uchun sahifadagi bo'lim — «Tuzatish» shu yerga olib boradi. */
  fixHref?: string;
};

export function ReadinessCard({ data }: { data: ReadinessInput }) {
  const { t } = useI18n();
  const router = useRouter();

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [launched, setLaunched] = useState(false);

  const checks: CheckItem[] = [
    {
      id: "token",
      done: data.tokenConnected,
      label: data.tokenConnected ? t.checklist.tokenOk : t.checklist.tokenNo,
      fixHref: "#bot-setup",
    },
    {
      id: "start",
      done: data.hasStartCommand,
      label: data.hasStartCommand ? t.checklist.startOk : t.checklist.startNo,
      fixHref: "#bot-commands",
    },
    {
      id: "menu",
      done: data.rootButtonCount > 0,
      label: data.rootButtonCount > 0 ? t.checklist.menuOk : t.checklist.menuNo,
      fixHref: "#bot-buttons",
    },
    {
      id: "valid",
      done: data.validationErrors === 0,
      label: data.validationErrors === 0 ? t.checklist.validOk : t.checklist.validNo,
      fixHref: "#bot-buttons",
    },
    {
      id: "live",
      done: data.live,
      label: data.live ? t.checklist.liveOk : t.checklist.liveNo,
    },
  ];

  const doneCount = checks.filter((check) => check.done).length;
  // Oxirgi band — natijaning o'zi, shuning uchun «tayyor» undan oldingi
  // to'rttasi bilan o'lchanadi.
  const prerequisites = checks.slice(0, 4);
  const ready = prerequisites.every((check) => check.done);

  async function launch() {
    setBusy(true);
    setError(null);

    const result = await api<{ webhook?: { ok: boolean; reason?: string } }>(
      `/api/bots/${data.botId}/webhook?action=set`,
      { method: "POST" },
    );

    setBusy(false);
    if (!result.ok) {
      setError(friendly(result, t));
      return;
    }
    if (result.data.webhook && !result.data.webhook.ok) {
      setError({
        title: t.errors.tokenTitle,
        body: result.data.webhook.reason || t.errors.tokenBody,
        action: "token",
      });
      return;
    }

    setConfirming(false);
    setLaunched(true);
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader
          title={t.checklist.title}
          subtitle={t.checklist.subtitle}
          action={
            <Badge tone={ready ? "success" : "warning"} dot>
              {fill(t.checklist.doneCount, {
                done: String(doneCount),
                total: String(checks.length),
              })}
            </Badge>
          }
        />

        <div className="p-5">
          <ul className="space-y-2">
            {checks.map((check) => (
              <li key={check.id} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={
                    check.done
                      ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"
                      : "flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-ink-subtle"
                  }
                >
                  {check.done ? <IconCheck width={12} height={12} /> : null}
                </span>
                <span
                  className={
                    check.done
                      ? "flex-1 text-sm text-ink"
                      : "flex-1 text-sm text-ink-muted"
                  }
                >
                  {check.label}
                </span>
                {!check.done && check.fixHref ? (
                  <a
                    href={check.fixHref}
                    className="shrink-0 rounded text-xs font-medium text-accent hover:underline"
                  >
                    {t.checklist.fix}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-lg bg-surface-inset p-4">
            <p className="text-sm font-medium text-ink">
              {ready ? t.checklist.readyTitle : t.checklist.notReadyTitle}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {ready ? t.checklist.readyBody : t.checklist.notReadyBody}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setConfirming(true)}
                disabled={!ready || data.live || !data.canGoLive}
              >
                {t.checklist.launch}
              </Button>
              <a
                href="#bot-test"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface-raised px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-inset"
              >
                {t.checklist.test}
              </a>
            </div>

            {!data.canGoLive ? (
              <p className="mt-3 text-xs text-ink-subtle">{t.bots.webhookNeedsHttps}</p>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4">
              <ErrorAlert error={error} onRetry={launch} />
            </div>
          ) : null}
        </div>
      </Card>

      {/* Tasdiq oynasi — nima ishga tushayotgani ro'yxat bilan ko'rsatiladi (§9). */}
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t.publish.confirmTitle}
        description={t.publish.confirmBody}
        closeLabel={t.common.close}
        size="sm"
        busy={busy}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              {t.common.back}
            </Button>
            <Button onClick={launch} loading={busy}>
              {busy ? t.publish.running : t.publish.confirm}
            </Button>
          </>
        }
      >
        <dl className="space-y-2 text-sm">
          <SummaryRow label={t.publish.botLabel} value={data.botName} />
          <SummaryRow label={t.publish.usernameLabel} value={`@${data.username}`} />
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-muted">{t.publish.statusLabel}</dt>
            <dd>
              <Badge tone="success" dot>
                {t.publish.ready}
              </Badge>
            </dd>
          </div>
        </dl>
      </Modal>

      {/* Muvaffaqiyat — faqat haqiqatan ishga tushgandan keyin (§9). */}
      <Modal
        open={launched}
        onClose={() => setLaunched(false)}
        title={t.publish.successTitle}
        description={t.publish.successBody}
        closeLabel={t.common.close}
        size="sm"
        footer={
          <>
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-inset hover:text-ink"
            >
              {t.publish.backToDashboard}
            </Link>
            <a
              href={`https://t.me/${data.username}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            >
              <IconTelegram width={16} height={16} />
              {t.publish.openTelegram}
            </a>
          </>
        }
      >
        <Alert tone="success">
          <span className="font-mono">@{data.username}</span>
        </Alert>
      </Modal>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 truncate font-medium text-ink">{value}</dd>
    </div>
  );
}
