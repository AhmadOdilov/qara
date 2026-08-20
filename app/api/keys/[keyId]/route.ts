import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { guardWorkspace } from "@/lib/workspace";
import {
  ApiKeyError,
  deleteApiKey,
  renameApiKey,
  revokeApiKey,
} from "@/lib/api-keys";
import { audit } from "@/lib/bots/audit";

type Params = { params: Promise<{ keyId: string }> };

const patchSchema = z.union([
  z.object({ name: z.string().trim().min(1).max(64) }),
  z.object({ revoked: z.literal(true) }),
]);

/** Nomni o'zgartirish yoki bekor qilish. */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "apikey:manage" });
  if ("response" in auth) return auth.response;
  const { keyId } = await params;

  const parsed = await parseBody(request, patchSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const key =
      "revoked" in parsed.data
        ? await revokeApiKey(keyId, auth.ctx.workspaceId)
        : await renameApiKey(keyId, auth.ctx.workspaceId, parsed.data.name);

    await audit("API_KEY_UPDATED", {
      actorId: auth.ctx.user.id,
      ip: clientIp(request),
      metadata: {
        event: "revoked" in parsed.data ? "revoked" : "renamed",
        keyId,
      },
    });

    return ok({ key });
  } catch (error) {
    if (error instanceof ApiKeyError) return fail(error.message, error.status);
    throw error;
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "apikey:manage" });
  if ("response" in auth) return auth.response;
  const { keyId } = await params;

  try {
    await deleteApiKey(keyId, auth.ctx.workspaceId);
    await audit("API_KEY_UPDATED", {
      actorId: auth.ctx.user.id,
      ip: clientIp(request),
      metadata: { event: "deleted", keyId },
    });
    return ok({ ok: true });
  } catch (error) {
    if (error instanceof ApiKeyError) return fail(error.message, error.status);
    throw error;
  }
}
