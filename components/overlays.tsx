"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { IconX } from "@/components/icons";

/* ── Tooltip (§11) ───────────────────────────────────────────────────────── */

/**
 * Texnik atama izohi.
 *
 * Qoidalar:
 * · Nishoni haqiqiy `<button>` — sichqonchasiz ham ochiladi (Tab → Enter).
 * · Hover, fokus va bosish — uchalasi ham ochadi; Esc yopadi.
 * · Matn `role="tooltip"` va `aria-describedby` orqali bog'lanadi, ya'ni
 *   skrin-rider tugma nomidan keyin izohni ham o'qiydi (§20).
 *
 * Interfeysni izohlarga to'ldirmaslik uchun faqat haqiqatan tushunarsiz
 * atamalarga qo'yiladi: token, webhook, klaviatura turi.
 */
export function Tooltip({
  label,
  children,
  side = "top",
}: {
  /** Nishonning skrin-rider uchun nomi — «Bot token nima?» kabi. */
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <span ref={wrapper} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex size-4 items-center justify-center rounded-full border border-line-strong text-[10px] font-semibold text-ink-subtle transition-colors hover:border-accent hover:text-accent"
      >
        <span aria-hidden="true">i</span>
      </button>

      {open ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "absolute left-1/2 z-50 w-60 -translate-x-1/2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs leading-relaxed font-normal text-ink-muted",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          )}
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

/* ── Modal (§9, §11) ─────────────────────────────────────────────────────── */

/**
 * Markazlashgan dialog.
 *
 * Fokus ichkariga qamaladi va yopilganda chaqirgan elementga qaytadi —
 * klaviatura foydalanuvchisi sahifa ortida adashib qolmaydi (§20). Esc va
 * fon bosilishi yopadi; `busy` bo'lsa ikkalasi ham bloklanadi, chunki
 * jarayon o'rtasida yopish ma'lumot yo'qotishga olib keladi.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  busy = false,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  busy?: boolean;
  closeLabel: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Ochilganda fokus dialog ichiga — o'qish shu yerdan boshlanadi.
    const focusable = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    (focusable()[0] ?? panel.current)?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      restoreTo.current?.focus();
    };
  }, [open, close]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={close}
        aria-hidden="true"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? "modal-description" : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface-raised sm:rounded-card",
          widths[size],
        )}
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p id="modal-description" className="mt-1 text-sm text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label={closeLabel}
            className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-inset hover:text-ink disabled:opacity-50"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        {children ? (
          <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {children}
          </div>
        ) : null}

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-sunken px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Saqlanmagan o'zgarishlar qo'riqchisi (§17) ──────────────────────────── */

/**
 * Ish yo'qolishining oldini oladi.
 *
 * `dirty` bo'lganda brauzerning o'z tasdiq oynasi yoqiladi (sahifani yopish,
 * yangilash, tashqi havola). Ilova ichidagi navigatsiya uchun esa
 * `SaveIndicator` ko'rinib turadi — foydalanuvchi holatni doim biladi.
 */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Zamonaviy brauzerlar o'z matnini ko'rsatadi; qiymat bo'lishi kifoya.
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
