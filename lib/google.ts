import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@/lib/env";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

// Google'ning ochiq kalitlari; jose ularni keshlab turadi.
const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export function googleRedirectUri(): string {
  return `${env.appUrl}/api/auth/google/callback`;
}

/**
 * Authorization Code oqimining birinchi bosqichi.
 * `state` — CSRF himoyasi uchun; callback'da cookie bilan solishtiriladi.
 */
export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

type GoogleProfile = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
};

/**
 * Kodni tokenga almashtiradi va id_token'ni Google JWKS bilan tekshiradi
 * (imzo, issuer, audience, muddat). Faqat shundan keyin profilga ishonamiz.
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token almashinuvi muvaffaqiyatsiz: ${response.status}`);
  }

  const payload = (await response.json()) as { id_token?: string };
  if (!payload.id_token) throw new Error("Google id_token qaytarmadi");

  const { payload: claims } = await jwtVerify(payload.id_token, jwks, {
    issuer: GOOGLE_ISSUERS,
    audience: env.google.clientId,
  });

  const email = typeof claims.email === "string" ? claims.email : "";
  if (!email) throw new Error("Google profilida email yo'q");

  return {
    googleId: String(claims.sub),
    email: email.toLowerCase(),
    emailVerified: claims.email_verified === true,
    name:
      (typeof claims.name === "string" && claims.name) || email.split("@")[0],
    picture: typeof claims.picture === "string" ? claims.picture : undefined,
  };
}
