import { z } from "zod";
import { NextResponse } from "next/server";
import { fail, guard, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { WORKSPACE_COOKIE } from "@/lib/workspace";

const schema = z.object({ workspaceId: z.string().min(1).max(64) });

/**
 * Faol ish maydonini almashtirish.
 *
 * Cookie'ga yozishdan OLDIN a'zolik tekshiriladi. `activeWorkspace()` ham
 * cookie'ga ishonmaydi va a'zolikni qayta tekshiradi — ya'ni cookie'ni
 * qo'lda o'zgartirish bilan begona ish maydoniga kirib bo'lmaydi.
 */
export async function POST(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: auth.user.id, workspaceId: parsed.data.workspaceId },
    select: { id: true },
  });
  if (!membership) return fail("Ish maydoni topilmadi", 404);

  const response = NextResponse.json({ workspaceId: parsed.data.workspaceId });
  response.cookies.set(WORKSPACE_COOKIE, parsed.data.workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
