import { z } from "zod";
import { clientIp, fail, ok, parseBody, rateLimit } from "@/lib/api";
import { guardWorkspace, WorkspaceError } from "@/lib/workspace";
import { audit } from "@/lib/bots/audit";
import { automationSchema } from "@/lib/automation/types";
import { createAutomation, listAutomations } from "@/lib/automation/service";

const createSchema = z.object({
  botId: z.string().min(1).max(64),
  automation: automationSchema,
});

/** Ish maydonidagi avtomatlar. */
export async function GET(request: Request) {
  const auth = await guardWorkspace(request, { capability: "bot:read" });
  if ("response" in auth) return auth.response;

  return ok({ automations: await listAutomations(auth.ctx) });
}

/** Yangi avtomat — HAR DOIM qoralama holatida. */
export async function POST(request: Request) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;

  const limit = rateLimit(`automation:create:${auth.ctx.user.id}`, 20, 60_000);
  if (!limit.allowed) return fail("Juda ko'p urinish. Biroz kuting.", 429);

  const parsed = await parseBody(request, createSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const created = await createAutomation(
      auth.ctx,
      parsed.data.botId,
      parsed.data.automation,
    );
    await audit("AUTOMATION_UPDATED", {
      botId: parsed.data.botId,
      actorId: auth.ctx.user.id,
      ip: clientIp(request),
      metadata: { event: "created", automationId: created.id },
    });
    return ok({ automation: created }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceError) return fail(error.message, error.status);
    throw error;
  }
}
