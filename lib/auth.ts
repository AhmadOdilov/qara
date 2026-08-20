import "server-only";
import { cookies, headers } from "next/headers";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Role, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "qara_session";
export const CSRF_COOKIE = "qara_csrf";
const SESSION_TTL_DAYS = 30;

const secretKey = new TextEncoder().encode(env.authSecret);

/**
 * Sessiya ikki qatlamli: bazadagi `sessions` yozuvi (bekor qilish uchun) va
 * uni ko'rsatuvchi imzolangan JWT cookie. Cookie o'g'irlansa ham DB'dagi
 * yozuvni o'chirish bilan sessiya darhol kuchdan qoladi.
 */
type SessionClaims = { sid: string; uid: string };

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<void> {
  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 864e5);

  const hdrs = await headers();
  const session = await prisma.session.create({
    data: {
      userId,
      sessionToken,
      expiresAt,
      userAgent: hdrs.get("user-agent")?.slice(0, 255) ?? null,
      ip:
        hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        hdrs.get("x-real-ip") ??
        null,
    },
  });

  const jwt = await new SignJWT({ sid: session.id, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secretKey);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    expires: expiresAt,
  });

  // CSRF uchun double-submit token: JS o'qiy oladigan cookie, uni klient
  // har bir o'zgartiruvchi so'rovda X-CSRF-Token sarlavhasida qaytaradi.
  jar.set(CSRF_COOKIE, randomBytes(24).toString("hex"), {
    httpOnly: false,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const claims = await readClaims(token);
    if (claims) {
      await prisma.session
        .delete({ where: { id: claims.sid } })
        .catch(() => undefined);
    }
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(CSRF_COOKIE);
}

async function readClaims(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    if (typeof payload.sid === "string" && typeof payload.uid === "string") {
      return { sid: payload.sid, uid: payload.uid };
    }
    return null;
  } catch {
    return null;
  }
}

export type SessionUser = Pick<
  User,
  | "id"
  | "email"
  | "name"
  | "role"
  | "lang"
  | "avatarUrl"
  | "notifyTelegram"
  | "notifyEmail"
  | "quietHours"
  | "createdAt"
>;

/** Joriy foydalanuvchi yoki null. Muddati o'tgan sessiyalar tozalanadi. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await readClaims(token);
  if (!claims) return null;

  const session = await prisma.session.findUnique({
    where: { id: claims.sid },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          lang: true,
          avatarUrl: true,
          notifyTelegram: true,
          notifyEmail: true,
          quietHours: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

/** Sahifalar uchun: foydalanuvchi bo'lmasa xato tashlaydi (layout redirect qiladi). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export function isAdmin(user: { role: Role } | null): boolean {
  return user?.role === "admin";
}

/**
 * O'zgartiruvchi (POST/PATCH/DELETE) so'rovlar uchun CSRF tekshiruvi:
 * cookie'dagi token sarlavhadagi token bilan mos kelishi shart.
 */
export async function verifyCsrf(request: Request): Promise<boolean> {
  const jar = await cookies();
  const cookieToken = jar.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get("x-csrf-token");
  if (!cookieToken || !headerToken) return false;
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Deep link tokenlari va shu kabi maxfiy qiymatlar uchun. */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
