import { z } from "zod";
import { clientIp, fail, ok, parseBody, rateLimit } from "@/lib/api";
import { guardWorkspace, WorkspaceError } from "@/lib/workspace";
import { addMember, listMembers, ASSIGNABLE_ROLES } from "@/lib/workspace-members";
import { audit } from "@/lib/bots/audit";

const addSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email noto'g'ri").max(200),
  role: z.enum(["admin", "editor", "support", "viewer"]),
});

/** Ish maydoni a'zolari. Ro'yxatni ko'rish uchun ham `member:manage` kerak. */
export async function GET(request: Request) {
  const auth = await guardWorkspace(request, { capability: "member:manage" });
  if ("response" in auth) return auth.response;

  return ok({
    members: await listMembers(auth.ctx),
    assignableRoles: ASSIGNABLE_ROLES,
  });
}

/** Mavjud Qara hisobini ish maydoniga qo'shadi. */
export async function POST(request: Request) {
  const auth = await guardWorkspace(request, { capability: "member:manage" });
  if ("response" in auth) return auth.response;

  const limit = rateLimit(`ws:member:add:${auth.ctx.user.id}`, 10, 60_000);
  if (!limit.allowed) return fail("Juda ko'p urinish. Biroz kuting.", 429);

  const parsed = await parseBody(request, addSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const member = await addMember(auth.ctx, parsed.data.email, parsed.data.role);

    await audit("WORKSPACE_MEMBER_UPDATED", {
      actorId: auth.ctx.user.id,
      ip: clientIp(request),
      metadata: { event: "added", memberId: member.id, role: member.role },
    });

    return ok({ member }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceError) return fail(error.message, error.status);
    throw error;
  }
}
