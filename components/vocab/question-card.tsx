"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";
import { WORD_BY_ID } from "@/lib/vocab/words";
import type { Question, QuestionType } from "@/lib/vocab/questions";
import { gradeBlank, gradeChoice, gradeMatching, type Graded } from "@/lib/vocab/grade";
import { evaluateSentence } from "@/lib/vocab/evaluate";
import type { AnswerRecord } from "@/lib/vocab/session";

const TYPE_LABEL: Record<QuestionType, string> = {
  "en-uz": "English → Uzbek",
  "uz-en": "Uzbek → English",
  "fill-blank": "Fill in the blank",
  context: "Meaning in context",
  sentence: "Write a sentence",
  matching: "Matching",
};

const GENERIC_ERROR = "Something went wrong. Please try again.";

export function QuestionCard({
  question,
  number,
  total,
  answer,
  onSubmit,
  onNext,
  isLast,
}: {
  question: Question;
  number: number;
  total: number;
  answer: AnswerRecord | null;
  onSubmit: (record: AnswerRecord) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const revealed = answer !== null;
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Har bir savol `key` bilan qayta mount bo'ladi — kiritmalar o'z-o'zidan
  // tozalanadi, bu yerda faqat fokus qo'yiladi.
  useEffect(() => {
    if (revealed) return;
    if (question.kind === "blank") inputRef.current?.focus();
    if (question.kind === "sentence") textareaRef.current?.focus();
  }, [question.kind, revealed]);

  function record(graded: Graded, given: string): AnswerRecord {
    return {
      points: graded.points,
      given,
      correctLabel: graded.correctLabel,
      feedback: graded.feedback,
      perWord: graded.perWord,
    };
  }

  async function submit() {
    if (busy || revealed) return;
    setError(null);
    setNotice(null);

    if (question.kind === "choice") {
      if (selected === null) return setError("Please select an answer.");
      onSubmit(record(gradeChoice(question, selected), question.options[selected]));
      return;
    }

    if (question.kind === "blank") {
      if (!typed.trim()) return setError("Please type your answer.");
      onSubmit(record(gradeBlank(question, typed), typed.trim()));
      return;
    }

    if (question.kind === "matching") {
      const missing = question.pairs.some((p) => !matches[p.wordId]);
      if (missing) return setError("Please match every word.");
      onSubmit(record(gradeMatching(question, matches), "—"));
      return;
    }

    // Gap yozish — server AI bilan yoki qoidalar bilan baholaydi.
    const sentence = typed.trim();
    if (!sentence) return setError("Please write a sentence.");

    const word = WORD_BY_ID.get(question.wordIds[0]);
    if (!word) return setError(GENERIC_ERROR);

    setBusy(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("/api/vocab/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wordId: question.wordIds[0], sentence }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(String(response.status));

      const verdict = (await response.json()) as {
        points: 0 | 1 | 2;
        feedback: string;
      };
      onSubmit({
        points: verdict.points,
        given: sentence,
        correctLabel: `${word.word} — ${word.meaning}`,
        feedback: verdict.feedback,
        perWord: [{ wordId: question.wordIds[0], correct: verdict.points === 2 }],
      });
    } catch {
      // Tarmoq uzilsa ham javob yo'qolmaydi: shu yerda qoidalar bilan baholanadi.
      const local = evaluateSentence(word, sentence);
      setNotice(`${GENERIC_ERROR} Your answer was checked offline.`);
      onSubmit({
        points: local.points,
        given: sentence,
        correctLabel: `${word.word} — ${word.meaning}`,
        feedback: local.feedback,
        perWord: [{ wordId: question.wordIds[0], correct: local.points === 2 }],
      });
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-surface-raised p-5 shadow-[var(--shadow-md)] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-muted">
          Question {number}
          <span className="text-ink-subtle"> / {total}</span>
        </h2>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
          {TYPE_LABEL[question.type]}
        </span>
      </div>

      <p className="mt-4 text-lg font-medium leading-snug text-ink sm:text-xl">
        {question.instruction}
      </p>

      {question.kind === "choice" ? (
        <ChoiceBody
          question={question}
          selected={selected}
          setSelected={setSelected}
          answer={answer}
        />
      ) : null}

      {question.kind === "blank" ? (
        <BlankBody
          question={question}
          typed={typed}
          setTyped={setTyped}
          answer={answer}
          inputRef={inputRef}
          onEnter={submit}
        />
      ) : null}

      {question.kind === "sentence" ? (
        <SentenceBody
          question={question}
          typed={typed}
          setTyped={setTyped}
          answer={answer}
          textareaRef={textareaRef}
        />
      ) : null}

      {question.kind === "matching" ? (
        <MatchingBody
          question={question}
          matches={matches}
          setMatches={setMatches}
          answer={answer}
        />
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="mt-4 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning"
        >
          {notice}
        </p>
      ) : null}

      {revealed ? (
        <Feedback answer={answer} question={question} />
      ) : null}

      <div className="mt-6">
        {revealed ? (
          <Button size="lg" className="w-full sm:w-auto" onClick={onNext}>
            {isLast ? "See Results →" : "Next Question →"}
          </Button>
        ) : (
          <Button size="lg" className="w-full sm:w-auto" onClick={submit} disabled={busy}>
            {busy ? "Checking…" : "Submit Answer"}
          </Button>
        )}
      </div>
    </section>
  );
}

/* ── Savol turlari ───────────────────────────────────────────────────────── */

function ChoiceBody({
  question,
  selected,
  setSelected,
  answer,
}: {
  question: Extract<Question, { kind: "choice" }>;
  selected: number | null;
  setSelected: (index: number) => void;
  answer: AnswerRecord | null;
}) {
  return (
    <div className="mt-4">
      {question.context ? (
        <blockquote className="mb-4 rounded-lg border-l-4 border-accent bg-surface-sunken px-4 py-3 text-base italic leading-relaxed text-ink">
          {question.context}
        </blockquote>
      ) : null}

      <p className="mb-3 text-2xl font-semibold text-ink">&ldquo;{question.subject}&rdquo;</p>

      <ul className="space-y-2">
        {question.options.map((option, index) => {
          const isCorrect = index === question.correctIndex;
          const chosen = answer ? answer.given === option : selected === index;
          const wrongPick = Boolean(answer) && chosen && !isCorrect;

          return (
            <li key={option}>
              <button
                type="button"
                disabled={Boolean(answer)}
                onClick={() => setSelected(index)}
                aria-pressed={chosen}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-base transition-colors",
                  "disabled:cursor-default",
                  answer && isCorrect
                    ? "border-success bg-success-soft text-ink"
                    : wrongPick
                      ? "border-danger bg-danger-soft text-ink"
                      : chosen
                        ? "border-accent bg-accent-soft text-ink"
                        : "border-line-strong bg-surface hover:bg-surface-inset",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    answer && isCorrect
                      ? "border-success text-success"
                      : wrongPick
                        ? "border-danger text-danger"
                        : chosen
                          ? "border-accent bg-accent text-accent-fg"
                          : "border-line-strong text-ink-subtle",
                  )}
                >
                  {answer && isCorrect ? "✓" : wrongPick ? "✕" : "ABCD"[index]}
                </span>
                <span>{option}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BlankBody({
  question,
  typed,
  setTyped,
  answer,
  inputRef,
  onEnter,
}: {
  question: Extract<Question, { kind: "blank" }>;
  typed: string;
  setTyped: (value: string) => void;
  answer: AnswerRecord | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onEnter: () => void;
}) {
  return (
    <div className="mt-4">
      <p className="rounded-lg bg-surface-sunken px-4 py-3 text-base leading-relaxed text-ink sm:text-lg">
        {question.sentence}
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        Hint (Uzbek): <span className="font-medium text-ink">{question.hint}</span>
      </p>

      <input
        ref={inputRef}
        type="text"
        value={answer ? answer.given : typed}
        disabled={Boolean(answer)}
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onEnter();
          }
        }}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="Type the missing word"
        aria-label="Missing word"
        className="mt-4 h-12 w-full rounded-lg border border-line-strong bg-surface px-4 text-base text-ink placeholder:text-ink-subtle focus:border-accent disabled:bg-surface-inset"
      />
    </div>
  );
}

function SentenceBody({
  question,
  typed,
  setTyped,
  answer,
  textareaRef,
}: {
  question: Extract<Question, { kind: "sentence" }>;
  typed: string;
  setTyped: (value: string) => void;
  answer: AnswerRecord | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="mt-4">
      <div className="rounded-lg bg-surface-sunken px-4 py-3">
        <p className="text-2xl font-semibold text-ink">{question.word}</p>
        <p className="text-sm text-ink-muted">{question.meaning}</p>
      </div>

      <textarea
        ref={textareaRef}
        rows={3}
        maxLength={300}
        value={answer ? answer.given : typed}
        disabled={Boolean(answer)}
        onChange={(event) => setTyped(event.target.value)}
        placeholder={`Write one English sentence with "${question.word}"…`}
        aria-label="Your sentence"
        className="mt-4 w-full resize-none rounded-lg border border-line-strong bg-surface px-4 py-3 text-base leading-relaxed text-ink placeholder:text-ink-subtle focus:border-accent disabled:bg-surface-inset"
      />
      {!answer ? (
        <p className="mt-1 text-right text-xs text-ink-subtle">{typed.length}/300</p>
      ) : null}
    </div>
  );
}

function MatchingBody({
  question,
  matches,
  setMatches,
  answer,
}: {
  question: Extract<Question, { kind: "matching" }>;
  matches: Record<string, string>;
  setMatches: (value: Record<string, string>) => void;
  answer: AnswerRecord | null;
}) {
  const outcome = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const item of answer?.perWord ?? []) map.set(item.wordId, item.correct);
    return map;
  }, [answer]);

  return (
    <div className="mt-4 space-y-3">
      {question.pairs.map((pair) => {
        const isCorrect = outcome.get(pair.wordId);
        return (
          <div
            key={pair.wordId}
            className={cn(
              "gap-3 rounded-lg border px-4 py-3 sm:flex sm:items-center sm:justify-between",
              answer === null
                ? "border-line-strong bg-surface"
                : isCorrect
                  ? "border-success bg-success-soft"
                  : "border-danger bg-danger-soft",
            )}
          >
            <span className="text-base font-medium text-ink">{pair.word}</span>

            {answer ? (
              <span className="mt-1 block text-sm text-ink sm:mt-0">
                {isCorrect ? "✓ " : "✕ "}
                {pair.meaning}
              </span>
            ) : (
              <select
                aria-label={`Meaning of ${pair.word}`}
                value={matches[pair.wordId] ?? ""}
                onChange={(event) =>
                  setMatches({ ...matches, [pair.wordId]: event.target.value })
                }
                className="mt-2 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent sm:mt-0 sm:w-64"
              >
                <option value="">Choose meaning…</option>
                {question.choices.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Javobdan keyingi izoh ───────────────────────────────────────────────── */

function Feedback({ answer, question }: { answer: AnswerRecord; question: Question }) {
  const tone =
    answer.points === 2
      ? { text: "🟢 Correct!", className: "border-success/30 bg-success-soft text-success" }
      : answer.points === 1
        ? {
            text: "🟡 Partially correct",
            className: "border-warning/30 bg-warning-soft text-warning",
          }
        : { text: "🔴 Incorrect", className: "border-danger/30 bg-danger-soft text-danger" };

  const words = question.wordIds
    .map((id) => WORD_BY_ID.get(id))
    .filter((w): w is NonNullable<typeof w> => Boolean(w));

  return (
    <div className={cn("mt-5 rounded-lg border p-4", tone.className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold">{tone.text}</p>
        <span className="shrink-0 rounded-full bg-surface-raised px-2.5 py-1 text-xs font-semibold text-ink">
          +{answer.points} {answer.points === 1 ? "point" : "points"}
        </span>
      </div>

      {answer.feedback ? (
        <p className="mt-2 text-sm text-ink">{answer.feedback}</p>
      ) : null}

      <div className="mt-3 space-y-2 text-ink">
        {words.map((word) => (
          <div key={word.word}>
            <p className="text-sm">
              <span className="font-semibold first-letter:uppercase">{word.word}</span> = {word.meaning}
            </p>
            <p className="text-sm italic text-ink-muted">{word.examples[0]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
