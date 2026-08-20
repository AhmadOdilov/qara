import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { fail, ok, parseBody, rateLimit } from "@/lib/api";
import { guardWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { planBot, pendingActionsIn } from "@/lib/ai/planner";
import { aiEnabled } from "@/lib/ai/claude";

/**
 * AI Product Planner (§5–7).
 *
 * Foydalanuvchi tavsifidan bot rejasini tuzadi va uni QORALAMA sifatida
 * saqlaydi. Bu bosqichda hech qanday bot yaratilmaydi va Telegram'ga
 * murojaat qilinmaydi — reja avval ko'rib chiqiladi (§45).
 */

const schema = z.object({
  prompt: z.string().trim().max(2000).default(""),
  templateId: z.string().trim().max(32).nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await guardWorkspace(request, { capability: "bot:create" });
  if ("response" in auth) return auth.response;
  const { ctx } = auth;

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  const { prompt, templateId } = parsed.data;
  if (!prompt && !templateId) {
    return fail("Nima yaratmoqchi ekaningizni yozing yoki shablon tanlang", 400);
  }

  // AI chaqiruvi pul turadi — foydalanuvchi bo'yicha cheklaymiz.
  const limit = rateLimit(`ai:plan:${ctx.user.id}`, 15, 60_000);
  if (!limit.allowed) {
    return fail("Juda ko'p urinish. Biroz kuting.", 429, {
      retryAfter: limit.retryAfter,
    });
  }

  const result = await planBot({
    prompt,
    templateId: templateId ?? null,
    language: ctx.user.lang,
  });

  const draft = await prisma.botBlueprint.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.user.id,
      prompt: prompt || `template:${templateId}`,
      source: result.source,
      templateId: templateId ?? null,
      plan: result.blueprint as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  return ok(
    {
      id: draft.id,
      blueprint: result.blueprint,
      source: result.source,
      fallbackReason: result.fallbackReason ?? null,
      pendingActions: pendingActionsIn(result.blueprint),
      aiEnabled: aiEnabled(),
    },
    { status: 201 },
  );
}
