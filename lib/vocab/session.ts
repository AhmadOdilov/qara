import { POINTS_PER_QUESTION } from "./questions";
import type { Points, WordOutcome } from "./grade";
import { WORD_BY_ID, wordId, WORDS } from "./words";

export type Mode = "full" | "practice";

export type AnswerRecord = {
  points: Points;
  /** Foydalanuvchi javobi — natijalar sahifasida ko'rsatish uchun. */
  given: string;
  correctLabel: string;
  feedback?: string;
  perWord: WordOutcome[];
};

export type TestState = {
  version: 1;
  seed: number;
  mode: Mode;
  wordIds: string[];
  index: number;
  answers: (AnswerRecord | null)[];
  startedAt: number;
  finishedAt: number | null;
};

export const STORAGE_KEY = "vocab-test:v1";

export function createState(seed: number, wordIds: string[], mode: Mode): TestState {
  return {
    version: 1,
    seed,
    mode,
    wordIds,
    index: 0,
    answers: wordIds.map(() => null),
    startedAt: Date.now(),
    finishedAt: null,
  };
}

/* ── Saqlash ─────────────────────────────────────────────────────────────── */
/* O'qish/yozishning o'zi `store.ts` da — bu yerda faqat tekshiruv. */

/** Buzilgan yoki eski formatdagi yozuvni jimgina rad etadi. */
export function parseState(raw: string | null): TestState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TestState>;
    if (
      value?.version !== 1 ||
      typeof value.seed !== "number" ||
      !Array.isArray(value.wordIds) ||
      !Array.isArray(value.answers) ||
      value.answers.length !== value.wordIds.length ||
      typeof value.index !== "number"
    ) {
      return null;
    }
    // Lug'atdan olib tashlangan so'z bo'lsa — holat yaroqsiz.
    if (!value.wordIds.every((id) => WORD_BY_ID.has(id))) return null;
    return value as TestState;
  } catch {
    return null;
  }
}

/* ── Natija ──────────────────────────────────────────────────────────────── */

export type WordStatus = "strong" | "review" | "weak";

export type WordStat = {
  wordId: string;
  word: string;
  meaning: string;
  example: string;
  level: "B1" | "B2";
  correct: number;
  wrong: number;
  status: WordStatus;
};

export type LevelBadge = {
  key: "excellent" | "very-good" | "good" | "needs-practice" | "review";
  label: string;
  emoji: string;
};

export type Summary = {
  total: number;
  answered: number;
  score: number;
  maxScore: number;
  percent: number;
  level: LevelBadge;
  correct: number;
  partial: number;
  wrong: number;
  words: WordStat[];
  strong: WordStat[];
  review: WordStat[];
  weak: WordStat[];
};

/** Foizga asoslangan — amaliyot rejimida savollar soni 100 dan kam bo'ladi. */
export function levelFor(percent: number): LevelBadge {
  if (percent >= 90) return { key: "excellent", label: "Excellent", emoji: "🏆" };
  if (percent >= 80) return { key: "very-good", label: "Very Good", emoji: "🔥" };
  if (percent >= 70) return { key: "good", label: "Good", emoji: "👍" };
  if (percent >= 60) return { key: "needs-practice", label: "Needs Practice", emoji: "📚" };
  return { key: "review", label: "Review Required", emoji: "🔄" };
}

export function summarize(state: TestState): Summary {
  const total = state.wordIds.length;
  const maxScore = total * POINTS_PER_QUESTION;

  let score = 0;
  let correct = 0;
  let partial = 0;
  let wrong = 0;
  let answered = 0;

  // wordId → {correct, wrong}
  const tally = new Map<string, { correct: number; wrong: number }>();
  for (const id of state.wordIds) tally.set(id, { correct: 0, wrong: 0 });

  for (const answer of state.answers) {
    if (!answer) continue;
    answered += 1;
    score += answer.points;
    if (answer.points === 2) correct += 1;
    else if (answer.points === 1) partial += 1;
    else wrong += 1;

    for (const outcome of answer.perWord) {
      // Testga kirmagan so'z natijaga qo'shilmaydi.
      const row = tally.get(outcome.wordId);
      if (!row) continue;
      if (outcome.correct) row.correct += 1;
      else row.wrong += 1;
    }
  }

  const words: WordStat[] = [];
  for (const [id, counts] of tally) {
    const word = WORD_BY_ID.get(id);
    if (!word) continue;
    const status: WordStatus =
      counts.wrong === 0 && counts.correct > 0
        ? "strong"
        : counts.correct > 0 && counts.wrong > 0
          ? "review"
          : counts.wrong > 0
            ? "weak"
            : "review";
    words.push({
      wordId: id,
      word: word.word,
      meaning: word.meaning,
      example: word.examples[0],
      level: word.level,
      correct: counts.correct,
      wrong: counts.wrong,
      status,
    });
  }

  // Lug'atdagi tartibda — natija sahifasi barqaror ko'rinsin.
  const order = new Map(WORDS.map((w, i) => [wordId(w.word), i]));
  words.sort((a, b) => (order.get(a.wordId) ?? 0) - (order.get(b.wordId) ?? 0));

  const percent = maxScore ? Math.round((score / maxScore) * 100) : 0;

  return {
    total,
    answered,
    score,
    maxScore,
    percent,
    level: levelFor(percent),
    correct,
    partial,
    wrong,
    words,
    strong: words.filter((w) => w.status === "strong"),
    review: words.filter((w) => w.status === "review"),
    weak: words.filter((w) => w.status === "weak"),
  };
}

/** Qayta mashq uchun so'zlar: xato qilingan + qisman bilingan. */
export function practiceWordIds(summary: Summary): string[] {
  return [...summary.weak, ...summary.review].map((w) => w.wordId);
}
