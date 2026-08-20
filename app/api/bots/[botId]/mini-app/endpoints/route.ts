import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { botScope, can, guardWorkspace } from "@/lib/workspace";
import { BotServiceError } from "@/lib/bots/service";
import { listEndpoints, saveEndpoint, setAllowlist } from "@/lib/mini-app/service";
import { HTTP_METHODS } from "@/lib/mini-app/api-action";

type Params = { params: Promise<{ botId: string }> };

const endpointSchema = z.object({
  name: z.string().trim().min(1).max(64),
  method: z.enum(HTTP_METHODS),
  url: z.string().trim().min(1).max(2048),
  /// Sarlavhalarda API kaliti bo'lishi mumkin — shuning uchun `secret:write`
  headers: z.record(z.string().max(64), z.string().max(1024)).optional(),
  bodyTemplate: z.unknown().optional(),
  responseMap: z.record(z.string().max(64), z.string().max(200)).optional(),
  timeoutMs: z.number().int().min(1000).max(15_000).optional(),
});

const allowlistSchema = z.object({
  allowlist: z.array(z.string().trim().max(253)).max(20),
});

/** Sozlangan API amallari. Sarlavha QIYMATLARI qaytarilmaydi. */
export async function GET(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:read" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  try {
    return ok({ endpoints: await listEndpoints(botId, botScope(auth.ctx)) });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

export async function POST(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  // Endpoint sarlavhalari sir saqlaydi — bu alohida huquq talab qiladi.
  if (!can(auth.ctx.role, "secret:write")) {
    return fail("API amallarini sozlash uchun ruxsat yo'q", 403);
  }

  const parsed = await parseBody(request, endpointSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const endpoint = await saveEndpoint(botId, botScope(auth.ctx), parsed.data);
    return ok({ endpoint: { id: endpoint.id, name: endpoint.name } }, { status: 201 });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

/** Ruxsat etilgan domenlar ro'yxati — SSRF himoyasining eng qattiq rejimi. */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  const parsed = await parseBody(request, allowlistSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const allowlist = await setAllowlist(botId, botScope(auth.ctx), parsed.data.allowlist);
    return ok({ allowlist });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
