import "server-only";
import type { WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { WorkspaceError, type WorkspaceContext } from "@/lib/workspace";

/**
 * Ish maydoni a'zolarini boshqarish (§21).
 *
 * Rollar `lib/workspace.ts` dagi `CAPABILITIES` bilan bir xil manbadan
 * keladi — bu modul yangi huquq tizimi yaratmaydi, mavjudini ishlatadi.
 *
 * Taklif (invite) oqimi ataylab sodda: a'zo qilib qo'shish uchun odamning
 * Qara hisobi BO'LISHI kerak. Kutilayotgan taklif jadvali va email yuborish
 * hali yo'q — bo'lmagan narsani ishlayotgandek ko'rsatmaymiz.
 */

export const ASSIGNABLE_ROLES: readonly WorkspaceRole[] = [
  "admin",
  "editor",
  "support",
  "viewer",
];

/** Bitta workspace'da ko'pi bilan shuncha a'zo. */
export const MAX_MEMBERS = 50;

export type MemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  avatarUrl: string | null;
  joinedAt: Date;
  /** Shu qator so'rov yuborgan odamning o'ziga tegishlimi. */
  isSelf: boolean;
};

export async function listMembers(ctx: WorkspaceContext): Promise<MemberRow[]> {
  const rows = await prisma.workspaceMember.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.user.id,
    name: row.user.name,
    email: row.user.email,
    role: row.role,
    avatarUrl: row.user.avatarUrl,
    joinedAt: row.createdAt,
    isSelf: row.user.id === ctx.user.id,
  }));
}

/**
 * Mavjud Qara hisobini ish maydoniga qo'shadi.
 *
 * `owner` roli bu yerdan berilmaydi: egalikni o'tkazish alohida, ataylab
 * tasdiqlanadigan amal bo'lishi kerak — uni a'zo qo'shish formasiga
 * yashirib qo'yish xavfli.
 */
export async function addMember(
  ctx: WorkspaceContext,
  email: string,
  role: WorkspaceRole,
): Promise<MemberRow> {
  if (!ASSIGNABLE_ROLES.includes(role)) {
    throw new WorkspaceError("Bu rolni bu yerdan berib bo'lmaydi", 422);
  }

  const count = await prisma.workspaceMember.count({
    where: { workspaceId: ctx.workspaceId },
  });
  if (count >= MAX_MEMBERS) {
    throw new WorkspaceError(
      `Ish maydonida ko'pi bilan ${MAX_MEMBERS} a'zo bo'lishi mumkin`,
      409,
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });

  if (!user) {
    throw new WorkspaceError(
      "Bu email bilan Qara hisobi topilmadi. Avval shu odam ro'yxatdan o'tsin.",
      404,
    );
  }

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId: user.id } },
    select: { id: true },
  });
  if (existing) {
    throw new WorkspaceError("Bu odam allaqachon ish maydonida", 409);
  }

  const member = await prisma.workspaceMember.create({
    data: { workspaceId: ctx.workspaceId, userId: user.id, role },
    select: { id: true, role: true, createdAt: true },
  });

  return {
    id: member.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: member.role,
    avatarUrl: user.avatarUrl,
    joinedAt: member.createdAt,
    isSelf: false,
  };
}

export async function changeRole(
  ctx: WorkspaceContext,
  memberId: string,
  role: WorkspaceRole,
): Promise<MemberRow> {
  if (!ASSIGNABLE_ROLES.includes(role)) {
    throw new WorkspaceError("Bu rolni berib bo'lmaydi", 422);
  }

  const member = await requireMember(ctx, memberId);

  // Egaga bu yerdan tegib bo'lmaydi — aks holda admin egani tushirib,
  // ish maydonini egallab olardi.
  if (member.role === "owner") {
    throw new WorkspaceError("Ega rolini o'zgartirib bo'lmaydi", 403);
  }
  if (member.userId === ctx.user.id) {
    throw new WorkspaceError("O'z rolingizni o'zingiz o'zgartira olmaysiz", 403);
  }

  const updated = await prisma.workspaceMember.update({
    where: { id: memberId },
    data: { role },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  return {
    id: updated.id,
    userId: updated.user.id,
    name: updated.user.name,
    email: updated.user.email,
    role: updated.role,
    avatarUrl: updated.user.avatarUrl,
    joinedAt: updated.createdAt,
    isSelf: false,
  };
}

export async function removeMember(
  ctx: WorkspaceContext,
  memberId: string,
): Promise<void> {
  const member = await requireMember(ctx, memberId);

  if (member.role === "owner") {
    throw new WorkspaceError("Egani ish maydonidan chiqarib bo'lmaydi", 403);
  }
  if (member.userId === ctx.user.id) {
    throw new WorkspaceError("O'zingizni o'zingiz chiqara olmaysiz", 403);
  }

  await prisma.workspaceMember.delete({ where: { id: memberId } });
}

/**
 * A'zoni SHU ish maydoni ichidan topadi.
 *
 * Boshqa workspace'dagi a'zo uchun ham «topilmadi» qaytadi — mavjudligi
 * oshkor bo'lmasin (`requireBot` bilan bir xil tartib).
 */
async function requireMember(
  ctx: WorkspaceContext,
  memberId: string,
): Promise<{ userId: string; role: WorkspaceRole }> {
  const member = await prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId: ctx.workspaceId },
    select: { userId: true, role: true },
  });
  if (!member) throw new WorkspaceError("A'zo topilmadi", 404);
  return member;
}
