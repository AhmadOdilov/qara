"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { QuestionCard } from "@/components/vocab/question-card";
import { ResultScreen } from "@/components/vocab/result-screen";
import { allWordIds, generateQuestions } from "@/lib/vocab/questions";
import { randomSeed } from "@/lib/vocab/rng";
import {
  createState,
  parseState,
  practiceWordIds,
  summarize,
  type AnswerRecord,
  type Mode,
  type TestState,
} from "@/lib/vocab/session";
import {
  getServerSnapshot,
  getSnapshot,
  hydrationStore,
  subscribe,
  writeState,
} from "@/lib/vocab/store";
import { WORDS } from "@/lib/vocab/words";

export function VocabApp() {
  // Holat localStorage'da yashaydi — React uni faqat o'qiydi.
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const state = useMemo(() => parseState(raw), [raw]);

  const hydrated = useSyncExternalStore(
    hydrationStore.subscribe,
    hydrationStore.getSnapshot,
    hydrationStore.getServerSnapshot,
  );

  /** Saqlangan test darhol ochilmaydi — avval "Continue Test" taklif etiladi. */
  const [resumed, setResumed] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  // Savollar saqlanmaydi — seed va so'zlar ro'yxatidan qayta yasaladi.
  const seed = state?.seed ?? 0;
  const wordKey = state?.wordIds.join(",") ?? "";
  const questions = useMemo(
    () => (wordKey ? generateQuestions(seed, wordKey.split(",")) : []),
    [seed, wordKey],
  );

  const summary = useMemo(() => (state ? summarize(state) : null), [state]);

  function begin(wordIds: string[], mode: Mode) {
    writeState(createState(randomSeed(), wordIds, mode));
    setResumed(true);
    setConfirmRestart(false);
    window.scrollTo({ top: 0 });
  }

  function handleSubmit(record: AnswerRecord) {
    if (!state) return;
    const answers = state.answers.slice();
    answers[state.index] = record;
    writeState({ ...state, answers });
  }

  function handleNext() {
    if (!state) return;
    const isLast = state.index + 1 >= state.wordIds.length;
    const next: TestState = isLast
      ? { ...state, finishedAt: Date.now() }
      : { ...state, index: state.index + 1 };
    writeState(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ── Fazalar ───────────────────────────────────────────────────────── */

  if (!hydrated) {
    return (
      <div className="rounded-card border border-line bg-surface-raised p-8 text-center text-ink-muted">
        Loading…
      </div>
    );
  }

  if (state && state.finishedAt && summary) {
    return (
      <ResultScreen
        summary={summary}
        practiceIds={practiceWordIds(summary)}
        onRetake={() => begin(allWordIds(), "full")}
        onPractice={() => begin(practiceWordIds(summary), "practice")}
      />
    );
  }

  if (!state || !resumed) {
    return (
      <StartScreen
        saved={state}
        onContinue={() => setResumed(true)}
        onStart={() => begin(allWordIds(), "full")}
      />
    );
  }

  const current = questions[state.index];
  if (!current) {
    // Nazariy jihatdan yetib bo'lmaydigan holat — baribir chiqish yo'li beramiz.
    return (
      <div className="rounded-card border border-line bg-surface-raised p-8 text-center">
        <p className="text-ink">Something went wrong. Please try again.</p>
        <Button className="mt-4" onClick={() => begin(allWordIds(), "full")}>
          Restart test
        </Button>
      </div>
    );
  }

  const answered = state.answers.filter(Boolean).length;
  const score = state.answers.reduce((sum, a) => sum + (a?.points ?? 0), 0);
  const total = state.wordIds.length;
  const percent = Math.round((state.index / total) * 100);

  return (
    <div className="space-y-5">
      <section className="rounded-card border border-line bg-surface-raised p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">
            {state.mode === "practice" ? "Weak word practice" : "Full test"}
            <span className="text-ink-subtle"> · {score} pts</span>
          </p>
          <p className="text-sm font-semibold tabular-nums text-ink">
            {state.index + 1} / {total}
          </p>
        </div>

        <div
          className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-inset"
          role="progressbar"
          aria-valuenow={answered}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Test progress"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
          <span className="text-ink-subtle">Progress is saved automatically</span>
          {confirmRestart ? (
            <span className="flex items-center gap-2">
              <span className="text-ink-muted">Start over?</span>
              <button
                type="button"
                onClick={() => begin(allWordIds(), "full")}
                className="font-semibold text-danger underline underline-offset-2"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmRestart(false)}
                className="text-ink-muted underline underline-offset-2"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRestart(true)}
              className="text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              Start over
            </button>
          )}
        </div>
      </section>

      <QuestionCard
        key={current.id}
        question={current}
        number={state.index + 1}
        total={total}
        answer={state.answers[state.index]}
        onSubmit={handleSubmit}
        onNext={handleNext}
        isLast={state.index + 1 >= total}
      />
    </div>
  );
}

/* ── Boshlanish ekrani ───────────────────────────────────────────────────── */

function StartScreen({
  saved,
  onContinue,
  onStart,
}: {
  saved: TestState | null;
  onContinue: () => void;
  onStart: () => void;
}) {
  const canContinue = Boolean(saved && !saved.finishedAt);

  return (
    <div className="space-y-5">
      <section className="rounded-card border border-line bg-surface-raised p-6 shadow-[var(--shadow-md)] sm:p-8">
        <h2 className="text-2xl font-semibold text-ink sm:text-3xl">
          Test your {WORDS.length} words
        </h2>
        <p className="mt-2 text-base leading-relaxed text-ink-muted">
          Every word is tested at least once, in random order, using six different
          question types — so the test shows what you really know, not just what you
          can recognise.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Words" value={String(WORDS.length)} />
          <Fact label="Questions" value={String(WORDS.length)} />
          <Fact label="Max score" value={String(WORDS.length * 2)} />
          <Fact label="Level" value="B1–B2" />
        </dl>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {canContinue && saved ? (
            <>
              <Button size="lg" className="w-full sm:w-auto" onClick={onContinue}>
                Continue Test · {saved.index + 1} / {saved.wordIds.length}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={onStart}
              >
                Start New Test
              </Button>
            </>
          ) : (
            <Button size="lg" className="w-full sm:w-auto" onClick={onStart}>
              Start Test
            </Button>
          )}
        </div>

        {canContinue ? (
          <p className="mt-3 text-sm text-ink-muted">
            You have an unfinished test saved in this browser.
          </p>
        ) : null}
      </section>

      <section className="rounded-card border border-line bg-surface-raised p-6 sm:p-8">
        <h3 className="text-base font-semibold text-ink">Question types</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ["English → Uzbek", "Choose the correct meaning of a word."],
            ["Uzbek → English", "Choose the English word for a meaning."],
            ["Fill in the blank", "Type the missing word in a sentence."],
            ["Meaning in context", "Work out the meaning from a real sentence."],
            ["Write a sentence", "Use the word yourself — checked automatically."],
            ["Matching", "Match four words with four meanings."],
          ].map(([title, body]) => (
            <li key={title} className="rounded-lg bg-surface-sunken px-4 py-3">
              <p className="text-sm font-medium text-ink">{title}</p>
              <p className="text-sm text-ink-muted">{body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-sunken px-4 py-3">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="text-xl font-semibold text-ink">{value}</dd>
    </div>
  );
}
