import "server-only";
import type { WorkspaceRole } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, guard } from "@/lib/api";
import { requireUser, type SessionUser } from "@/lib/auth";

/**
 * Ko'p ijarachilik (§56) va rollar (RBAC).
 *
 * Har bir resurs `workspaceId` ga tegishli va HAR BIR so'rov shu bo'yicha
 * filtrlanadi. Egalik `ownerId` bilan emas, a'zolik bilan aniqlanadi —
 * shuning uchun jamoadagi boshqa odam ham botni ocha oladi, begona esa
 * mavjudligini ham bila olmaydi (topilmadi va ruxsat yo'q — bir xil xato).
 */

export class WorkspaceError extends Error {
  constructor(
    message: string,
    readonly status = 403,
  ) {
    super(message);
    this.name = "WorkspaceError";
  }
}

/* ── Huquqlar ────────────────────────────────────────────────────────────── */

/**
 * Qobiliyatlar ro'yxati. Ataylab daraja ("owner > admin > ...") emas, aniq
 * ro'yxat: `support` operator sifatida suhbatga javob bera oladi, lekin
 * konfiguratsiyani o'zgartira olmaydi — bu bosqichli tartibga sig'maydi.
 */
export const CAPABILITIES = {
  "workspace:manage": ["owner"],
  "member:manage": ["owner", "admin"],
  "bot:read": ["owner", "admin", "editor", "support", "viewer"],
  "bot:create": ["owner", "admin", "editor"],
  "bot:edit": ["owner", "admin", "editor"],
  "bot:publish": ["owner", "admin", "editor"],
  "bot:delete": ["owner", "admin"],
  /// Token, AI kaliti, integratsiya siri — eng nozik amal
  "secret:write": ["owner", "admin"],
  /// Operator sifatida bot foydalanuvchisiga javob berish (§37)
  "conversation:reply": ["owner", "admin", "editor", "support"],
  "analytics:read": ["owner", "admin", "editor", "support", "viewer"],
  /// API kalitlari (§8) — sir bilan teng darajadagi nozik amal
  "apikey:read": ["owner", "admin"],
  "apikey:manage": ["owner", "admin"],
} as const satisfies Record<string, readonly WorkspaceRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: WorkspaceRole, capability: Capability): boolean {
  return (CAPABILITIES[capability] as readonly WorkspaceRole[]).includes(role);
}

/* ── Kontekst ────────────────────────────────────────────────────────────── */

export type WorkspaceContext = {
  user: SessionUser;
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
};

/** Faol ish maydonini eslab qoladigan cookie. `qara_lang` bilan bir xil uslub. */
export const WORKSPACE_COOKIE = "qara_ws";

export type WorkspaceOption = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

/** Foydalanuvchi a'zo bo'lgan barcha ish maydonlari. */
export async function listWorkspaces(userId: string): Promise<WorkspaceOption[]> {
  const rows = await prisma.workspaceMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { role: true, workspace: { select: { id: true, name: true } } },
  });
  return rows.map((row) => ({
    id: row.workspace.id,
    name: row.workspace.name,
    role: row.role,
  }));
}

/**
 * Foydalanuvchining faol ish maydoni.
 *
 * Tanlash tartibi:
 *   1) `qara_ws` cookie — foydalanuvchi o'zi tanlagani (a'zoligi tekshiriladi),
 *   2) eng eski a'zolik — shaxsiy ish maydoni,
 *   3) a'zolik umuman yo'q bo'lsa shaxsiy workspace yaratiladi.
 *
 * Cookie'siz ikkinchi qadam yagona yo'l bo'lib qolardi: boshqa ish maydoniga
 * qo'shilgan odam u yerga hech qachon o'tolmasdi va «a'zo qo'shish» amalda
 * ishlamasdi.
 *
 * Id deterministik (`ws_<userId>`) — migratsiyadagi backfill bilan bir xil,
 * shuning uchun bir vaqtda kelgan ikki so'rov ikkita workspace yaratmaydi.
 */
export async function activeWorkspace(user: SessionUser): Promise<WorkspaceContext> {
  const chosen = await readWorkspaceCookie();

  // Cookie'dagi id faqat A'ZOLIK tasdiqlansa ishlatiladi — boshqa odamning
  // ish maydoni id'sini cookie'ga yozib qo'yish bilan kirib bo'lmaydi.
  const membership = await prisma.workspaceMember.findFirst({
    where: chosen ? { userId: user.id, workspaceId: chosen } : { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { role: true, workspace: { select: { id: true, name: true } } },
  });

  if (membership) {
    return {
      user,
      workspaceId: membership.workspace.id,
      workspaceName: membership.workspace.name,
      role: membership.role,
    };
  }

  // Cookie eskirgan bo'lishi mumkin (a'zolikdan chiqarilgan) — u holda
  // odatdagi tartibga qaytamiz.
  if (chosen) {
    const fallback = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { role: true, workspace: { select: { id: true, name: true } } },
    });
    if (fallback) {
      return {
        user,
        workspaceId: fallback.workspace.id,
        workspaceName: fallback.workspace.name,
        role: fallback.role,
      };
    }
  }

  const id = `ws_${user.id}`;
  const name = user.name.trim() || user.email.split("@")[0];

  const workspace = await prisma.workspace.upsert({
    where: { id },
    update: {},
    create: { id, name, slug: `w-${user.id.toLowerCase()}` },
    select: { id: true, name: true },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user.id, role: "owner" },
  });

  return {
    user,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    role: "owner",
  };
}

/** Cookie o'qish — API route'ida ham, sahifada ham ishlaydi. */
async function readWorkspaceCookie(): Promise<string | null> {
  try {
    const jar = await cookies();
    const value = jar.get(WORKSPACE_COOKIE)?.value?.trim();
    return value ? value : null;
  } catch {
    // Cookie kontekstidan tashqarida chaqirilsa (masalan skript) — e'tiborsiz.
    return null;
  }
}

/** Sahifalar uchun: sessiya + faol workspace. */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  return activeWorkspace(await requireUser());
}

/**
 * Bot xizmatiga uzatiladigan qamrov: kirish huquqi `workspaceId` bilan,
 * audit yozuvi `actorId` bilan belgilanadi.
 */
export function botScope(ctx: WorkspaceContext): {
  workspaceId: string;
  actorId: string;
} {
  return { workspaceId: ctx.workspaceId, actorId: ctx.user.id };
}

/** Sahifada huquqni tekshirish — yetarli bo'lmasa `WorkspaceError`. */
export function requireCapability(
  ctx: WorkspaceContext,
  capability: Capability,
): void {
  if (!can(ctx.role, capability)) {
    throw new WorkspaceError("Bu amal uchun ruxsat yo'q", 403);
  }
}

/* ── API guard ───────────────────────────────────────────────────────────── */

/**
 * `guard()` ustiga workspace va huquq tekshiruvini qo'shadi.
 * Route'lar shu bilan bitta qatorda sessiya + CSRF + ijarachilik + rolni oladi.
 */
export async function guardWorkspace(
  request: Request,
  opts: { capability?: Capability; csrf?: boolean } = {},
): Promise<{ ctx: WorkspaceContext } | { response: NextResponse }> {
  const auth = await guard(request, { csrf: opts.csrf });
  if ("response" in auth) return auth;

  const ctx = await activeWorkspace(auth.user);

  if (opts.capability && !can(ctx.role, opts.capability)) {
    return { response: fail("Bu amal uchun ruxsat yo'q", 403) };
  }
  return { ctx };
}
