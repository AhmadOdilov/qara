import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env, googleOAuthEnabled } from "@/lib/env";
import { googleAuthUrl } from "@/lib/google";
import { randomToken } from "@/lib/auth";

export const OAUTH_STATE_COOKIE = "qara_oauth_state";

/** Foydalanuvchini Google roziliq sahifasiga yo'naltiradi. */
export async function GET() {
  if (!googleOAuthEnabled) {
    return NextResponse.redirect(
      `${env.appUrl}/login?error=google_disabled`,
      302,
    );
  }

  const state = randomToken(16);
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(googleAuthUrl(state), 302);
}
