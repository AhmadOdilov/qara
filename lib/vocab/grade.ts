import type { BlankQuestion, ChoiceQuestion, MatchingQuestion } from "./questions";

export type Points = 0 | 1 | 2;

/** Bitta savol bir nechta so'zga tegishli bo'lishi mumkin (matching). */
export type WordOutcome = { wordId: string; correct: boolean };

export type Graded = {
  points: Points;
  /** Foydalanuvchiga ko'rsatiladigan to'g'ri javob. */
  correctLabel: string;
  feedback?: string;
  perWord: WordOutcome[];
};

/** Kichik harf, tinish belgilarisiz, ortiqcha bo'shliqlarsiz. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein masofasi — kichik xatolarni (typo) kechirish uchun. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

export function gradeChoice(q: ChoiceQuestion, selected: number | null): Graded {
  const correct = selected === q.correctIndex;
  return {
    points: correct ? 2 : 0,
    correctLabel: q.options[q.correctIndex],
    perWord: q.wordIds.map((wordId) => ({ wordId, correct })),
  };
}

export function gradeBlank(q: BlankQuestion, typed: string): Graded {
  const answer = normalize(typed);
  const perWord = (correct: boolean) => q.wordIds.map((wordId) => ({ wordId, correct }));

  if (!answer) {
    return { points: 0, correctLabel: q.answer, perWord: perWord(false) };
  }
  if (q.exact.includes(answer)) {
    return { points: 2, correctLabel: q.answer, perWord: perWord(true) };
  }
  // So'zning boshqa shakli — ma'no to'g'ri, grammatika emas.
  if (q.partial.includes(answer)) {
    return {
      points: 1,
      correctLabel: q.answer,
      feedback: `Right word, wrong form. The sentence needs "${q.answer}".`,
      perWord: perWord(false),
    };
  }
  // Bitta harflik xato — yarim ball.
  const closest = [...q.exact, ...q.partial].some(
    (candidate) => candidate.length >= 5 && editDistance(answer, candidate) <= 1,
  );
  if (closest) {
    return {
      points: 1,
      correctLabel: q.answer,
      feedback: `Almost — check the spelling of "${q.answer}".`,
      perWord: perWord(false),
    };
  }
  return { points: 0, correctLabel: q.answer, perWord: perWord(false) };
}

/** `assignment`: wordId → foydalanuvchi tanlagan ma'no. */
export function gradeMatching(
  q: MatchingQuestion,
  assignment: Record<string, string>,
): Graded {
  const perWord = q.pairs.map((pair) => ({
    wordId: pair.wordId,
    correct: assignment[pair.wordId] === pair.meaning,
  }));
  const right = perWord.filter((p) => p.correct).length;

  const points: Points = right === q.pairs.length ? 2 : right >= 2 ? 1 : 0;
  return {
    points,
    correctLabel: q.pairs.map((p) => `${p.word} = ${p.meaning}`).join(" · "),
    feedback:
      points === 2
        ? undefined
        : `${right} of ${q.pairs.length} pairs matched correctly.`,
    perWord,
  };
}
