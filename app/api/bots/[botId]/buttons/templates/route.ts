import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { audit } from "@/lib/bots/audit";
import { BotServiceError, requireBot } from "@/lib/bots/service";
import { applySeedsSchema, generateSchema } from "@/lib/bots/buttons/schema";
import { insertSeeds, loadDraft } from "@/lib/bots/buttons/store";
import {
  templateById,
  templateOutline,
  suggestTemplate,
  type ButtonSeed,
} from "@/lib/bots/buttons/templates";

type Params = { params: Promise<{ botId: string }> };

/**
 * `?action=suggest` — mos shablonni taklif qiladi (hech narsa yozilmaydi);
 * `?action=apply`   — tanlangan shablon tugmalarini qoralamaga qo'shadi.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  const action = new URL(request.url).searchParams.get("action") ?? "apply";
  if (action !== "suggest" && action !== "apply") {
    return fail("action=suggest yoki action=apply bo'lishi kerak", 400);
  }

  try {
    const bot = await requireBot(botId, botScope(auth.ctx));

    if (action === "suggest") {
      const parsed = await parseBody(request, generateSchema);
      if ("response" in parsed) return parsed.response;

      // Aniq shablon so'ralgan bo'lsa taxmin qilib o'tirilmaydi.
      const chosen = parsed.data.templateId
        ? templateById(parsed.data.templateId)
        : undefined;
      if (parsed.data.templateId && !chosen) return fail("Shablon topilmadi", 404);

      const result = chosen
        ? { template: chosen, matched: chosen.id }
        : suggestTemplate({ category: bot.category, prompt: parsed.data.prompt });

      return ok({
        template: templateOutline(result.template),
        matched: result.matched,
        // Bugun qoida asosida tanlanadi; AI qatlami ulangach shu maydon
        // o'zgaradi va interfeys o'zgarishsiz qoladi.
        source: "rules" as const,
      });
    }

    const parsed = await parseBody(request, applySeedsSchema);
    if ("response" in parsed) return parsed.response;

    const template = templateById(parsed.data.templateId);
    if (!template) return fail("Shablon topilmadi", 404);

    const seeds = pickSeeds(template.buttons, parsed.data.select);
    if (seeds.length === 0) return fail("Kamida bitta tugma tanlang", 422);

    // Shablon inline bo'lsa ildizdagi hamma tugma ham inline bo'ladi.
    const created = await insertSeeds(botId, seeds, null, template.keyboard);

    await audit("BUTTONS_UPDATED", {
      botId,
      actorId: auth.ctx.user.id,
      ip: clientIp(request),
      metadata: { template: template.id, created },
    });

    return ok({ created, buttons: await loadDraft(botId) }, { status: 201 });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

/* ── Yordamchilar ────────────────────────────────────────────────────────── */

/** Tanlov faqat ildiz tugmalarga tegishli — ichki menyu otasi bilan keladi. */
function pickSeeds(seeds: ButtonSeed[], select?: number[]): ButtonSeed[] {
  if (!select || select.length === 0) return seeds;
  const wanted = new Set(select);
  return seeds.filter((_, index) => wanted.has(index));
}
