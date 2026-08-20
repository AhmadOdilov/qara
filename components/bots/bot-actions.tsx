"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { api } from "@/lib/client";
import { friendly } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/overlays";
import { ErrorAlert } from "@/components/error-alert";
import { Button, Field, Input } from "@/components/ui";
import { IconMore } from "@/components/icons";

export type BotActionTarget = {
  id: string;
  name: string;
  status: string;
};

type Dialog = "duplicate" | "delete" | null;

/**
 * Bot kartasidagi «yana» menyusi (§4).
 *
 * Menyu tugmalari — faqat qulaylik. HAR BIR amal serverda qaytadan
 * tekshiriladi (`bot:edit`, `bot:delete`, `bot:create` huquqlari va workspace
 * mansubligi), shuning uchun tugmani yashirish xavfsizlik chorasi emas va
 * shunday deb qaralmaydi ham (§21).
 */
export function BotActions({
  bot,
  onChanged,
}: {
  bot: BotActionTarget;
  onChanged?: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof friendly> | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const paused = bot.status === "disabled";

  // Tashqariga bosilganda va Escape'da yopiladi — oddiy menyu uchun
  // to'liq dialog qamog'i shart emas, lekin klaviatura chiqish yo'li shart.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function refresh() {
    onChanged?.();
    router.refresh();
  }

  async function togglePaused() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await api<{ bot: { id: string } }>(`/api/bots/${bot.id}`, {
      method: "PATCH",
      json: { paused: !paused },
    });

    setBusy(false);
    setOpen(false);
    if (!result.ok) {
      setError(friendly(result, t));
      return;
    }
    refresh();
  }

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t.bots.actionsFor.replace("{name}", bot.name)}
        className={cn(
          "flex size-8 items-center justify-center rounded-lg text-ink-subtle",
          "transition-colors hover:bg-surface-inset hover:text-ink",
        )}
      >
        <IconMore width={16} height={16} />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className={cn(
            "absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-lg border border-line",
            "bg-surface-raised py-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)]",
          )}
        >
          <MenuItem
            label={t.bots.open}
            onClick={() => {
              setOpen(false);
              router.push(`/bots/${bot.id}`);
            }}
          />
          <MenuItem
            label={t.bots.duplicate}
            onClick={() => {
              setOpen(false);
              setDialog("duplicate");
            }}
          />
          <MenuItem
            label={paused ? t.bots.activate : t.bots.deactivate}
            onClick={togglePaused}
            disabled={busy}
          />
          <div className="my-1 border-t border-line" />
          <MenuItem
            label={t.bots.deleteBot}
            tone="danger"
            onClick={() => {
              setOpen(false);
              setDialog("delete");
            }}
          />
        </div>
      ) : null}

      {error ? (
        <div className="absolute right-0 top-10 z-20 w-72">
          <ErrorAlert error={error} />
        </div>
      ) : null}

      {dialog === "duplicate" ? (
        <DuplicateDialog bot={bot} onClose={() => setDialog(null)} />
      ) : null}

      {dialog === "delete" ? (
        <DeleteDialog
          bot={bot}
          onClose={() => setDialog(null)}
          onDone={refresh}
        />
      ) : null}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  disabled,
  tone = "normal",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "normal" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "block w-full px-3 py-2 text-left text-sm transition-colors disabled:opacity-55",
        tone === "danger"
          ? "text-danger hover:bg-danger-soft"
          : "text-ink hover:bg-surface-inset",
      )}
    >
      {label}
    </button>
  );
}

/**
 * Nusxalash oynasi (§10).
 *
 * Oynaning asosiy vazifasi — kutilmani to'g'rilash: odam «duplicate» bosganda
 * ikkinchi ISHLAYDIGAN bot kutadi. Shuning uchun nima ko'chirilishi va nima
 * ko'chirilmasligi tugmani bosishdan OLDIN ochiq yoziladi.
 */
function DuplicateDialog({
  bot,
  onClose,
}: {
  bot: BotActionTarget;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState(`${bot.name} (${t.bots.duplicate.toLowerCase()})`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof friendly> | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await api<{ planId: string; droppedDeeper: number }>(
      `/api/bots/${bot.id}/duplicate`,
      { json: { name: name.trim() } },
    );

    setBusy(false);
    if (!result.ok) {
      setError(friendly(result, t));
      return;
    }
    // Qoralama tayyor — foydalanuvchi endi yangi tokenini ulaydigan
    // mavjud oqimga tushadi.
    router.push(`/build/${result.data.planId}`);
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={t.bots.duplicateTitle}
      closeLabel={t.common.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button
            onClick={run}
            loading={busy}
            loadingLabel={t.bots.duplicating}
            disabled={name.trim().length === 0}
          >
            {t.bots.duplicateCta}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">{t.bots.duplicateBody}</p>

        <ul className="space-y-1.5 text-xs">
          <li className="flex gap-2 rounded-lg bg-success-soft px-3 py-2 text-ink">
            <span aria-hidden="true">✓</span>
            {t.bots.duplicateCopied}
          </li>
          <li className="flex gap-2 rounded-lg bg-surface-inset px-3 py-2 text-ink-muted">
            <span aria-hidden="true">✕</span>
            {t.bots.duplicateNotCopied}
          </li>
        </ul>

        <Field label={t.bots.duplicateNameLabel} htmlFor="duplicate-name" required>
          <Input
            id="duplicate-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={64}
            required
          />
        </Field>

        {error ? <ErrorAlert error={error} /> : null}
      </div>
    </Modal>
  );
}

function DeleteDialog({
  bot,
  onClose,
  onDone,
}: {
  bot: BotActionTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof friendly> | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await api<{ ok: true }>(`/api/bots/${bot.id}`, {
      method: "DELETE",
    });

    setBusy(false);
    if (!result.ok) {
      setError(friendly(result, t));
      return;
    }
    onClose();
    onDone();
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={t.bots.deleteTitle}
      description={bot.name}
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
            loadingLabel={t.common.saving}
          >
            {t.common.delete}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">{t.bots.deleteBody}</p>
      {error ? (
        <div className="mt-3">
          <ErrorAlert error={error} />
        </div>
      ) : null}
    </Modal>
  );
}
