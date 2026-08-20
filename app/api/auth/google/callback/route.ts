import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { env, googleOAuthEnabled } from "@/lib/env";
import { exchangeGoogleCode } from "@/lib/google";
import { createSession } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { OAUTH_STATE_COOKIE } from "../route";
import { log } from "@/lib/log";

function redirectWithError(reason: string) {
  return NextResponse.redirect(`${env.appUrl}/login?error=${reason}`, 302);
}

export async function GET(request: Request) {
  if (!googleOAuthEnabled) return redirectWithError("google_disabled");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (url.searchParams.get("error")) return redirectWithError("google_denied");
  if (!code || !state) return redirectWithError("google_invalid");

  // state cookie'dagi qiymat bilan mos kelishi shart (CSRF himoyasi).
  const jar = await cookies();
  const expectedState = jar.get(OAUTH_STATE_COOKIE)?.value;
  jar.delete(OAUTH_STATE_COOKIE);
  if (!expectedState || expectedState !== state) {
    return redirectWithError("google_state");
  }

  let profile;
  try {
    profile = await exchangeGoogleCode(code);
  } catch (error) {
    log.error("google-oauth: kirish bajarilmadi", {
      reason: error instanceof Error ? error.message : "noma'lum",
    });
    return redirectWithError("google_failed");
  }

  if (!profile.emailVerified) return redirectWithError("google_unverified");

  // Mavjud hisobga bog'lash: shu email bilan parolli hisob bo'lsa, unga
  // googleId qo'shiladi — ikkita alohida hisob yaratilmaydi.
  const existing = await prisma.user.findFirst({
    where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
  });

  let userId: string;
  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        googleId: existing.googleId ?? profile.googleId,
        avatarUrl: existing.avatarUrl ?? profile.picture ?? null,
      },
    });
    userId = updated.id;
    await track("login", userId, { method: "google" });
  } else {
    const created = await prisma.user.create({
      data: {
        email: profile.email,
        googleId: profile.googleId,
        name: profile.name,
        avatarUrl: profile.picture ?? null,
      },
    });
    userId = created.id;
    await track("signup", userId, { method: "google" });
  }

  await createSession(userId);
  return NextResponse.redirect(`${env.appUrl}/dashboard`, 302);
}
