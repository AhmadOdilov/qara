"use client";

import { useEffect, useState } from "react";

/**
 * Animatsiyali doiraviy progress. Boshlanishida 0 dan `percent` gacha
 * "o'sadi"; `prefers-reduced-motion` yoqilgan bo'lsa — darhol yakuniy holat.
 */
export function ProgressRing({
  percent,
  size = 176,
  stroke = 12,
  label,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const target = Math.max(0, Math.min(100, Math.round(percent)));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Harakat kamaytirilgan bo'lsa — animatsiyasiz, birinchi kadrdayoq yakuniy holat.
    const duration = reduced ? 0 : 1100;

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      // easeOutCubic — oxirida sekinlashadi
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - shown / 100);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${target}%${label ? ` — ${label}` : ""}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-inset)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tabular-nums text-ink">{shown}%</span>
        {label ? (
          <span className="mt-0.5 text-xs font-medium text-ink-muted">{label}</span>
        ) : null}
      </div>
    </div>
  );
}
