import { allForms, type VocabWord } from "./words";
import { normalize, type Points } from "./grade";

export type SentenceVerdict = {
  points: Points;
  feedback: string;
  source: "rules" | "ai";
};

/**
 * Eng ko'p uchraydigan fe'llar va yordamchi fe'llar. Gapda hech qanday fe'l
 * bo'lmasa, bu "gap" emas — shunchaki so'zlar to'plami.
 */
const VERBS = new Set([
  "am", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did",
  "can", "could", "will", "would", "shall", "should", "may", "might", "must",
  "go", "goes", "went", "gone", "get", "gets", "got", "make", "makes", "made",
  "take", "takes", "took", "see", "sees", "saw", "come", "comes", "came",
  "want", "wants", "wanted", "need", "needs", "needed", "like", "likes", "liked",
  "think", "thinks", "thought", "know", "knows", "knew", "say", "says", "said",
  "tell", "tells", "told", "give", "gives", "gave", "find", "finds", "found",
  "work", "works", "worked", "study", "studies", "studied", "live", "lives", "lived",
  "play", "plays", "played", "buy", "buys", "bought", "use", "uses", "used",
  "try", "tries", "tried", "feel", "feels", "felt", "become", "becomes", "became",
  "start", "starts", "started", "help", "helps", "helped", "learn", "learns", "learned",
  "read", "reads", "write", "writes", "wrote", "speak", "speaks", "spoke",
  "let", "lets", "keep", "keeps", "kept", "put", "puts", "seem", "seems",
]);

function hasVerb(words: string[], target: VocabWord): boolean {
  // Sinaladigan so'zning o'zi fe'l bo'lsa, gapda fe'l bor deb hisoblaymiz.
  if (target.pos === "verb") return true;
  return words.some((w) => VERBS.has(w) || /^[a-z]{4,}(?:ed|ing)$/.test(w));
}

/**
 * Qoidaga asoslangan baholash — AI'siz ham to'liq ishlaydi.
 *
 *  0 — so'z umuman ishlatilmagan yoki javob bo'sh;
 *  1 — so'z bor, lekin gap juda qisqa / misol ko'chirilgan / fe'l yo'q;
 *  2 — so'z to'g'ri, mustaqil va to'liq gapda ishlatilgan.
 */
export function evaluateSentence(word: VocabWord, input: string): SentenceVerdict {
  const raw = input.trim();
  if (!raw) {
    return { points: 0, feedback: "Please write a sentence first.", source: "rules" };
  }

  const text = normalize(raw);
  const words = text.split(" ").filter(Boolean);

  const usesWord = allForms(word).some((form) => {
    const escaped = form.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(text);
  });

  if (!usesWord) {
    return {
      points: 0,
      feedback: `Your sentence does not use "${word.word}".`,
      source: "rules",
    };
  }

  if (words.length < 4) {
    return {
      points: 1,
      feedback: "Right word, but the sentence is too short. Add more detail.",
      source: "rules",
    };
  }

  const copied = word.examples.some((example) => normalize(example) === text);
  if (copied) {
    return {
      points: 1,
      feedback: "That is the example sentence — try writing your own.",
      source: "rules",
    };
  }

  if (!hasVerb(words, word)) {
    return {
      points: 1,
      feedback: "Almost — your sentence needs a verb to be complete.",
      source: "rules",
    };
  }

  return {
    points: 2,
    feedback: `Good sentence — "${word.word}" is used correctly.`,
    source: "rules",
  };
}
