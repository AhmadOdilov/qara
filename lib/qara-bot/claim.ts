import "server-only";
import type { Lang } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/auth";
import { track } from "@/lib/analytics";

/**
 * Telegramdan dashboardga o'tish (§10).
 *
 * XAVFSIZLIK MODELI
 * Deep link ichida hech qanday credential yo'q (§24, §57). Bot bir martalik,
 * 15 daqiqalik, ma'nosiz tasodifiy tutqich chiqaradi; bazada esa uning
 * SHA-256 hash'i yotadi — baza o'g'irlansa ham tutqichni tiklab bo'lmaydi.
 *
 * Tutqich amalda "sehrli havola" bilan bir xil ishonch modeliga ega:
 * uni ko'rgan odam shu hisobga kira oladi. Shuning uchun:
 *   · faqat URL tugmasi sifatida yuboriladi (xabar matnida emas),
 *   · bir marta ishlatilgach kuchdan qoladi,
 *   · muddati qisqa,
 *   · hech qayerda log qilinmaydi.
 */

const CLAIM_TTL_MIN = 15;

/** Telegram hisobidan yaratilgan foydalanuvchining pochta o'rin egallovchisi. */
function placeholderEmail(telegramUserId: string): string {
  return `tg${telegramUserId}@telegram.local`;
}

/**
 * Telegram foydalanuvchisi uchun hisob va ish maydonini tayyorlaydi.
 *
 * Allaqachon bog'langan bo'lsa — mavjudini qaytaradi, yangi hisob ochmaydi.
 */
export async function ensureAccount(input: {
  telegramUserId: string;
  chatId: string;
  firstName?: string | null;
  username?: string | null;
  lang: Lang;
}): Promise<{ userId: string; workspaceId: string; created: boolean }> {
  const existing = await prisma.telegramLink.findUnique({
    where: { telegramUserId: input.telegramUserId },
    select: { userId: true },
  });

  if (existing) {
    const workspaceId = await ensureWorkspace(existing.userId, input.firstName);
    return { userId: existing.userId, workspaceId, created: false };
  }

  const name = input.firstName?.trim() || input.username?.trim() || "Qara foydalanuvchisi";

  // Parol ham, Google ham yo'q: bu hisobga Telegram orqali kiriladi.
  // Foydalanuvchi keyin profilda haqiqiy email va parol qo'sha oladi.
  const user = await prisma.user.create({
    data: {
      email: placeholderEmail(input.telegramUserId),
      name,
      lang: input.lang,
      telegramLink: {
        create: {
          telegramUserId: input.telegramUserId,
          telegramChatId: input.chatId,
          username: input.username ?? null,
          firstName: input.firstName ?? null,
          connectedAt: new Date(),
          // Bog'lash allaqachon bajarilgan — deep link tokeni kerak emas.
          linkToken: `tg_${input.telegramUserId}_${Date.now()}`,
          linkTokenExp: new Date(),
        },
      },
    },
    select: { id: true },
  });

  const workspaceId = await ensureWorkspace(user.id, name);
  await track("signup", user.id, { via: "telegram" });

  return { userId: user.id, workspaceId, created: true };
}

async function ensureWorkspace(userId: string, name?: string | null): Promise<string> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { workspaceId: true },
  });
  if (membership) return membership.workspaceId;

  // `lib/workspace.ts` bilan bir xil deterministik id — ikki yo'l bir xil
  // workspace'ga olib keladi va nusxa yaratilmaydi.
  const id = `ws_${userId}`;
  const workspace = await prisma.workspace.upsert({
    where: { id },
    update: {},
    create: {
      id,
      name: name?.trim() || "Mening ish maydonim",
      slug: `w-${userId.toLowerCase()}`,
    },
    select: { id: true },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
    update: {},
    create: { workspaceId: workspace.id, userId, role: "owner" },
  });

  return workspace.id;
}

/* ── Bir martalik tutqich ────────────────────────────────────────────────── */

/** Yangi tutqich yaratadi va DASHBOARD havolasini qaytaradi. */
export async function createClaimUrl(input: {
  userId: string;
  telegramUserId: string;
  chatId: string;
  /** Ochilgandan keyin qayerga tushsin (ilova ichidagi nisbiy yo'l). */
  next?: string;
}): Promise<string> {
  // Eski ishlatilmagan tutqichlarni bekor qilamiz — bir vaqtda faqat bittasi
  // amal qilsin.
  await prisma.telegramAccountClaim.deleteMany({
    where: { telegramUserId: input.telegramUserId, usedAt: null },
  });

  const token = randomToken(32);

  await prisma.telegramAccountClaim.create({
    data: {
      tokenHash: sha256(token),
      telegramUserId: input.telegramUserId,
      chatId: input.chatId,
      userId: input.userId,
      expiresAt: new Date(Date.now() + CLAIM_TTL_MIN * 60_000),
    },
  });

  const url = new URL("/telegram/continue", env.appUrl);
  url.searchParams.set("t", token);
  if (input.next) url.searchParams.set("next", input.next);
  return url.toString();
}

export type ClaimResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/**
 * Tutqichni ishlatadi. Muvaffaqiyatda darhol "ishlatilgan" deb belgilanadi —
 * havola ikkinchi marta ishlamaydi (takroriy hujum bo'lmasin).
 */
export async function consumeClaim(token: string): Promise<ClaimResult> {
  if (!token || token.length < 20) return { ok: false, reason: "invalid" };

  const claim = await prisma.telegramAccountClaim.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!claim) return { ok: false, reason: "invalid" };
  if (claim.usedAt) return { ok: false, reason: "used" };
  if (claim.expiresAt < new Date()) return { ok: false, reason: "expired" };

  // Shartli yangilash: ikki so'rov bir vaqtda kelsa faqat bittasi yutadi.
  const consumed = await prisma.telegramAccountClaim.updateMany({
    where: { id: claim.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumed.count === 0) return { ok: false, reason: "used" };

  return { ok: true, userId: claim.userId };
}
