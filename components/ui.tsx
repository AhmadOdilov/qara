import { cloneElement, isValidElement, type ReactElement } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

/*
  Dizayn tizimi (§15).

  Qoidalar:
  · Bo'shliq — 8px panjara (Tailwind 0.5 = 2px, ya'ni 2/3/4/5/6 qadamlar).
  · Radius — `rounded-lg` boshqaruvlar uchun, `rounded-card` konteynerlar uchun.
  · Rang — faqat semantik tokenlar. Primary bir sahifada bittadan ortiq emas.
  · Har bir interaktiv element klaviaturadan yetib boradi va focus halqasi bor.
*/

/* ── Spinner ─────────────────────────────────────────────────────────────── */

/** Yuklanish belgisi. `label` berilsa skrin-riderga o'qiladi (§18). */
export function Spinner({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <>
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={cn("size-4 shrink-0 animate-spin", className)}
      >
        <circle
          cx="8"
          cy="8"
          r="6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.25"
        />
        <path
          d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}

/* ── Button ──────────────────────────────────────────────────────────────── */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-55 whitespace-nowrap";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-fg hover:bg-accent-hover shadow-[0_1px_2px_rgb(0_0_0/0.08)]",
  secondary:
    "bg-surface-raised text-ink border border-line-strong hover:bg-surface-inset",
  ghost: "text-ink-muted hover:bg-surface-inset hover:text-ink",
  danger:
    "bg-danger-soft text-danger border border-danger/25 hover:border-danger/50 hover:bg-danger/15",
};

/*
  Sensorli nishon o'lchami (§14, §20): `sm` ham 32px dan past tushmaydi va
  faqat ikkilamchi amallarda ishlatiladi. Asosiy amallar `md`/`lg`.
*/
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Yuklanish holati: spinner chiqadi va takroriy bosish bloklanadi (§18). */
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <button
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner label={loadingLabel} /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <a
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  );
}

/* ── Form controls ───────────────────────────────────────────────────────── */

const fieldBase =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink " +
  "placeholder:text-ink-subtle transition-colors focus:border-accent " +
  "disabled:bg-surface-inset disabled:text-ink-muted " +
  "aria-[invalid=true]:border-danger";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-10", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "py-2 resize-none", className)} {...props} />;
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, "h-10", className)} {...props} />;
}

/**
 * Maydon qobig'i.
 *
 * Yordam matni va xato `aria-describedby` orqali bog'lanadi — skrin-rider
 * maydonga kirganda sababni ham o'qiydi (§20). `htmlFor` berilsa yorliq
 * bosilganda maydonga fokus tushadi.
 */
export function Field({
  label,
  hint,
  error,
  success,
  htmlFor,
  required,
  tooltip,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  /** Ijobiy tasdiq — masalan «username bo'sh» (§3). */
  success?: string;
  htmlFor?: string;
  required?: boolean;
  /** Texnik atama izohi — ⓘ belgisi yonida chiqadi (§11). */
  tooltip?: ReactNode;
  children: ReactNode;
}) {
  const describedBy =
    (htmlFor
      ? [error ? `${htmlFor}-error` : null, !error && hint ? `${htmlFor}-hint` : null]
          .filter(Boolean)
          .join(" ")
      : "") || undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
          {label}
          {required ? (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {tooltip}
      </div>

      {/* Boshqaruvga `aria-describedby` va `aria-invalid` shu yerda ulanadi —
          har bir chaqiruvchi qo'lda takrorlamasin. Chaqiruvchi o'zi bergan
          qiymat ustun turadi. */}
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
            "aria-describedby":
              (children.props as Record<string, unknown>)["aria-describedby"] ??
              describedBy ??
              undefined,
            "aria-invalid":
              (children.props as Record<string, unknown>)["aria-invalid"] ??
              (error ? true : undefined),
          })
        : children}

      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="flex items-start gap-1 text-xs text-danger">
          <span aria-hidden="true">✕</span>
          {error}
        </p>
      ) : success ? (
        <p className="flex items-start gap-1 text-xs text-success">
          <span aria-hidden="true">✓</span>
          {success}
        </p>
      ) : hint ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Yoniq/o'chiq tugmasi — klaviatura va skrin-riderlar uchun to'liq belgilangan. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
          checked ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]",
            checked ? "left-[1.375rem]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

/* ── Layout primitives ───────────────────────────────────────────────────── */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface-raised",
        className,
      )}
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 shrink-0 text-ink-subtle">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-ink-subtle">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type BadgeTone = "neutral" | "accent" | "success" | "danger" | "warning";

export function Badge({
  tone = "neutral",
  dot = false,
  children,
}: {
  tone?: BadgeTone;
  /** Holat nuqtasi — rangga qo'shimcha, rangni ko'rmaydiganlar uchun (§20). */
  dot?: boolean;
  children: ReactNode;
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-surface-inset text-ink-muted",
    accent: "bg-accent-soft text-accent",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {dot ? (
        <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}

/**
 * Bo'sh holat (§19).
 *
 * Har doim uchta narsani beradi: nima yo'q, nega kerak, va keyingi amal.
 * Sarlavha haqiqiy `h2` — sahifa tuzilishi skrin-riderda ham to'g'ri chiqadi.
 */
export function EmptyState({
  title,
  body,
  icon,
  action,
  secondaryAction,
}: {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-surface-inset text-ink-subtle">
          {icon}
        </div>
      ) : null}
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {body ? (
        <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{body}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

type AlertTone = "danger" | "success" | "accent" | "warning" | "info";

const alertGlyph: Record<AlertTone, string> = {
  danger: "✕",
  success: "✓",
  accent: "✦",
  warning: "!",
  info: "i",
};

/**
 * Xabar bloki (§10).
 *
 * Xatolar `role="alert"` bilan darhol e'lon qilinadi, muvaffaqiyat va
 * ma'lumot esa `role="status"` — foydalanuvchi ishini bo'lmaydi.
 */
export function Alert({
  tone = "danger",
  title,
  action,
  children,
}: {
  tone?: AlertTone;
  /** Qalin birinchi qator — «nima bo'ldi». Matn esa «nega/nima qilish kerak». */
  title?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const tones: Record<AlertTone, string> = {
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
    accent: "bg-accent-soft text-accent",
    warning: "bg-warning-soft text-warning",
    info: "bg-surface-inset text-ink-muted",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-lg px-3 py-2.5 text-sm", tones[tone])}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-current/15 text-[10px] font-bold"
        >
          {alertGlyph[tone]}
        </span>
        <div className="min-w-0 flex-1">
          {title ? <p className="font-medium">{title}</p> : null}
          {children ? (
            <div className={cn("min-w-0", title && "mt-0.5 opacity-90")}>{children}</div>
          ) : null}
          {action ? <div className="mt-2">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** Sahifa sarlavhasi — dashboard bo'limlarida takrorlanadi. */
export function PageHeading({
  title,
  subtitle,
  action,
  breadcrumbs,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  breadcrumbs?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {breadcrumbs ? <div className="mb-3">{breadcrumbs}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
    </div>
  );
}

/* ── Navigatsiya nishonlari (§16) ────────────────────────────────────────── */

export type Crumb = { label: string; href?: string };

/**
 * «Men qayerdaman?» savoliga javob.
 *
 * Oxirgi bo'g'in havola emas va `aria-current="page"` oladi. Mobil ekranda
 * o'rtadagi bo'g'inlar yashiriladi — gorizontal scroll paydo bo'lmasin (§14).
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-subtle">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? (
                <span aria-hidden="true" className="text-line-strong">
                  /
                </span>
              ) : null}
              {item.href && !last ? (
                <a
                  href={item.href}
                  className="rounded transition-colors hover:text-ink"
                >
                  {item.label}
                </a>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "font-medium text-ink" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Qadamlar ko'rsatkichi (§3).
 *
 * Foydalanuvchi har doim uchta narsani biladi: nechanchi qadamdaman, nechta
 * qadam bor, va oldinda nima turibdi. Ish stolida to'liq ro'yxat, mobilda
 * ixcham «2 / 5 · Telegram ulash» shakli — ikkalasi ham bir xil DOM'dan.
 */
export function Stepper({
  steps,
  current,
  ofLabel = "/",
}: {
  steps: string[];
  /** 0 dan boshlanadi. */
  current: number;
  ofLabel?: string;
}) {
  return (
    <div>
      {/* Mobil: ixcham */}
      <div className="sm:hidden">
        <p className="text-xs font-medium text-ink-subtle">
          {current + 1} {ofLabel} {steps.length}
        </p>
        <p className="mt-0.5 text-sm font-medium text-ink">{steps[current]}</p>
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-surface-inset"
          role="progressbar"
          aria-valuenow={current + 1}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-label={steps[current]}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Ish stoli: to'liq */}
      <ol className="hidden items-center gap-1 sm:flex">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={step} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                  done
                    ? "bg-success-soft text-success"
                    : active
                      ? "bg-accent text-accent-fg"
                      : "bg-surface-inset text-ink-subtle",
                )}
              >
                {done ? "✓" : index + 1}
              </span>
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "truncate text-xs transition-colors",
                  active ? "font-semibold text-ink" : "text-ink-subtle",
                )}
              >
                <span className="sr-only">
                  {index + 1} {ofLabel} {steps.length}:{" "}
                </span>
                {step}
              </span>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px min-w-3 flex-1",
                    done ? "bg-success/40" : "bg-line",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ── Yuklanish (§18) ─────────────────────────────────────────────────────── */

/** Kontent shakliga mos kulrang blok — sakrash bo'lmasin. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-surface-inset", className)}
    />
  );
}

/** Bot kartalari uchun tayyor skelet. */
export function CardSkeleton() {
  return (
    <div className="rounded-card border border-line bg-surface-raised p-4">
      <div className="flex items-start gap-2.5">
        <Skeleton className="size-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="mt-5 h-3 w-1/2" />
    </div>
  );
}

/* ── Saqlash holati (§17) ────────────────────────────────────────────────── */

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

/**
 * «Ishim yo'qoladimi?» savolini yopadi.
 *
 * Doim bir joyda turadi va faqat matni o'zgaradi — ko'z uni qidirmaydi.
 * `role="status"` bo'lgani uchun skrin-rider ham saqlanganini eshitadi.
 */
export function SaveIndicator({
  status,
  labels,
}: {
  status: SaveStatus;
  labels: { dirty: string; saving: string; saved: string; error: string };
}) {
  if (status === "idle") return null;

  const map = {
    dirty: { text: labels.dirty, className: "text-warning" },
    saving: { text: labels.saving, className: "text-ink-subtle" },
    saved: { text: labels.saved, className: "text-success" },
    error: { text: labels.error, className: "text-danger" },
  } as const;

  const view = map[status];

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium", view.className)}
    >
      {status === "saving" ? <Spinner className="size-3" /> : null}
      {status === "saved" ? <span aria-hidden="true">✓</span> : null}
      {status === "dirty" ? (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      ) : null}
      {view.text}
    </span>
  );
}

/* ── Ro'yxat elementi ────────────────────────────────────────────────────── */

/**
 * Nomi/tavsifi/amali bor qator — sozlamalar va yordam sahifalarida takrorlanadi.
 * Bitta shaklda turgani uchun sahifadan sahifaga o'tganda ko'z moslashmaydi.
 */
export function Row({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-muted">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{title}</p>
          {description ? (
            <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
