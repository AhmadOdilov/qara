import assert from "node:assert/strict";
import { test } from "node:test";

import { WORDS, WORD_BY_ID, wordId, allForms } from "../../lib/vocab/words";
import {
  BLANK,
  allWordIds,
  findForm,
  generateQuestions,
  planTypes,
  type Question,
} from "../../lib/vocab/questions";
import { gradeBlank, gradeChoice, gradeMatching, normalize } from "../../lib/vocab/grade";
import { evaluateSentence } from "../../lib/vocab/evaluate";
import {
  createState,
  parseState,
  practiceWordIds,
  summarize,
  levelFor,
  type TestState,
} from "../../lib/vocab/session";
import { makeRng } from "../../lib/vocab/rng";

/** Foydalanuvchi bergan 100 ta so'z — bazaning yagona haqiqat manbai. */
const REQUIRED = [
  "routine", "habit", "hobby", "experience", "prefer",
  "enjoy", "spend", "usually", "especially", "recently",
  "relationship", "friendship", "trust", "support", "respect",
  "honest", "reliable", "patient", "confident", "responsible",
  "education", "knowledge", "subject", "assignment", "skill",
  "improve", "practice", "concentrate", "graduate", "opportunity",
  "technology", "device", "application", "feature", "internet",
  "privacy", "security", "software", "digital", "artificial intelligence",
  "future", "career", "goal", "dream", "achieve",
  "success", "challenge", "effort", "progress", "motivation",
  "travel", "journey", "destination", "tourist", "accommodation",
  "luggage", "route", "local", "adventure", "explore",
  "discipline", "productive", "effective", "focus", "manage",
  "develop", "decision", "choice", "mistake", "solution",
  "money", "income", "salary", "business", "customer",
  "employee", "employer", "afford", "entertainment", "character",
  "story", "music", "performance", "popular", "interesting",
  "boring", "recommend", "society", "opinion", "advantage",
  "disadvantage", "reason", "however", "although", "probably",
  "actually", "as a result", "goal-oriented", "valuable", "successful",
];

/* ── Lug'at ──────────────────────────────────────────────────────────────── */

test("baza aynan 100 ta so'zdan iborat", () => {
  assert.equal(WORDS.length, 100);
  assert.equal(new Set(WORDS.map((w) => w.word)).size, 100);
});

test("so'rovda berilgan 100 ta so'zning hammasi bazada bor", () => {
  assert.equal(REQUIRED.length, 100, "test ro'yxatining o'zi 100 ta bo'lishi kerak");
  const have = new Set(WORDS.map((w) => w.word));
  const missing = REQUIRED.filter((w) => !have.has(w));
  assert.deepEqual(missing, []);
});

test("har bir so'zda o'zbekcha ma'no, inglizcha izoh va kamida 2 ta misol bor", () => {
  for (const w of WORDS) {
    assert.ok(w.meaning.trim().length > 0, `${w.word}: ma'no yo'q`);
    assert.ok(w.definition.trim().length > 0, `${w.word}: izoh yo'q`);
    assert.ok(w.examples.length >= 2, `${w.word}: misollar yetarli emas`);
    assert.ok(w.synonyms.length >= 1, `${w.word}: sinonim yo'q`);
    assert.match(w.level, /^B[12]$/);
  }
});

test("har bir misol gapda so'zning o'zi yoki uning shakli bor", () => {
  const broken: string[] = [];
  for (const w of WORDS) {
    for (const example of w.examples) {
      if (!findForm(w, example)) broken.push(`${w.word}: ${example}`);
    }
  }
  assert.deepEqual(broken, [], "bo'sh joy to'ldirish savoli yasalmaydigan gaplar");
});

test("ma'nolar va izohlar takrorlanmaydi (variantlar chalkashmasin)", () => {
  assert.equal(new Set(WORDS.map((w) => w.meaning)).size, WORDS.length);
  assert.equal(new Set(WORDS.map((w) => w.definition)).size, WORDS.length);
});

/* ── Savol generatsiyasi ─────────────────────────────────────────────────── */

test("100 ta so'z uchun 100 ta savol yasaladi va har bir so'z qamrab olinadi", () => {
  const questions = generateQuestions(12345, allWordIds());
  assert.equal(questions.length, 100);
  assert.equal(new Set(questions.map((q) => q.id)).size, 100);

  const covered = new Set<string>();
  for (const q of questions) for (const id of q.wordIds) covered.add(id);
  for (const id of allWordIds()) assert.ok(covered.has(id), `${id} testga tushmadi`);
});

test("bir xil seed — bir xil savollar (refreshdan keyin test o'zgarmaydi)", () => {
  const a = generateQuestions(777, allWordIds());
  const b = generateQuestions(777, allWordIds());
  const c = generateQuestions(778, allWordIds());
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.notEqual(JSON.stringify(a), JSON.stringify(c));
});

test("oltita savol turi ham ishlatiladi", () => {
  const types = new Set(generateQuestions(4242, allWordIds()).map((q) => q.type));
  for (const type of ["en-uz", "uz-en", "fill-blank", "context", "sentence", "matching"]) {
    assert.ok(types.has(type as Question["type"]), `${type} turi chiqmadi`);
  }
});

test("turlar rejasi har qanday savol soni uchun to'g'ri uzunlikda", () => {
  for (const n of [1, 3, 4, 7, 23, 100]) {
    const plan = planTypes(n, makeRng(n), n >= 4);
    assert.equal(plan.length, n, `n=${n}`);
  }
});

test("variantli savollarda 4 ta takrorlanmas variant va bitta to'g'ri javob bor", () => {
  for (const q of generateQuestions(99, allWordIds())) {
    if (q.kind !== "choice") continue;
    assert.equal(q.options.length, 4, q.id);
    assert.equal(new Set(q.options).size, 4, `${q.id}: variantlar takrorlangan`);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < 4, q.id);

    const word = WORD_BY_ID.get(q.wordIds[0])!;
    const expected =
      q.type === "en-uz" ? word.meaning : q.type === "uz-en" ? word.word : word.definition;
    assert.equal(q.options[q.correctIndex], expected, q.id);
  }
});

test("bo'sh joy savollarida gap ichida bo'shliq bor va javob so'zning shakli", () => {
  for (const q of generateQuestions(31337, allWordIds())) {
    if (q.kind !== "blank") continue;
    assert.ok(q.sentence.includes(BLANK), `${q.id}: bo'shliq yo'q`);
    assert.ok(!q.sentence.toLowerCase().includes(q.answer.toLowerCase()), `${q.id}: javob ko'rinib turibdi`);
    const word = WORD_BY_ID.get(q.wordIds[0])!;
    assert.ok(
      allForms(word).some((f) => f.toLowerCase() === q.answer.toLowerCase()),
      `${q.id}: javob so'z shakli emas`,
    );
    assert.ok(q.hint.length > 0);
  }
});

test("kontekst savollarida misol gap ko'rsatiladi", () => {
  for (const q of generateQuestions(5150, allWordIds())) {
    if (q.type !== "context" || q.kind !== "choice") continue;
    assert.ok(q.context && q.context.length > 0, `${q.id}: kontekst yo'q`);
    const word = WORD_BY_ID.get(q.wordIds[0])!;
    assert.ok(findForm(word, q.context!), `${q.id}: gapda so'z yo'q`);
  }
});

test("matching savolida 4 ta juft va aralashtirilgan ma'nolar bor", () => {
  for (const q of generateQuestions(2024, allWordIds())) {
    if (q.kind !== "matching") continue;
    assert.equal(q.pairs.length, 4, q.id);
    assert.equal(new Set(q.pairs.map((p) => p.wordId)).size, 4, q.id);
    assert.deepEqual([...q.choices].sort(), [...q.pairs.map((p) => p.meaning)].sort(), q.id);
    assert.deepEqual(q.wordIds, q.pairs.map((p) => p.wordId));
  }
});

/* ── Baholash ────────────────────────────────────────────────────────────── */

test("variantli savol: to'g'ri — 2 ball, xato — 0 ball", () => {
  const q = generateQuestions(1, allWordIds()).find((x) => x.kind === "choice")!;
  assert.equal(gradeChoice(q, q.correctIndex).points, 2);
  assert.equal(gradeChoice(q, (q.correctIndex + 1) % 4).points, 0);
  assert.equal(gradeChoice(q, null).points, 0);
  assert.equal(gradeChoice(q, q.correctIndex).perWord[0].correct, true);
});

test("bo'sh joy: aniq javob 2, boshqa shakl 1, imlo xatosi 1, bo'lmagani 0", () => {
  const q = generateQuestions(8, allWordIds()).find((x) => x.kind === "blank")!;
  assert.equal(gradeBlank(q, q.answer).points, 2);
  assert.equal(gradeBlank(q, `  ${q.answer.toUpperCase()} `).points, 2);
  assert.equal(gradeBlank(q, "zzzqqq").points, 0);
  assert.equal(gradeBlank(q, "").points, 0);

  if (q.partial.length) {
    assert.equal(gradeBlank(q, q.partial[0]).points, 1, "so'zning boshqa shakli — yarim ball");
  }
  const typo = q.answer.length >= 5 ? q.answer.slice(0, -1) + "x" : null;
  if (typo) assert.equal(gradeBlank(q, typo).points, 1, "bitta harflik xato — yarim ball");
});

test("matching: 4/4 — 2 ball, 2–3 to'g'ri — 1 ball, 0–1 — 0 ball", () => {
  const q = generateQuestions(17, allWordIds()).find((x) => x.kind === "matching")!;
  const right = Object.fromEntries(q.pairs.map((p) => [p.wordId, p.meaning]));
  assert.equal(gradeMatching(q, right).points, 2);

  const half = { ...right };
  half[q.pairs[0].wordId] = q.pairs[1].meaning;
  half[q.pairs[1].wordId] = q.pairs[0].meaning;
  assert.equal(gradeMatching(q, half).points, 1);

  const none = Object.fromEntries(q.pairs.map((p, i) => [p.wordId, q.pairs[(i + 1) % 4].meaning]));
  assert.equal(gradeMatching(q, none).points, 0);
  assert.equal(gradeMatching(q, {}).points, 0);
});

test("gap yozish: so'zsiz 0, qisqa 1, ko'chirilgan 1, to'liq gap 2", () => {
  const afford = WORD_BY_ID.get("afford")!;
  assert.equal(evaluateSentence(afford, "").points, 0);
  assert.equal(evaluateSentence(afford, "I like pizza very much.").points, 0);
  assert.equal(evaluateSentence(afford, "I can afford").points, 1);
  assert.equal(evaluateSentence(afford, afford.examples[0]).points, 1);
  assert.equal(evaluateSentence(afford, "I cannot afford a new phone this year.").points, 2);
  assert.equal(evaluateSentence(afford, "She afforded a small car after saving money.").points, 2);

  const reliable = WORD_BY_ID.get("reliable")!;
  assert.equal(evaluateSentence(reliable, "My brother is a reliable friend.").points, 2);
  assert.equal(evaluateSentence(reliable, "very reliable good nice").points, 1);
});

test("normalize tinish belgilari va registrni tozalaydi", () => {
  assert.equal(normalize("  Afford, please! "), "afford please");
});

/* ── Natija va holat ─────────────────────────────────────────────────────── */

function answerAll(state: TestState, questions: Question[], howMany: number, wrongEvery = 0) {
  questions.forEach((q, i) => {
    if (i >= howMany) return;
    const wrong = wrongEvery > 0 && i % wrongEvery === 0;
    const perWord = q.wordIds.map((id) => ({ wordId: id, correct: !wrong }));
    state.answers[i] = {
      points: wrong ? 0 : 2,
      given: "x",
      correctLabel: "y",
      perWord,
    };
  });
  state.index = howMany;
  if (howMany >= questions.length) state.finishedAt = Date.now();
}

test("hammasi to'g'ri — 200 ball, 100%, Excellent", () => {
  const ids = allWordIds();
  const state = createState(5, ids, "full");
  answerAll(state, generateQuestions(5, ids), 100);

  const summary = summarize(state);
  assert.equal(summary.score, 200);
  assert.equal(summary.maxScore, 200);
  assert.equal(summary.percent, 100);
  assert.equal(summary.level.label, "Excellent");
  assert.equal(summary.correct, 100);
  assert.equal(summary.wrong, 0);
  assert.equal(summary.weak.length, 0);
  assert.equal(summary.strong.length, 100);
});

test("xato javoblar weak so'zlar ro'yxatiga tushadi", () => {
  const ids = allWordIds();
  const state = createState(6, ids, "full");
  const questions = generateQuestions(6, ids);
  answerAll(state, questions, 100, 10); // har 10-savol xato

  const summary = summarize(state);
  assert.ok(summary.weak.length > 0, "weak so'zlar aniqlanmadi");
  assert.ok(summary.score < 200);
  assert.equal(summary.correct + summary.partial + summary.wrong, 100);

  for (const w of summary.weak) {
    assert.equal(w.correct, 0);
    assert.ok(w.wrong > 0);
    assert.ok(w.meaning.length > 0 && w.example.length > 0, "weak so'zda ma'no va misol bo'lishi kerak");
  }
  assert.ok(practiceWordIds(summary).length >= summary.weak.length);
});

test("daraja chegaralari spetsifikatsiyaga mos", () => {
  assert.equal(levelFor(100).label, "Excellent");
  assert.equal(levelFor(90).label, "Excellent");
  assert.equal(levelFor(89).label, "Very Good");
  assert.equal(levelFor(80).label, "Very Good");
  assert.equal(levelFor(79).label, "Good");
  assert.equal(levelFor(70).label, "Good");
  assert.equal(levelFor(69).label, "Needs Practice");
  assert.equal(levelFor(60).label, "Needs Practice");
  assert.equal(levelFor(59).label, "Review Required");
  assert.equal(levelFor(0).label, "Review Required");
});

test("amaliyot rejimi: faqat tanlangan so'zlar test qilinadi", () => {
  const weak = allWordIds().slice(0, 7);
  const questions = generateQuestions(21, weak);
  assert.equal(questions.length, 7);
  const covered = new Set(questions.flatMap((q) => q.wordIds));
  for (const id of weak) assert.ok(covered.has(id), `${id} amaliyotga tushmadi`);

  const state = createState(21, weak, "practice");
  answerAll(state, questions, 7);
  const summary = summarize(state);
  assert.equal(summary.maxScore, 14);
  assert.equal(summary.score, 14);
});

test("kam so'zli amaliyotda matching ishlatilmaydi va begona so'z qo'shilmaydi", () => {
  for (const n of [1, 2, 3]) {
    const ids = allWordIds().slice(0, n);
    const questions = generateQuestions(3, ids);
    assert.equal(questions.length, n);

    for (const q of questions) {
      assert.notEqual(q.type, "matching", `n=${n}: matching uchun so'z yetmaydi`);
      for (const id of q.wordIds) {
        assert.ok(ids.includes(id), `n=${n}: testga kirmagan so'z (${id}) savolga tushdi`);
      }
    }
  }
});

test("amaliyot natijasida faqat tanlangan so'zlar ko'rinadi", () => {
  const ids = allWordIds().slice(0, 3);
  const state = createState(77, ids, "practice");
  // Baholovchi xato qilib begona so'zni qaytarsa ham, natijaga o'tmasligi kerak.
  state.answers[0] = {
    points: 2,
    given: "x",
    correctLabel: "y",
    perWord: [
      { wordId: ids[0], correct: true },
      { wordId: "successful", correct: false },
    ],
  };
  const summary = summarize(state);
  assert.equal(summary.total, 3);
  assert.equal(summary.words.length, 3);
  assert.ok(!summary.words.some((w) => w.wordId === "successful"));
});

test("saqlangan holat qayta o'qiladi, buzilgani rad etiladi", () => {
  const state = createState(9, allWordIds(), "full");
  state.index = 42;
  const restored = parseState(JSON.stringify(state));
  assert.ok(restored);
  assert.equal(restored!.index, 42);
  assert.equal(restored!.wordIds.length, 100);

  assert.equal(parseState(null), null);
  assert.equal(parseState("{"), null);
  assert.equal(parseState(JSON.stringify({ version: 2 })), null);
  assert.equal(parseState(JSON.stringify({ ...state, wordIds: ["nope"] })), null);
  assert.equal(
    parseState(JSON.stringify({ ...state, answers: [] })),
    null,
    "javoblar soni so'zlar soniga mos kelmasa — rad etiladi",
  );
});

test("wordId barqaror va ko'p so'zli iboralar uchun ham ishlaydi", () => {
  assert.equal(wordId("artificial intelligence"), "artificial-intelligence");
  assert.equal(wordId("as a result"), "as-a-result");
  assert.equal(wordId("goal-oriented"), "goal-oriented");
  assert.ok(WORD_BY_ID.has("artificial-intelligence"));
  assert.ok(WORD_BY_ID.has("as-a-result"));
});
