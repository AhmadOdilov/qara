"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { api, formatDate } from "@/lib/client";
import { friendly } from "@/lib/errors";
import { Modal } from "@/components/overlays";
import { ErrorAlert } from "@/components/error-alert";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeading,
} from "@/components/ui";
import { IconKey, IconPlus } from "@/components/icons";

export type ApiKeyRow = {
  id: string;
  name: string;
  masked: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdByName: string | null;
};

type Dialog =
  | { kind: "create" }
  | { kind: "reveal"; plain: string; name: string }
  | { kind: "rename"; key: ApiKeyRow }
  | { kind: "revoke"; key: ApiKeyRow }
  | { kind: "delete"; key: ApiKeyRow }
  | null;

/**
 * API kalitlari sahifasi (§8).
 *
 * Muhim UX qarori: to'liq kalit faqat yaratilgandan keyingi modalda, bir
 * marta ko'rsatiladi. Ro'yxatda hech qachon to'liq qiymat bo'lmaydi —
 * server ham uni qaytara olmaydi (bazada xesh turadi).
 */
export function ApiKeysPanel({
  initial,
  canManage,
}: {
  initial: ApiKeyRow[];
  canManage: boolean;
}) {
  const { t, lang } = useI18n();
  const [keys, setKeys] = useState(initial);
  const [dialog, setDialog] = useState<Dialog>(null);

  return (
    <>
      <PageHeading
        title={t.apiKeys.title}
        subtitle={t.apiKeys.subtitle}
        action={
          canManage && keys.length > 0 ? (
            <Button size="sm" onClick={() => setDialog({ kind: "create" })}>
              <IconPlus width={16} height={16} />
              {t.apiKeys.create}
            </Button>
          ) : undefined
        }
      />

      {keys.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconKey width={28} height={28} />}
            title={t.apiKeys.empty}
            body={t.apiKeys.emptyBody}
            action={
              canManage ? (
                <Button onClick={() => setDialog({ kind: "create" })}>
                  <IconPlus width={16} height={16} />
                  {t.apiKeys.create}
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {keys.map((key) => (
              <li key={key.id}>
                <KeyRow
                  row={key}
                  canManage={canManage}
                  locale={lang}
                  onRename={() => setDialog({ kind: "rename", key })}
                  onRevoke={() => setDialog({ kind: "revoke", key })}
                  onDelete={() => setDialog({ kind: "delete", key })}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-4 text-xs text-ink-subtle">{t.apiKeys.securityNote}</p>
      {keys.length > 0 ? (
        <p className="mt-1 text-xs text-ink-subtle">{t.apiKeys.limitHint}</p>
      ) : null}

      {dialog?.kind === "create" ? (
        <CreateDialog
          onClose={() => setDialog(null)}
          onCreated={(key, plain) => {
            setKeys((rows) => [key, ...rows]);
            setDialog({ kind: "reveal", plain, name: key.name });
          }}
        />
      ) : null}

      {dialog?.kind === "reveal" ? (
        <RevealDialog
          plain={dialog.plain}
          name={dialog.name}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog?.kind === "rename" ? (
        <RenameDialog
          row={dialog.key}
          onClose={() => setDialog(null)}
          onDone={(updated) =>
            setKeys((rows) => rows.map((r) => (r.id === updated.id ? updated : r)))
          }
        />
      ) : null}

      {dialog?.kind === "revoke" ? (
        <ConfirmDialog
          title={t.apiKeys.revokeTitle}
          body={t.apiKeys.revokeBody}
          confirmLabel={t.apiKeys.revoke}
          busyLabel={t.apiKeys.revoking}
          request={() =>
            api<{ key: ApiKeyRow }>(`/api/keys/${dialog.key.id}`, {
              method: "PATCH",
              json: { revoked: true },
            })
          }
          onClose={() => setDialog(null)}
          onDone={(data) =>
            setKeys((rows) =>
              rows.map((r) => (r.id === data.key.id ? data.key : r)),
            )
          }
        />
      ) : null}

      {dialog?.kind === "delete" ? (
        <ConfirmDialog
          title={t.apiKeys.deleteTitle}
          body={t.apiKeys.deleteBody}
          confirmLabel={t.common.delete}
          busyLabel={t.common.saving}
          request={() =>
            api<{ ok: true }>(`/api/keys/${dialog.key.id}`, { method: "DELETE" })
          }
          onClose={() => setDialog(null)}
          onDone={() =>
            setKeys((rows) => rows.filter((r) => r.id !== dialog.key.id))
          }
        />
      ) : null}
    </>
  );
}

function KeyRow({
  row,
  canManage,
  locale,
  onRename,
  onRevoke,
  onDelete,
}: {
  row: ApiKeyRow;
  canManage: boolean;
  locale: string;
  onRename: () => void;
  onRevoke: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const revoked = Boolean(row.revokedAt);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-ink">{row.name}</p>
          <Badge tone={revoked ? "neutral" : "success"} dot>
            {revoked ? t.apiKeys.revoked : t.apiKeys.active}
          </Badge>
        </div>

        <p className="mt-1 font-mono text-xs text-ink-muted">{row.masked}</p>

        <p className="mt-1 text-xs text-ink-subtle">
          {t.apiKeys.createdAt}: {formatDate(row.createdAt, locale)}
          {row.createdByName ? ` · ${t.apiKeys.createdBy}: ${row.createdByName}` : ""}
          {" · "}
          {row.lastUsedAt
            ? `${t.apiKeys.lastUsed}: ${formatDate(row.lastUsedAt, locale)}`
            : t.apiKeys.neverUsed}
        </p>
      </div>

      {canManage ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          {!revoked ? (
            <>
              <Button size="sm" variant="ghost" onClick={onRename}>
                {t.apiKeys.rename}
              </Button>
              <Button size="sm" variant="ghost" onClick={onRevoke}>
                {t.apiKeys.revoke}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={onDelete}>
              {t.common.delete}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ── Dialoglar ───────────────────────────────────────────────────────────── */

function CreateDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (key: ApiKeyRow, plain: string) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof friendly> | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await api<{ key: ApiKeyRow; plain: string }>("/api/keys", {
      json: { name: name.trim() },
    });

    setBusy(false);
    if (!result.ok) {
      setError(friendly(result, t));
      return;
    }
    onCreated(result.data.key, result.data.plain);
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={t.apiKeys.create}
      closeLabel={t.common.close}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button
            form="create-api-key"
            type="submit"
            loading={busy}
            loadingLabel={t.apiKeys.creating}
            disabled={name.trim().length === 0}
          >
            {t.apiKeys.create}
          </Button>
        </>
      }
    >
      <form id="create-api-key" onSubmit={submit} className="space-y-3">
        <Field
          label={t.apiKeys.nameLabel}
          hint={t.apiKeys.nameHint}
          htmlFor="api-key-name"
          required
        >
          <Input
            id="api-key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.apiKeys.namePlaceholder}
            maxLength={64}
            autoComplete="off"
            required
          />
        </Field>
        {error ? <ErrorAlert error={error} /> : null}
      </form>
    </Modal>
  );
}

/**
 * To'liq kalit — bir marta. Yopilgach qayta ko'rsatilmaydi.
 *
 * Yopish tugmasi ataylab TASDIQ BILAN qulflangan: bu oyna — kalitni ko'rish
 * uchun yagona imkoniyat, va odam uni o'ylamasdan yopib yuborsa kalit butunlay
 * yo'qoladi (bazada faqat xesh bor). Belgilash qutisi bir soniyalik to'xtash
 * beradi — «haqiqatan saqladingizmi?».
 *
 * Escape va tashqariga bosish ham shu qulfga bo'ysunadi (`busy`): tasodifiy
 * yopilish yo'li qolmasin.
 */
function RevealDialog({
  plain,
  name,
  onClose,
}: {
  plain: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard rad etilsa (HTTP yoki ruxsat yo'q) qiymat baribir ekranda —
      // foydalanuvchiga qo'lda nusxalashni aytamiz, jim qolmaymiz.
      setCopied(false);
      setCopyFailed(true);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={!acknowledged}
      title={t.apiKeys.createdTitle}
      description={name}
      closeLabel={t.common.close}
      footer={
        <Button onClick={onClose} disabled={!acknowledged}>
          {t.apiKeys.done}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5">
          <p className="text-xs text-ink">{t.apiKeys.createdBody}</p>
        </div>

        <code className="block w-full overflow-x-auto rounded-lg bg-surface-inset px-3 py-2.5 font-mono text-xs text-ink select-all">
          {plain}
        </code>

        <Button variant="secondary" onClick={copy} className="w-full">
          {copied ? t.common.copied : t.apiKeys.copyKey}
        </Button>

        {copyFailed ? (
          <p className="text-xs text-danger">{t.apiKeys.copyFailed}</p>
        ) : null}

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-surface-inset px-3 py-2.5">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
          />
          <span className="text-xs text-ink">
            {t.apiKeys.savedConfirm}
            <span className="mt-0.5 block text-ink-subtle">
              {t.apiKeys.savedConfirmHint}
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

function RenameDialog({
  row,
  onClose,
  onDone,
}: {
  row: ApiKeyRow;
  onClose: () => void;
  onDone: (key: ApiKeyRow) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(row.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof friendly> | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await api<{ key: ApiKeyRow }>(`/api/keys/${row.id}`, {
      method: "PATCH",
      json: { name: name.trim() },
    });

    setBusy(false);
    if (!result.ok) {
      setError(friendly(result, t));
      return;
    }
    onDone(result.data.key);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={t.apiKeys.renameTitle}
      closeLabel={t.common.close}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button
            form="rename-api-key"
            type="submit"
            loading={busy}
            loadingLabel={t.common.saving}
            disabled={name.trim().length === 0 || name.trim() === row.name}
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <form id="rename-api-key" onSubmit={submit} className="space-y-3">
        <Field label={t.apiKeys.nameLabel} htmlFor="rename-key-name" required>
          <Input
            id="rename-key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            autoComplete="off"
            required
          />
        </Field>
        {error ? <ErrorAlert error={error} /> : null}
      </form>
    </Modal>
  );
}

/** Ortga qaytmaydigan amallar uchun umumiy tasdiq oynasi (§18). */
function ConfirmDialog<T>({
  title,
  body,
  confirmLabel,
  busyLabel,
  request,
  onClose,
  onDone,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busyLabel: string;
  request: () => Promise<
    { ok: true; data: T } | { ok: false; error: string; status: number }
  >;
  onClose: () => void;
  onDone: (data: T) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof friendly> | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await request();

    setBusy(false);
    if (!result.ok) {
      setError(friendly(result, t));
      return;
    }
    onDone(result.data);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={title}
      closeLabel={t.common.close}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            onClick={run}
            loading={busy}
            loadingLabel={busyLabel}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">{body}</p>
      {error ? (
        <div className="mt-3">
          <ErrorAlert error={error} />
        </div>
      ) : null}
    </Modal>
  );
}
