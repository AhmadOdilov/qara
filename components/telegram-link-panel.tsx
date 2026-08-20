"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { api, formatDate } from "@/lib/client";
import { Alert, Badge, Button, Card } from "@/components/ui";
import {
  IconCheck,
  IconCopy,
  IconLink,
  IconTelegram,
} from "@/components/icons";

export type LinkState =
  | { linked: false; mockMode: boolean }
  | {
      linked: true;
      mockMode: boolean;
      telegram: {
        username: string | null;
        firstName: string | null;
        chatId: string | null;
        connectedAt: string;
      };
    };

/**
 * Telegram bog'lash paneli.
 * MOCK rejimda deep link o'rniga «mock bog'lanish» tugmasi ko'rsatiladi —
 * bot tokenisiz ham oqimni oxirigacha sinash mumkin.
 */
export function TelegramLinkPanel({ initial }: { initial: LinkState }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<LinkState>(initial);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);

  async function createLink() {
    setPending(true);
    setError(null);
    const result = await api<{ url: string }>("/api/telegram/link", {
      method: "POST",
      json: {},
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }
    setDeepLink(result.data.url);
  }

  async function mockConnect() {
    setPending(true);
    setError(null);
    // Mock oqim ham avval token yaratishni talab qiladi.
    if (!deepLink) {
      const created = await api<{ url: string }>("/api/telegram/link", {
        method: "POST",
        json: {},
      });
      if (!created.ok) {
        setPending(false);
        setError(created.error);
        return;
      }
      setDeepLink(created.data.url);
    }
    const result = await api<{ ok: true }>("/api/telegram/link", {
      method: "PUT",
      json: {},
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function unlink() {
    if (!confirm(t.telegram.unlinkConfirm)) return;
    setPending(true);
    await api("/api/telegram/link", { method: "DELETE" });
    setPending(false);
    setState({ linked: false, mockMode: state.mockMode });
    setDeepLink(null);
    router.refresh();
  }

  async function copyLink() {
    if (!deepLink) return;
    await navigator.clipboard.writeText(deepLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (state.linked) {
    return (
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <IconCheck width={20} height={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-ink">
                  {t.telegram.linked}
                </p>
                {state.mockMode ? <Badge tone="accent">mock</Badge> : null}
              </div>
              <dl className="mt-2 space-y-0.5 text-xs text-ink-muted">
                {state.telegram.username ? (
                  <div className="flex gap-2">
                    <dt>{t.telegram.username}:</dt>
                    <dd className="font-medium text-ink">
                      @{state.telegram.username}
                    </dd>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <dt>{t.telegram.chatId}:</dt>
                  <dd className="font-mono text-ink">
                    {state.telegram.chatId}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt>{t.telegram.connectedAt}:</dt>
                  <dd className="text-ink">
                    {formatDate(state.telegram.connectedAt, lang)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={unlink}
            disabled={pending}
          >
            {t.telegram.unlink}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <IconTelegram width={20} height={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {t.telegram.notLinked}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {t.telegram.notLinkedBody}
          </p>

          {state.mockMode ? (
            <p className="mt-3 rounded-lg bg-surface-inset px-3 py-2 text-xs text-ink-subtle">
              {t.telegram.mockNotice}
            </p>
          ) : null}

          {error ? (
            <div className="mt-3">
              <Alert>{error}</Alert>
            </div>
          ) : null}

          {deepLink && !state.mockMode ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-ink-subtle">
                {t.telegram.connectHint}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
                >
                  <IconTelegram width={16} height={16} />
                  {t.telegram.openTelegram}
                </a>
                <Button variant="secondary" onClick={copyLink}>
                  {copied ? (
                    <IconCheck width={16} height={16} />
                  ) : (
                    <IconCopy width={16} height={16} />
                  )}
                  {copied ? t.common.copied : t.telegram.copyLink}
                </Button>
              </div>
              <p className="break-all font-mono text-[11px] text-ink-subtle">
                {deepLink}
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {state.mockMode ? (
                <Button onClick={mockConnect} disabled={pending}>
                  <IconLink width={16} height={16} />
                  {pending ? t.common.loading : t.telegram.mockConnect}
                </Button>
              ) : (
                <Button onClick={createLink} disabled={pending}>
                  <IconTelegram width={16} height={16} />
                  {pending ? t.common.loading : t.telegram.connect}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
