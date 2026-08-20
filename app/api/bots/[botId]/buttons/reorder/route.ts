import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { audit } from "@/lib/bots/audit";
import { BotServiceError, requireBot } from "@/lib/bots/service";
import { reorderSchema } from "@/lib/bots/buttons/schema";
import { loadDraft } from "@/lib/bots/buttons/store";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ botId: string }> };

/**
 * Bir nechta tugmaning joyini bitta so'rovda o'zgartiradi.
 *
 * Sudrab ko'chirish bitta harakatda bir necha tugmaning `rowIndex` va
 * `sortOrder` qiymatini siljitadi — ular birgalikda yozilmasa, oradagi xato
 * klaviaturani yarim tartiblangan holatda qoldirardi.
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  const parsed = await parseBody(request, reorderSchema);
  if ("response" in parsed) return parsed.response;
  const { items } = parsed.data;

  try {
    await requireBot(botId, botScope(auth.ctx));

    if (items.length === 0) return ok({ buttons: await loadDraft(botId) });

    const owned = await prisma.telegramBotButton.findMany({
      where: { botId },
      select: { id: true, parentId: true },
    });
    const parentOf = new Map(owned.map((row) => [row.id, row.parentId]));

    for (const item of items) {
      if (!parentOf.has(item.id)) return fail("Tugma topilmadi", 404);
      if (item.parentId && !parentOf.has(item.parentId)) {
        return fail("Ota tugma topilmadi", 422);
      }
      if (item.parentId === item.id) return fail("Tugma o'ziga bo'ysuna olmaydi", 422);
    }

    // Halqa tekshiruvi yangi joylashuv bo'yicha: alohida to'g'ri ko'rinadigan
    // ikkita ko'chirish birgalikda daraxtni uzuk qilib qo'yishi mumkin.
    for (const item of items) parentOf.set(item.id, item.parentId);
    if (hasCycle(parentOf)) {
      return fail("Tugmani o'z ichki menyusiga ko'chirib bo'lmaydi", 422);
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.telegramBotButton.update({
          where: { id: item.id },
          data: {
            parentId: item.parentId,
            rowIndex: item.rowIndex,
            sortOrder: item.sortOrder,
          },
        }),
      ),
    );

    await audit("BUTTONS_UPDATED", {
      botId,
      actorId: auth.ctx.user.id,
      ip: clientIp(request),
      metadata: { reordered: items.length },
    });

    return ok({ buttons: await loadDraft(botId) });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

/** Ota-bola xaritasida halqa bormi. */
function hasCycle(parentOf: Map<string, string | null>): boolean {
  for (const id of parentOf.keys()) {
    const seen = new Set<string>([id]);
    let current = parentOf.get(id) ?? null;
    while (current) {
      if (seen.has(current)) return true;
      seen.add(current);
      current = parentOf.get(current) ?? null;
    }
  }
  return false;
}
