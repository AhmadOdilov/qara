import { z } from "zod";
import { clientIp, fail, ok, parseBody, rateLimit } from "@/lib/api";
import { guardWorkspace } from "@/lib/workspace";
import { ApiKeyError, createApiKey, listApiKeys } from "@/lib/api-keys";
import { audit } from "@/lib/bots/audit";

const createSchema = z.object({
  name: z.string().trim().min(1, "Kalitga nom bering").max(64),
});

/** Ish maydonidagi API kalitlari. To'liq qiymat hech qachon qaytmaydi. */
export async function GET(request: Request) {
  const auth = await guardWorkspace(request, { capability: "apikey:read" });
  if ("response" in auth) return auth.response;

  return ok({ keys: await listApiKeys(auth.ctx.workspaceId) });
}

/**
 * Yangi kalit. `plain` — javobda BIR MARTA qaytadi va boshqa hech qayerdan
 * olib bo'lmaydi; UI buni ochiq aytadi.
 */
export async function POST(request: Request) {
  const auth = await guardWorkspace(request, { capability: "apikey:manage" });
  if ("response" in auth) return auth.response;

  const limit = rateLimit(`keys:create:${auth.ctx.user.id}`, 10, 60_000);
  if (!limit.allowed) return fail("Juda ko'p urinish. Biroz kuting.", 429);

  const parsed = await parseBody(request, createSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const { key, plain } = await createApiKey({
      workspaceId: auth.ctx.workspaceId,
      actorId: auth.ctx.user.id,
      name: parsed.data.name,
    });

    // Audit'ga faqat id va nom — kalitning o'zi emas.
    await audit("API_KEY_UPDATED", {
      actorId: auth.ctx.user.id,
      ip: clientIp(request),
      metadata: { event: "created", keyId: key.id, name: key.name },
    });

    return ok({ key, plain }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiKeyError) return fail(error.message, error.status);
    throw error;
  }
}
