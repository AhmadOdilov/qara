import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { BotServiceError } from "@/lib/bots/service";
import { createPage } from "@/lib/mini-app/service";
import { PAGE_SLUG } from "@/lib/mini-app/schema";

type Params = { params: Promise<{ botId: string }> };

const schema = z.object({
  name: z.string().trim().min(1).max(64),
  slug: PAGE_SLUG,
  title: z.string().trim().max(120).nullable().optional(),
});

/** Yangi sahifa. Birinchi sahifa avtomatik bosh sahifa bo'ladi. */
export async function POST(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  try {
    const page = await createPage(botId, botScope(auth.ctx), parsed.data);
    return ok({ page }, { status: 201 });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
