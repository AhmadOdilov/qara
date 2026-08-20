"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { childrenOf, isMenuButton } from "@/lib/bots/buttons/menu";
import { buttonLabel, type ButtonRecord } from "@/lib/bots/buttons/types";
import { IconArrowRight, IconPlus } from "@/components/icons";

/**
 * Menyu daraxti (§4) sudrab ko'chirish bilan (§5).
 *
 * Daraxt — butun tuzilmaning yagona ko'rinishi: ildizdan eng chuqur mahsulot
 * kartasigacha bitta ro'yxatda turadi, shuning uchun ota/bola munosabati
 * ko'z bilan ko'rinadi.
 *
 * Sudrab ko'chirish uchta joyni farqlaydi: tugmaning ustiga (yuqoriga qo'yish),
 * ostiga (pastga qo'yish) va o'rtasiga (ichki menyuga solish). Zona ko'rsatkich
 * qatorning qaysi qismida turganidan aniqlanadi — shu sababli «ichiga solish»
 * va «tartibni o'zgartirish» bitta harakatda ajratiladi.
 *
 * Sensorli ekranlarda sudrash ishonchsiz, shuning uchun joyni o'zgartirishning
 * tugmali yo'li ham bor — u o'ng paneldagi sozlamalarda (§13).
 */

export type DropPosition = "before" | "after" | "into";

export function MenuTree({
  buttons,
  selectedId,
  busy,
  onSelect,
  onMove,
  onAddInto,
}: {
  buttons: ButtonRecord[];
  selectedId: string | null;
  busy: boolean;
  onSelect: (id: string) => void;
  onMove: (dragId: string, targetId: string | null, position: DropPosition) => void;
  onAddInto: (menuId: string | null) => void;
}) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string | null; position: DropPosition } | null>(
    null,
  );

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Tugmani o'z avlodiga tashlashga yo'l qo'ymaymiz — daraxt halqaga aylanardi. */
  function canDrop(targetId: string | null): boolean {
    if (!dragId || targetId === dragId) return false;
    let current = targetId;
    for (let depth = 0; current && depth < 30; depth++) {
      if (current === dragId) return false;
      current = buttons.find((button) => button.id === current)?.parentId ?? null;
    }
    return true;
  }

  function finishDrop(targetId: string | null, position: DropPosition) {
    if (dragId && canDrop(targetId)) onMove(dragId, targetId, position);
    setDragId(null);
    setHover(null);
  }

  function renderLevel(menuId: string | null, depth: number) {
    const items = childrenOf(buttons, menuId);

    return (
      <ul className={cn("space-y-1", depth > 0 && "ml-3 border-l border-line pl-2")}>
        {items.map((button) => {
          const children = childrenOf(buttons, button.id);
          const isOpen = !collapsed.has(button.id);
          const hovering = hover?.id === button.id ? hover.position : null;

          return (
            <li key={button.id}>
              <div
                draggable={!busy}
                onDragStart={() => setDragId(button.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setHover(null);
                }}
                onDragOver={(event) => {
                  if (!dragId || !canDrop(button.id)) return;
                  event.preventDefault();
                  const box = event.currentTarget.getBoundingClientRect();
                  const offset = (event.clientY - box.top) / box.height;
                  setHover({
                    id: button.id,
                    position: offset < 0.28 ? "before" : offset > 0.72 ? "after" : "into",
                  });
                }}
                onDragLeave={() => setHover(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  finishDrop(button.id, hover?.position ?? "after");
                }}
                className={cn(
                  "group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition",
                  selectedId === button.id
                    ? "border-accent bg-accent-soft"
                    : "border-transparent hover:border-line hover:bg-surface-inset",
                  hovering === "into" && "ring-2 ring-accent ring-offset-1",
                  hovering === "before" && "border-t-2 border-t-accent",
                  hovering === "after" && "border-b-2 border-b-accent",
                  dragId === button.id && "opacity-40",
                )}
              >
                {children.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggle(button.id)}
                    aria-label={button.text}
                    aria-expanded={isOpen}
                    className="flex size-5 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-surface hover:text-ink"
                  >
                    <IconArrowRight
                      width={12}
                      height={12}
                      className={cn("transition", isOpen && "rotate-90")}
                    />
                  </button>
                ) : (
                  <span className="size-5 shrink-0" />
                )}

                <button
                  type="button"
                  onClick={() => onSelect(button.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={cn(
                      "truncate text-sm",
                      button.enabled ? "text-ink" : "text-ink-subtle line-through",
                    )}
                  >
                    {buttonLabel(button)}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-subtle">
                    {actionLabel(t.builder as unknown as Record<string, string>, button)}
                  </span>
                  {children.length > 0 ? (
                    <span className="shrink-0 rounded-full bg-surface-inset px-1.5 text-[10px] tabular-nums text-ink-muted">
                      {children.length}
                    </span>
                  ) : null}
                </button>

                {isMenuButton(buttons, button) ? (
                  <button
                    type="button"
                    onClick={() => onAddInto(button.id)}
                    disabled={busy}
                    aria-label={t.builder.addInto}
                    title={t.builder.addInto}
                    className="flex size-6 shrink-0 items-center justify-center rounded text-ink-subtle opacity-0 transition hover:bg-surface hover:text-ink focus:opacity-100 group-hover:opacity-100 disabled:opacity-40"
                  >
                    <IconPlus width={13} height={13} />
                  </button>
                ) : null}
              </div>

              {children.length > 0 && isOpen ? (
                <div className="mt-1">{renderLevel(button.id, depth + 1)}</div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  const rootCount = childrenOf(buttons, null).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-subtle">{t.builder.treeHint}</p>
        <span className="shrink-0 text-[11px] tabular-nums text-ink-subtle">
          {fill(t.builder.childCount, { count: String(buttons.length) })}
        </span>
      </div>

      {rootCount === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center">
          <p className="text-sm font-medium text-ink">{t.builder.empty}</p>
          <p className="mt-1 text-sm text-ink-muted">{t.builder.emptyBody}</p>
        </div>
      ) : (
        renderLevel(null, 0)
      )}

      {/* Ildizga ko'chirish uchun tashlash maydoni: chuqurdagi tugmani
          asosiy menyuga chiqarishning sudrab bajariladigan yo'li. */}
      <div
        onDragOver={(event) => {
          if (!dragId) return;
          event.preventDefault();
          setHover({ id: null, position: "into" });
        }}
        onDragLeave={() => setHover(null)}
        onDrop={(event) => {
          event.preventDefault();
          finishDrop(null, "into");
        }}
        className={cn(
          "rounded-lg border border-dashed px-3 py-2 text-center text-[11px] transition",
          hover?.id === null && dragId
            ? "border-accent bg-accent-soft text-accent"
            : "border-line text-ink-subtle",
        )}
      >
        {t.builder.root}
      </div>
    </div>
  );
}

function actionLabel(labels: Record<string, string>, button: ButtonRecord): string {
  return labels[`action_${button.actionType}`] ?? button.actionType;
}
