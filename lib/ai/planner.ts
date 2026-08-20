import "server-only";
import {
  blueprintSchema,
  type Blueprint,
  type PlanResult,
} from "@/lib/ai/blueprint";
import { AiUnavailable, aiEnabled, generateJson } from "@/lib/ai/claude";
import { detectKind, detectName, recipeById, RECIPES } from "@/lib/ai/recipes";
import { isPendingAction } from "@/lib/bots/buttons/types";
import { log } from "@/lib/log";

/**
 * AI Product Planner (§6–7).
 *
 * Foydalanuvchi bitta jumla yozadi — chiqishda to'liq bot rejasi bo'ladi.
 * Ikkita qatlam:
 *   1. Claude — matnni tushunadi va rejani o'zi tuzadi.
 *   2. Qoidaga asoslangan generator — kalit yo'q yoki AI javob bermasa.
 *
 * Ikkalasi ham BIR XIL sxemani qaytaradi, shuning uchun UI farq qilmaydi;
 * natijaning manbasi `source` maydonida ochiq ko'rsatiladi.
 */

const SYSTEM = `Siz Qara platformasining bot arxitektorisiz. Foydalanuvchi o'z biznesini bir-ikki jumlada tasvirlaydi; siz unga to'liq Telegram bot konfiguratsiyasini tuzib berasiz.

Qoidalar:
- Faqat berilgan sxemaga mos JSON qaytaring. Kod yozmang.
- Menyu 4–7 ta asosiy tugmadan iborat bo'lsin. Ichki menyu faqat kerak bo'lganda.
- Matnlar foydalanuvchi yozgan tilda bo'lsin (o'zbekcha so'ralsa — o'zbekcha, ruscha so'ralsa — ruscha).
- Narx, manzil, telefon yoki ish vaqtini O'YLAB TOPMANG. Foydalanuvchi aytmagan bo'lsa, o'rniga to'ldirish kerakligini bildiruvchi umumiy matn yozing.
- \`reply\` faqat \`send_message\` uchun to'ldiriladi; boshqa amallarda bo'sh satr qoldiring.
- \`features\` — faqat shu biznesga haqiqatan kerak bo'lganlari.
- \`welcomeMessage\` qisqa va samimiy bo'lsin, emoji bilan.
- \`systemPrompt\` — botning AI yordamchisi uchun ko'rsatma; unda botning roli va nimani bilmasa nima qilishi yozilsin.`;

/* ── Kirish nuqtasi ──────────────────────────────────────────────────────── */

export async function planBot(input: {
  prompt: string;
  /// Shablon tanlangan bo'lsa AI chaqirilmaydi — foydalanuvchi allaqachon tanlagan
  templateId?: string | null;
  language?: "uz" | "ru" | "en";
}): Promise<PlanResult> {
  const prompt = input.prompt.trim();

  if (input.templateId) {
    const recipe = recipeById(input.templateId);
    if (recipe) {
      return {
        blueprint: fromRecipe(recipe.id, prompt || recipe.tagline, input.language),
        source: "rule_based",
      };
    }
  }

  if (!aiEnabled()) {
    return {
      blueprint: fromRecipe(detectKind(prompt), prompt, input.language),
      source: "rule_based",
      fallbackReason: "AI kaliti sozlanmagan — tayyor shablon asosida tuzildi",
    };
  }

  try {
    const raw = await generateJson({
      schema: blueprintSchema,
      system: SYSTEM,
      prompt: `Foydalanuvchi tavsifi:\n"""\n${prompt}\n"""`,
      effort: "medium",
      maxTokens: 8000,
    });
    return { blueprint: sanitize(raw), source: "claude" };
  } catch (error) {
    const reason =
      error instanceof AiUnavailable ? error.reason : "AI javob bermadi";
    // Jim yiqilmaydi: foydalanuvchi baribir ishlaydigan reja oladi va
    // nima uchun AI ishlatilmaganini ko'radi.
    log.warn("ai/planner: zaxira generatorga o'tildi", { reason });
    return {
      blueprint: fromRecipe(detectKind(prompt), prompt, input.language),
      source: "rule_based",
      fallbackReason: reason,
    };
  }
}

/* ── Qoidaga asoslangan generator ────────────────────────────────────────── */

export function fromRecipe(
  kind: string,
  prompt: string,
  language: "uz" | "ru" | "en" = "uz",
): Blueprint {
  const recipe = recipeById(kind) ?? recipeById("other")!;
  const name = detectName(prompt, recipe.defaultName);
  const body = recipe.build({ name });

  return blueprintSchema.parse({
    name,
    description: prompt.slice(0, 512) || recipe.tagline,
    shortDescription: recipe.tagline.slice(0, 120),
    businessKind: recipe.id,
    language,
    features: recipe.features,
    ...body,
  });
}

/** Shablon tanlash oynasi uchun qisqa ro'yxat (§8). */
export function templateCards() {
  return RECIPES.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    emoji: recipe.emoji,
    tagline: recipe.tagline,
    features: recipe.features,
  }));
}

/* ── Tozalash ────────────────────────────────────────────────────────────── */

/**
 * Model sxemaga mos javob bersa ham mazmunan xato qilishi mumkin: bo'sh
 * menyu, `/start` buyrug'ining yo'qligi yoki `send_message` tugmasi matnsiz.
 * Bularni server tomonda to'g'irlaymiz — jonli botga yarim ishlaydigan
 * konfiguratsiya tushmasin.
 */
function sanitize(blueprint: Blueprint): Blueprint {
  const menu = blueprint.menu
    // Matnsiz `send_message` — foydalanuvchiga bo'sh javob bo'lardi.
    .filter((item) => item.actionType !== "send_message" || item.reply.length > 0)
    .map((item) => ({
      ...item,
      children: item.children.filter(
        (child) => child.actionType !== "send_message" || child.reply.length > 0,
      ),
    }));

  const commands = blueprint.commands.filter((c) => c.reply.length > 0);
  if (!commands.some((c) => c.command === "start")) {
    commands.unshift({
      command: "start",
      description: "Botni ishga tushirish",
      reply: blueprint.welcomeMessage,
    });
  }

  return {
    ...blueprint,
    menu: menu.length > 0 ? menu : fromRecipe(blueprint.businessKind, blueprint.name).menu,
    commands,
  };
}

/**
 * Rejadagi tugmalardan qaysilari hali ortidagi qatlamsiz ishlaydi —
 * ko'rib chiqish sahifasida ochiq ko'rsatiladi (§70: soxta tugma qolmasin).
 */
export function pendingActionsIn(blueprint: Blueprint): string[] {
  const types = new Set<string>();
  for (const item of blueprint.menu) {
    if (isPendingAction(item.actionType)) types.add(item.actionType);
    for (const child of item.children) {
      if (isPendingAction(child.actionType)) types.add(child.actionType);
    }
  }
  return [...types];
}
