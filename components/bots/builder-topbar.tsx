"use client";

import Link from "next/link";
import { useEffect } from "react";
import { fill } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { Badge, Button, type SaveStatus } from "@/components/ui";
import { Tooltip } from "@/components/overlays";
import { IconArrowRight, IconCheck, IconAlert } from "@/components/icons";
import type { PublishDiff } from "@/components/bots/button-builder";

/**
 * Konstruktor tepa paneli (§P2).
 *
 * Uchta savolga bir qarashda javob beradi:
 *   · o'zgarishim saqlandimi?      → saqlash holati
 *   · qoralama nashrdan farq qiladimi? → «N ta nashr etilmagan o'zgarish»
 *   · orqaga qaytara olamanmi?     → Undo / Redo
 *
 * «Saqlanmagan o'zgarish» holati ATAYLAB yo'q: bu konstruktorda har bir
 * o'zgarish darhol serverga yoziladi, ya'ni saqlanmagan holat umuman
 * yuzaga kelmaydi. Bo'lmagan holatni ko'rsatish foydalanuvchini
 * chalg'itardi. Haqiqiy farq — qoralama va NASHR o'rtasida.
 */

export function BuilderTopBar({
  botId,
  botName,
  diff,
  publishedVersion,
  status,
  canUndo,
  canRedo,
  busy,
  blocked,
  onUndo,
  onRedo,
  onPublish,
}: {
  botId: string;
  botName: string;
  diff: PublishDiff;
  publishedVersion: number;
  status: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  /** Tekshiruv xatolari nashrni to'xtatib turibdi. */
  blocked: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPublish: () => void;
}) {
  const { t } = useI18n();
  const changes = diff.added + diff.updated + diff.removed;

  // Klaviatura: Cmd/Ctrl+Z va Cmd/Ctrl+Shift+Z.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") {
        return;
      }

      // Matn maydonida foydalanuvchi O'Z yozganini bekor qilmoqchi —
      // brauzerning o'z undo'siga xalaqit bermaymiz.
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) {
        if (canRedo && !busy) onRedo();
      } else if (canUndo && !busy) {
        onUndo();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUndo, canRedo, busy, onUndo, onRedo]);

  const shortcut = modifierLabel();

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href={`/bots/${botId}`}
          className="inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <span aria-hidden="true">←</span>
          {botName}
        </Link>

        <span className="hidden text-line-strong sm:inline" aria-hidden="true">
          /
        </span>

        <StatusBadge
          changes={changes}
          publishedVersion={publishedVersion}
          labels={{
            draft: t.builder.statusDraft,
            published: t.builder.statusPublished,
            upToDate: t.builder.statusUpToDate,
            changes: t.builder.unpublishedChanges,
          }}
        />

        <SaveState status={status} t={t} />

        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip label={`${t.builder.undo} (${shortcut}Z)`}>
            <Button
              size="sm"
              variant="ghost"
              onClick={onUndo}
              disabled={!canUndo || busy}
              aria-label={`${t.builder.undo} (${shortcut}Z)`}
              aria-keyshortcuts="Control+Z Meta+Z"
            >
              <span aria-hidden="true">↶</span>
            </Button>
          </Tooltip>

          <Tooltip label={`${t.builder.redo} (${shortcut}⇧Z)`}>
            <Button
              size="sm"
              variant="ghost"
              onClick={onRedo}
              disabled={!canRedo || busy}
              aria-label={`${t.builder.redo} (${shortcut}⇧Z)`}
              aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
            >
              <span aria-hidden="true">↷</span>
            </Button>
          </Tooltip>

          <Button
            size="sm"
            onClick={onPublish}
            disabled={busy || changes === 0 || blocked}
            title={changes === 0 ? t.builder.statusUpToDate : undefined}
          >
            {t.builder.publish}
            <IconArrowRight width={14} height={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  changes,
  publishedVersion,
  labels,
}: {
  changes: number;
  publishedVersion: number;
  labels: { draft: string; published: string; upToDate: string; changes: string };
}) {
  if (changes === 0) {
    return (
      <span className="flex items-center gap-1.5">
        <Badge tone="success" dot>
          {publishedVersion > 0 ? labels.published : labels.draft}
        </Badge>
        <span className="hidden text-xs text-ink-subtle sm:inline">
          {labels.upToDate}
        </span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <Badge tone="accent" dot>
        {labels.draft}
      </Badge>
      <span className="text-xs text-ink-muted">
        {fill(labels.changes, { count: String(changes) })}
      </span>
    </span>
  );
}

/**
 * Saqlash holati. `idle` da hech narsa ko'rsatilmaydi — bo'sh joyda
 * «Saqlandi» yozuvi turishi ma'nosiz shovqin.
 */
function SaveState({
  status,
  t,
}: {
  status: SaveStatus;
  t: ReturnType<typeof useI18n>["t"];
}) {
  if (status === "idle" || status === "dirty") return null;

  if (status === "saving") {
    return (
      <span className="text-xs text-ink-subtle" role="status" aria-live="polite">
        {t.builder.statusSaving}
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span
        className="flex items-center gap-1 text-xs text-success"
        role="status"
        aria-live="polite"
      >
        <IconCheck width={13} height={13} />
        {t.builder.statusSaved}
      </span>
    );
  }

  return (
    <span
      className="flex items-center gap-1 text-xs text-danger"
      role="status"
      aria-live="assertive"
    >
      <IconAlert width={13} height={13} />
      {t.builder.statusFailed}
    </span>
  );
}

/** Mac'da ⌘, qolganida Ctrl. Serverda render bo'lganda Ctrl. */
function modifierLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl+";
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    ? "⌘"
    : "Ctrl+";
}
