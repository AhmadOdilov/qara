"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";
import { ProgressRing } from "@/components/vocab/progress-ring";
import type { Summary, WordStat } from "@/lib/vocab/session";

export function ResultScreen({
  summary,
  practiceIds,
  onRetake,
  onPractice,
}: {
  summary: Summary;
  practiceIds: string[];
  onRetake: () => void;
  onPractice: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* ── Asosiy natija ─────────────────────────────────────────────── */}
      <section className="rounded-card border border-line bg-surface-raised p-6 text-center shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">
          Your Vocabulary Result
        </p>

        <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
          <ProgressRing percent={summary.percent} label="score" />

          <div className="text-center sm:text-left">
            <p className="text-5xl font-semibold tabular-nums text-ink">
              {summary.score}
              <span className="text-2xl text-ink-subtle"> / {summary.maxScore}</span>
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {summary.percent}% correct across {summary.total} questions
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-lg font-semibold text-accent">
              <span aria-hidden="true">{summary.level.emoji}</span>
              {summary.level.label}
            </p>
          </div>
        </div>
      </section>

      {/* ── Statistika ────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total Words" value={summary.total} />
        <Stat label="Correct" value={summary.correct} tone="success" />
        <Stat label="Partially Correct" value={summary.partial} tone="warning" />
        <Stat label="Wrong" value={summary.wrong} tone="danger" />
      </section>

      {/* ── Amallar ───────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="w-full sm:w-auto" onClick={onRetake}>
          🔄 Retake Test
        </Button>
        {practiceIds.length > 0 ? (
          <Button
            size="lg"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={onPractice}
          >
            🔴 Practice {practiceIds.length}{" "}
            {practiceIds.length === 1 ? "Weak Word" : "Weak Words"}
          </Button>
        ) : null}
      </section>

      {practiceIds.length > 0 ? (
        <p className="-mt-3 text-sm text-ink-muted">
          Practice covers every word you missed at least once — weak words plus
          review words.
        </p>
      ) : null}

      {/* ── Zaif so'zlar ──────────────────────────────────────────────── */}
      {summary.weak.length > 0 ? (
        <WordSection
          title="🔴 Weak Words"
          description="You answered these incorrectly. Review them, then practise again."
          words={summary.weak}
          tone="danger"
          openByDefault
        />
      ) : null}

      {summary.review.length > 0 ? (
        <WordSection
          title="🟡 Review Words"
          description="You got these right sometimes, but not always."
          words={summary.review}
          tone="warning"
        />
      ) : null}

      {summary.strong.length > 0 ? (
        <WordSection
          title="🟢 Strong Words"
          description="Answered correctly every time."
          words={summary.strong}
          tone="success"
        />
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "danger";
}) {
  return (
    <div className="rounded-card border border-line bg-surface-raised p-4 text-center">
      <p
        className={cn(
          "text-3xl font-semibold tabular-nums",
          tone === "success"
            ? "text-success"
            : tone === "warning"
              ? "text-warning"
              : tone === "danger"
                ? "text-danger"
                : "text-ink",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-ink-muted">{label}</p>
    </div>
  );
}

function WordSection({
  title,
  description,
  words,
  tone,
  openByDefault = false,
}: {
  title: string;
  description: string;
  words: WordStat[];
  tone: "success" | "warning" | "danger";
  openByDefault?: boolean;
}) {
  const [open, setOpen] = useState(openByDefault);

  return (
    <section className="rounded-card border border-line bg-surface-raised">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="block text-base font-semibold text-ink">
            {title}{" "}
            <span className="text-ink-subtle">({words.length})</span>
          </span>
          <span className="mt-0.5 block text-sm text-ink-muted">{description}</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-ink-subtle">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <ul className="space-y-3 border-t border-line px-5 py-4">
          {words.map((word) => (
            <li
              key={word.wordId}
              className={cn(
                "rounded-lg border-l-4 bg-surface-sunken px-4 py-3",
                tone === "success"
                  ? "border-success"
                  : tone === "warning"
                    ? "border-warning"
                    : "border-danger",
              )}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-base font-semibold first-letter:uppercase text-ink">
                  {word.word}
                </span>
                <span className="text-ink-subtle">→</span>
                <span className="text-base text-ink">{word.meaning}</span>
                <span className="ml-auto shrink-0 text-xs text-ink-subtle">
                  {word.level} · ✓{word.correct} ✕{word.wrong}
                </span>
              </div>
              <p className="mt-1 text-sm italic text-ink-muted">{word.example}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
