import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";

/**
 * Anthropic Claude bilan yagona aloqa nuqtasi.
 *
 * Qoidalar:
 *  · Kalit faqat serverda o'qiladi va hech qachon javobga/logga tushmaydi.
 *  · Har qanday nosozlik (kalit yo'q, tarmoq, rad javobi) `AiUnavailable`
 *    bo'lib qaytadi — chaqiruvchi qoidaga asoslangan generatorga o'tadi.
 *  · Chiqish sxema bilan qat'iy cheklanadi (structured outputs).
 */

/** Kalit sozlanmagan yoki model javob bera olmadi — fallback kerak. */
export class AiUnavailable extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "AiUnavailable";
  }
}

/** AI yoqilganmi — UI'da "✨ Build with AI" tugmasini ko'rsatish uchun. */
export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

let cached: Anthropic | null = null;

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new AiUnavailable("ANTHROPIC_API_KEY sozlanmagan");
  if (!cached) cached = new Anthropic({ apiKey, maxRetries: 2 });
  return cached;
}

/**
 * Sxemaga qat'iy mos JSON qaytaradi.
 *
 * `messages.parse()` javobni zod bilan tekshiradi — ya'ni chaqiruvchiga
 * allaqachon tasdiqlangan obyekt keladi.
 */
export async function generateJson<T>(input: {
  schema: ZodType<T>;
  system: string;
  prompt: string;
  maxTokens?: number;
  /// Chuqurroq o'ylash kerak bo'lsa "high"; oddiy generatsiya uchun "medium"
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  const anthropic = client();

  let message;
  try {
    message = await anthropic.messages.parse({
      model: "claude-opus-5",
      max_tokens: input.maxTokens ?? 8000,
      system: input.system,
      output_config: {
        effort: input.effort ?? "medium",
        format: zodOutputFormat(input.schema),
      },
      messages: [{ role: "user", content: input.prompt }],
    });
  } catch (error) {
    // Xato matnini o'zimiz shakllantiramiz — SDK xatosi so'rov tanasini
    // (va u bilan birga kalitni) ilova qilib yuborishi mumkin.
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiUnavailable("Anthropic kaliti qabul qilinmadi");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiUnavailable("Anthropic so'rov chegarasi to'ldi");
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new AiUnavailable("Anthropic bilan bog'lanib bo'lmadi");
    }
    if (error instanceof Anthropic.APIError) {
      throw new AiUnavailable(`Anthropic xatosi (${error.status ?? "?"})`);
    }
    throw new AiUnavailable("AI javobi olinmadi");
  }

  // Xavfsizlik klassifikatori rad qilishi mumkin — bu HTTP 200 bilan keladi,
  // shuning uchun `content` ni o'qishdan OLDIN tekshiriladi.
  if (message.stop_reason === "refusal") {
    throw new AiUnavailable("So'rov AI siyosati bo'yicha rad etildi");
  }
  if (message.stop_reason === "max_tokens") {
    throw new AiUnavailable("AI javobi to'liq sig'madi");
  }
  if (!message.parsed_output) {
    throw new AiUnavailable("AI javobi kutilgan shaklda emas");
  }

  return message.parsed_output;
}
