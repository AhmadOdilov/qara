"use client";

import { useId, useMemo, useRef, useState } from "react";
import { formatAxisDay, formatDayLabel } from "@/lib/client";
import { cn } from "@/lib/cn";

/*
  Grafiklar uchun ranglar `.viz-root` ichida rol sifatida belgilanadi, shunda
  yorug'/qorong'i rejim bir joyda almashadi. Kategorik slotlar tartibi
  (orange → blue → aqua) validator bilan tekshirilgan: ikkala rejimda ham
  CVD ajratish va oddiy ko'rish chegaralaridan o'tadi.

  Yorug' rejimda aqua yuza bilan 3:1 dan past — shuning uchun aqua ishlatadigan
  har bir grafik qiymatni to'g'ridan-to'g'ri matn bilan ham ko'rsatadi.
*/

export type SeriesPoint = { day: string; sent: number; received: number };

const CHART_STYLE = `
.viz-root {
  --series-1: #eb6834;
  --series-2: #2a78d6;
  --series-3: #1baf7a;
  --viz-grid: #e1e0d9;
  --viz-axis: #c3c2b7;
}
@media (prefers-color-scheme: dark) {
  .viz-root {
    --series-1: #d95926;
    --series-2: #3987e5;
    --series-3: #199e70;
    --viz-grid: #2c2c2a;
    --viz-axis: #383835;
  }
}
`;

/** Grafik ranglarini bir marta e'lon qiladi (sahifa boshida chaqiriladi). */
export function VizStyle() {
  return <style dangerouslySetInnerHTML={{ __html: CHART_STYLE }} />;
}

/* ── Stat tile ───────────────────────────────────────────────────────────── */

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface-raised p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

/* ── Ikki seriyali chiziqli grafik ───────────────────────────────────────── */

type Hover = { index: number; x: number } | null;

/**
 * Kunlik yuborilgan/olingan xabarlar. Vaqt bo'yicha o'zgarish → chiziq.
 * Bitta y-o'q (ikkala seriya ham «xabar soni»), 2px chiziq, 10% area wash,
 * kursor ostida crosshair va tooltip.
 */
export function MessagesLineChart({
  data,
  labels,
  locale,
  emptyLabel,
}: {
  data: SeriesPoint[];
  labels: { sent: string; received: string };
  locale: string;
  emptyLabel: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<Hover>(null);

  const width = 720;
  const height = 240;
  const pad = { top: 16, right: 16, bottom: 28, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const max = useMemo(() => {
    const peak = Math.max(1, ...data.flatMap((d) => [d.sent, d.received]));
    // O'qni toza songa yaxlitlaymiz.
    const step = Math.pow(10, Math.floor(Math.log10(peak)));
    return Math.ceil(peak / step) * step;
  }, [data]);

  const total = data.reduce((sum, d) => sum + d.sent + d.received, 0);

  if (data.length === 0 || total === 0) {
    return (
      <p className="px-5 py-14 text-center text-sm text-ink-subtle">
        {emptyLabel}
      </p>
    );
  }

  const x = (index: number) =>
    pad.left + (data.length === 1 ? plotW / 2 : (index / (data.length - 1)) * plotW);
  const y = (value: number) => pad.top + plotH - (value / max) * plotH;

  const path = (key: "sent" | "received") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(d[key])}`).join(" ");

  const areaPath = (key: "sent" | "received") =>
    `${path(key)} L${x(data.length - 1)} ${pad.top + plotH} L${x(0)} ${pad.top + plotH} Z`;

  const ticks = [0, max / 2, max];

  // Har 1/6 oralig'ida sana yorlig'i — yorliqlar ustma-ust tushmasin.
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relative = ((event.clientX - rect.left) / rect.width) * width;
    const ratio = (relative - pad.left) / plotW;
    const index = Math.round(ratio * (data.length - 1));
    if (index < 0 || index >= data.length) {
      setHover(null);
      return;
    }
    setHover({ index, x: x(index) });
  }

  const active = hover ? data[hover.index] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none"
        role="img"
        aria-label={`${labels.sent} / ${labels.received}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${gradientId}-sent`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${gradientId}-recv`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-2)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--series-2)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* To'r — hairline, yuzadan bir qadam uzoq */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--viz-grid)"
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-[var(--text-subtle)] text-[10px] tabular-nums"
            >
              {Math.round(tick)}
            </text>
          </g>
        ))}

        {/* X o'qi yorliqlari */}
        {data.map((point, index) =>
          index % labelEvery === 0 || index === data.length - 1 ? (
            <text
              key={point.day}
              x={x(index)}
              y={height - 8}
              textAnchor="middle"
              className="fill-[var(--text-subtle)] text-[10px]"
            >
              {shortDay(point.day, locale)}
            </text>
          ) : null,
        )}

        <path d={areaPath("received")} fill={`url(#${gradientId}-recv)`} />
        <path d={areaPath("sent")} fill={`url(#${gradientId}-sent)`} />

        <path
          d={path("received")}
          fill="none"
          stroke="var(--series-2)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={path("sent")}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Crosshair va nuqtalar — yuza rangli halqa bilan */}
        {hover && active ? (
          <g>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={pad.top}
              y2={pad.top + plotH}
              stroke="var(--viz-axis)"
              strokeWidth={1}
            />
            <circle
              cx={hover.x}
              cy={y(active.received)}
              r={4}
              fill="var(--series-2)"
              stroke="var(--surface-raised)"
              strokeWidth={2}
            />
            <circle
              cx={hover.x}
              cy={y(active.sent)}
              r={4}
              fill="var(--series-1)"
              stroke="var(--surface-raised)"
              strokeWidth={2}
            />
          </g>
        ) : null}
      </svg>

      {/* Tooltip */}
      {hover && active ? (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-36 -translate-x-1/2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs"
          style={{
            left: `${(hover.x / width) * 100}%`,
            boxShadow: "var(--shadow-md)",
          }}
        >
          <p className="font-medium text-ink">{shortDay(active.day, locale, true)}</p>
          <p className="mt-1 flex items-center justify-between gap-3 text-ink-muted">
            <span className="flex items-center gap-1.5">
              <Swatch color="var(--series-1)" />
              {labels.sent}
            </span>
            <span className="font-medium tabular-nums text-ink">{active.sent}</span>
          </p>
          <p className="mt-0.5 flex items-center justify-between gap-3 text-ink-muted">
            <span className="flex items-center gap-1.5">
              <Swatch color="var(--series-2)" />
              {labels.received}
            </span>
            <span className="font-medium tabular-nums text-ink">
              {active.received}
            </span>
          </p>
        </div>
      ) : null}

      <Legend
        items={[
          { label: labels.sent, color: "var(--series-1)" },
          { label: labels.received, color: "var(--series-2)" },
        ]}
      />
    </div>
  );
}

/* ── Gorizontal bar ro'yxati ─────────────────────────────────────────────── */

export type BarRow = { key: string; label: string; value: number };

/**
 * Reyting yoki taqsimot uchun. Qiymat har doim bar yonida matn bilan
 * ko'rsatiladi — bu bir vaqtning o'zida to'g'ridan-to'g'ri yorliq va
 * yorug' ranglar uchun kontrast yengilligi (relief) bo'lib xizmat qiladi.
 */
export function BarList({
  rows,
  emptyLabel,
  colorBySlot = false,
  suffix,
}: {
  rows: BarRow[];
  emptyLabel: string;
  /** true — har qatorga o'z kategorik rangi (til taqsimoti kabi) */
  colorBySlot?: boolean;
  suffix?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  if (rows.length === 0) {
    return (
      <p className="px-5 py-12 text-center text-sm text-ink-subtle">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-3 px-5 py-4">
      {rows.map((row, index) => {
        const color = colorBySlot
          ? `var(--series-${(index % 3) + 1})`
          : "var(--series-1)";
        return (
          <li key={row.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-ink">{row.label}</span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
                {row.value}
                {suffix}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-surface-inset"
              role="presentation"
            >
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${Math.max(2, (row.value / max) * 100)}%`,
                  background: color,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Umumiy bo'laklar ────────────────────────────────────────────────────── */

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

function Legend({
  items,
  className,
}: {
  items: { label: string; color: string }[];
  className?: string;
}) {
  return (
    <ul className={cn("mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1", className)}>
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-xs text-ink-muted"
        >
          <Swatch color={item.color} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function shortDay(day: string, locale: string, long = false): string {
  const date = new Date(`${day}T00:00:00`);
  return long ? formatDayLabel(date, locale) : formatAxisDay(date, locale);
}
