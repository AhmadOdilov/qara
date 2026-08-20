import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { botScope, can, guardWorkspace } from "@/lib/workspace";
import { BotServiceError } from "@/lib/bots/service";
import { deleteEndpoint, saveEndpoint } from "@/lib/mini-app/service";
import { HTTP_METHODS } from "@/lib/mini-app/api-action";

type Params = { params: Promise<{ botId: string; endpointId: string }> };

const schema = z.object({
  name: z.string().trim().min(1).max(64),
  method: z.enum(HTTP_METHODS),
  url: z.string().trim().min(1).max(2048),
  headers: z.record(z.string().max(64), z.string().max(1024)).optional(),
  bodyTemplate: z.unknown().optional(),
  responseMap: z.record(z.string().max(64), z.string().max(200)).optional(),
  timeoutMs: z.number().int().min(1000).max(15_000).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId, endpointId } = await params;

  if (!can(auth.ctx.role, "secret:write")) {
    return fail("API amallarini sozlash uchun ruxsat yo'q", 403);
  }

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  try {
    const endpoint = await saveEndpoint(botId, botScope(auth.ctx), parsed.data, endpointId);
    return ok({ endpoint: { id: endpoint.id, name: endpoint.name } });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId, endpointId } = await params;

  try {
    await deleteEndpoint(botId, botScope(auth.ctx), endpointId);
    return ok({ ok: true });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
