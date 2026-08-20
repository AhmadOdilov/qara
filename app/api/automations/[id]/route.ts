import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { guardWorkspace, WorkspaceError } from "@/lib/workspace";
import { audit } from "@/lib/bots/audit";
import { automationSchema } from "@/lib/automation/types";
import {
  deleteAutomation,
  duplicateAutomation,
  getAutomation,
  setStatus,
  updateAutomation,
} from "@/lib/automation/service";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.union([
  z.object({ action: z.literal("save"), automation: automationSchema }),
  z.object({ action: z.literal("status"), status: z.enum(["draft", "published", "disabled"]) }),
  z.object({ action: z.literal("duplicate") }),
]);

export async function GET(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:read" });
  if ("response" in auth) return auth.response;

  const { id } = await params;
  try {
    const automation = await getAutomation(auth.ctx, id);
    if (!automation) return fail("Avtomat topilmadi", 404);
    return ok({ automation });
  } catch (error) {
    if (error instanceof WorkspaceError) return fail(error.message, error.status);
    throw error;
  }
}

/** Saqlash, holat o'zgartirish va nusxalash — bitta endpoint. */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = await parseBody(request, patchSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const body = parsed.data;

    if (body.action === "save") {
      const saved = await updateAutomation(auth.ctx, id, body.automation);
      await logChange(auth.ctx.user.id, request, id, "saved");
      return ok({ automation: saved });
    }

    if (body.action === "status") {
      const changed = await setStatus(auth.ctx, id, body.status);
      await logChange(auth.ctx.user.id, request, id, body.status);
      return ok({ automation: changed });
    }

    const copy = await duplicateAutomation(auth.ctx, id);
    await logChange(auth.ctx.user.id, request, copy.id, "duplicated");
    return ok({ automation: copy }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceError) return fail(error.message, error.status);
    throw error;
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:delete" });
  if ("response" in auth) return auth.response;

  const { id } = await params;
  try {
    await deleteAutomation(auth.ctx, id);
    await logChange(auth.ctx.user.id, request, id, "deleted");
    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof WorkspaceError) return fail(error.message, error.status);
    throw error;
  }
}

function logChange(
  actorId: string,
  request: Request,
  automationId: string,
  event: string,
) {
  return audit("AUTOMATION_UPDATED", {
    actorId,
    ip: clientIp(request),
    metadata: { event, automationId },
  });
}
