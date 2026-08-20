import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { guardWorkspace, WorkspaceError } from "@/lib/workspace";
import { changeRole, removeMember } from "@/lib/workspace-members";
import { audit } from "@/lib/bots/audit";

const roleSchema = z.object({
  role: z.enum(["admin", "editor", "support", "viewer"]),
});

/** Rolni o'zgartirish. Ega roliga va o'z roliga tegib bo'lmaydi. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const auth = await guardWorkspace(request, { capability: "member:manage" });
  if ("response" in auth) return auth.response;

  const { memberId } = await params;
  const parsed = await parseBody(request, roleSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const member = await changeRole(auth.ctx, memberId, parsed.data.role);

    await audit("WORKSPACE_MEMBER_UPDATED", {
      actorId: auth.ctx.user.id,
      ip: clientIp(request),
      metadata: { event: "role_changed", memberId, role: parsed.data.role },
    });

    return ok({ member });
  } catch (error) {
    if (error instanceof WorkspaceError) return fail(error.message, error.status);
    throw error;
  }
}

/** A'zoni ish maydonidan chiqarish. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const auth = await guardWorkspace(request, { capability: "member:manage" });
  if ("response" in auth) return auth.response;

  const { memberId } = await params;

  try {
    await removeMember(auth.ctx, memberId);

    await audit("WORKSPACE_MEMBER_UPDATED", {
      actorId: auth.ctx.user.id,
      ip: clientIp(request),
      metadata: { event: "removed", memberId },
    });

    return ok({ removed: true });
  } catch (error) {
    if (error instanceof WorkspaceError) return fail(error.message, error.status);
    throw error;
  }
}
