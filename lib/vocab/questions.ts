import { WORDS, WORD_BY_ID, allForms, wordId, type Pos, type VocabWord } from "./words";
import { makeRng, pick, sample, shuffle, type Rng } from "./rng";

/* ── Turlar ──────────────────────────────────────────────────────────────── */

export type QuestionType =
  | "en-uz"
  | "uz-en"
  | "fill-blank"
  | "context"
  | "sentence"
  | "matching";

type Base = {
  id: string;
  index: number;
  type: QuestionType;
  /** Shu savol bahosi ta'sir qiladigan so'zlar. */
  wordIds: string[];
};

export type ChoiceQuestion = Base & {
  kind: "choice";
  type: "en-uz" | "uz-en" | "context";
  instruction: string;
  /** Kontekst savollarida — misol gap. */
  context?: string;
  subject: string;
  options: string[];
  correctIndex: number;
};

export type BlankQuestion = Base & {
  kind: "blank";
  type: "fill-blank";
  instruction: string;
  sentence: string;
  hint: string;
  /** To'liq ball beriladigan javoblar. */
  exact: string[];
  /** Yarim ball beriladigan javoblar (so'zning boshqa shakllari). */
  partial: string[];
  answer: string;
};

export type SentenceQuestion = Base & {
  kind: "sentence";
  type: "sentence";
  instruction: string;
  word: string;
  meaning: string;
};

export type MatchPair = { wordId: string; word: string; meaning: string };

export type MatchingQuestion = Base & {
  kind: "matching";
  type: "matching";
  instruction: string;
  pairs: MatchPair[];
  /** Aralashtirilgan ma'nolar — foydalanuvchi shulardan tanlaydi. */
  choices: string[];
};

export type Question =
  | ChoiceQuestion
  | BlankQuestion
  | SentenceQuestion
  | MatchingQuestion;

export const BLANK = "______";
export const POINTS_PER_QUESTION = 2;

/* ── Savol turlarining nisbati ───────────────────────────────────────────── */

const MIX: ReadonlyArray<readonly [QuestionType, number]> = [
  ["en-uz", 24],
  ["uz-en", 20],
  ["fill-blank", 18],
  ["context", 18],
  ["matching", 12],
  ["sentence", 8],
];

/**
 * Bir-biriga juda yaqin so'zlar: chalg'ituvchi variant sifatida ishlatilmaydi,
 * aks holda savolning yagona to'g'ri javobi bo'lmay qoladi.
 */
const CONFUSABLE: ReadonlyArray<readonly string[]> = [
  ["focus", "concentrate"],
  ["productive", "effective"],
  ["however", "although"],
];

function confusableWith(word: string): Set<string> {
  const out = new Set<string>();
  for (const group of CONFUSABLE) {
    if (group.includes(word)) for (const w of group) out.add(w);
  }
  return out;
}

/**
 * `n` ta savol uchun turlar rejasi. Ulushlar `MIX` ga mos taqsimlanadi,
 * qoldiq eng katta kasr qismiga ega turlarga beriladi.
 */
export function planTypes(n: number, rng: Rng, allowMatching: boolean): QuestionType[] {
  const mix = MIX.filter(([type]) => allowMatching || type !== "matching");
  const total = mix.reduce((s, [, w]) => s + w, 0);

  const exact = mix.map(([type, w]) => ({ type, want: (n * w) / total }));
  const counts = exact.map((e) => ({ type: e.type, count: Math.floor(e.want), frac: e.want % 1 }));

  let left = n - counts.reduce((s, c) => s + c.count, 0);
  for (const c of [...counts].sort((a, b) => b.frac - a.frac)) {
    if (left <= 0) break;
    c.count += 1;
    left -= 1;
  }

  const plan: QuestionType[] = [];
  for (const c of counts) for (let i = 0; i < c.count; i++) plan.push(c.type);
  return shuffle(rng, plan);
}

/* ── Yordamchilar ────────────────────────────────────────────────────────── */

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Gapda so'zning qaysi shakli ishlatilganini topadi. */
export function findForm(word: VocabWord, sentence: string): string | null {
  for (const form of allForms(word)) {
    const re = new RegExp(`\\b${escapeRe(form)}\\b`, "i");
    const match = re.exec(sentence);
    if (match) return match[0];
  }
  return null;
}

/** Gapdagi birinchi uchragan shaklni bo'sh joyga almashtiradi. */
function blankOut(word: VocabWord, sentence: string): { text: string; removed: string } | null {
  for (const form of allForms(word)) {
    const re = new RegExp(`\\b${escapeRe(form)}\\b`, "i");
    const match = re.exec(sentence);
    if (match) {
      return {
        text: sentence.slice(0, match.index) + BLANK + sentence.slice(match.index + match[0].length),
        removed: match[0],
      };
    }
  }
  return null;
}

/** Chalg'ituvchilar: iloji boricha bir xil turkumdan, yaqin ma'nolilarsiz. */
function distractors(
  rng: Rng,
  target: VocabWord,
  count: number,
  valueOf: (w: VocabWord) => string,
): string[] {
  const banned = confusableWith(target.word);
  const targetValue = valueOf(target).toLowerCase();

  const usable = WORDS.filter(
    (w) =>
      w.word !== target.word &&
      !banned.has(w.word) &&
      valueOf(w).toLowerCase() !== targetValue,
  );

  const samePos = usable.filter((w) => w.pos === target.pos);
  const others = usable.filter((w) => w.pos !== target.pos);

  const chosen: string[] = [];
  const seen = new Set<string>([targetValue]);

  for (const w of [...shuffle(rng, samePos), ...shuffle(rng, others)]) {
    const value = valueOf(w);
    if (seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    chosen.push(value);
    if (chosen.length === count) break;
  }
  return chosen;
}

function choiceOf(
  rng: Rng,
  correct: string,
  wrong: string[],
): { options: string[]; correctIndex: number } {
  const options = shuffle(rng, [correct, ...wrong]);
  return { options, correctIndex: options.indexOf(correct) };
}

/* ── Har bir tur uchun generator ─────────────────────────────────────────── */

function buildEnUz(rng: Rng, w: VocabWord, base: Omit<Base, "type">): ChoiceQuestion {
  const { options, correctIndex } = choiceOf(rng, w.meaning, distractors(rng, w, 3, (x) => x.meaning));
  return {
    ...base,
    type: "en-uz",
    kind: "choice",
    instruction: `What does "${w.word}" mean?`,
    subject: w.word,
    options,
    correctIndex,
  };
}

function buildUzEn(rng: Rng, w: VocabWord, base: Omit<Base, "type">): ChoiceQuestion {
  const { options, correctIndex } = choiceOf(rng, w.word, distractors(rng, w, 3, (x) => x.word));
  return {
    ...base,
    type: "uz-en",
    kind: "choice",
    instruction: `"${w.meaning}" — bu so'zning inglizchasi qaysi?`,
    subject: w.meaning,
    options,
    correctIndex,
  };
}

function buildContext(rng: Rng, w: VocabWord, base: Omit<Base, "type">): ChoiceQuestion {
  const sentence = pick(rng, w.examples);
  const { options, correctIndex } = choiceOf(
    rng,
    w.definition,
    distractors(rng, w, 3, (x) => x.definition),
  );
  return {
    ...base,
    type: "context",
    kind: "choice",
    instruction: `What does "${w.word}" mean in this sentence?`,
    context: sentence,
    subject: w.word,
    options,
    correctIndex,
  };
}

function buildBlank(rng: Rng, w: VocabWord, base: Omit<Base, "type">): BlankQuestion {
  // Faqat so'z topiladigan gaplar (ma'lumot testi buni kafolatlaydi).
  const usable = w.examples.filter((s) => blankOut(w, s) !== null);
  const sentence = usable.length ? pick(rng, usable) : w.examples[0];
  const cut = blankOut(w, sentence);

  const removed = cut ? cut.removed : w.word;
  const exact = Array.from(new Set([removed.toLowerCase(), w.word.toLowerCase()]));
  const partial = allForms(w)
    .map((f) => f.toLowerCase())
    .filter((f) => !exact.includes(f));

  return {
    ...base,
    type: "fill-blank",
    kind: "blank",
    instruction: "Fill in the blank with the correct word:",
    sentence: cut ? cut.text : `${BLANK} — ${w.definition}`,
    hint: w.meaning,
    exact,
    partial,
    answer: removed,
  };
}

function buildSentence(w: VocabWord, base: Omit<Base, "type">): SentenceQuestion {
  return {
    ...base,
    type: "sentence",
    kind: "sentence",
    instruction: "Write your own English sentence using this word:",
    word: w.word,
    meaning: w.meaning,
  };
}

function buildMatching(
  rng: Rng,
  w: VocabWord,
  pool: VocabWord[],
  base: Omit<Base, "type">,
): MatchingQuestion {
  const banned = confusableWith(w.word);
  const candidates = pool.filter(
    (x) => x.word !== w.word && !banned.has(x.word) && x.meaning !== w.meaning,
  );
  const partners = sample(rng, candidates, 3);
  const pairs: MatchPair[] = shuffle(rng, [w, ...partners]).map((x) => ({
    wordId: wordId(x.word),
    word: x.word,
    meaning: x.meaning,
  }));

  return {
    ...base,
    type: "matching",
    kind: "matching",
    instruction: "Match each word with its Uzbek meaning:",
    pairs,
    wordIds: pairs.map((p) => p.wordId),
    choices: shuffle(rng, pairs.map((p) => p.meaning)),
  };
}

/* ── Asosiy generator ────────────────────────────────────────────────────── */

/**
 * `wordIds` — testga kiradigan so'zlar. Har bir so'z uchun aynan bitta savol
 * yasaladi, ya'ni savollar soni = so'zlar soni.
 *
 * Bir xil `seed` + bir xil `wordIds` har doim bir xil savollarni beradi.
 */
export function generateQuestions(seed: number, wordIds: string[]): Question[] {
  const rng = makeRng(seed);

  const words = wordIds
    .map((id) => WORD_BY_ID.get(id))
    .filter((w): w is VocabWord => Boolean(w));

  if (!words.length) return [];

  const order = shuffle(rng, words);
  // `matching` faqat testning O'Z so'zlaridan yasaladi — aks holda amaliyot
  // rejimida testga kirmagan so'zlar natijaga qo'shilib ketardi. Shuning uchun
  // so'z 4 tadan kam bo'lsa, bu tur umuman ishlatilmaydi.
  const plan = planTypes(order.length, rng, words.length >= 4);

  return order.map((w, index) => {
    const base = { id: `q${index + 1}`, index, wordIds: [wordId(w.word)] };
    switch (plan[index]) {
      case "uz-en":
        return buildUzEn(rng, w, base);
      case "fill-blank":
        return buildBlank(rng, w, base);
      case "context":
        return buildContext(rng, w, base);
      case "sentence":
        return buildSentence(w, base);
      case "matching":
        return buildMatching(rng, w, words, base);
      case "en-uz":
      default:
        return buildEnUz(rng, w, base);
    }
  });
}

/** To'liq test uchun barcha 100 ta so'z. */
export function allWordIds(): string[] {
  return WORDS.map((w) => wordId(w.word));
}

export type { Pos, VocabWord };
