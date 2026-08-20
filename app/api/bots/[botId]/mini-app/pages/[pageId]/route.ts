import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { BotServiceError } from "@/lib/bots/service";
import { deletePage, updatePage } from "@/lib/mini-app/service";
import { componentTreeSchema, PAGE_SLUG } from "@/lib/mini-app/schema";

type Params = { params: Promise<{ botId: string; pageId: string }> };

/**
 * Sahifa tahriri.
 *
 * `components` — konstruktordagi butun daraxt. U klientdan kelgani uchun
 * serverda qaytadan tekshiriladi (`componentTreeSchema`): noma'lum tur yoki
 * buzilgan sozlama bazaga tushmaydi.
 */
const schema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  slug: PAGE_SLUG.optional(),
  title: z.string().trim().max(120).nullable().optional(),
  isHome: z.boolean().optional(),
  components: componentTreeSchema.optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId, pageId } = await params;

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  if (Object.keys(parsed.data).length === 0) {
    return fail("O'zgartirish uchun maydon berilmadi", 400);
  }

  try {
    const page = await updatePage(botId, botScope(auth.ctx), pageId, parsed.data);
    return ok({ page });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId, pageId } = await params;

  try {
    await deletePage(botId, botScope(auth.ctx), pageId);
    return ok({ ok: true });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
