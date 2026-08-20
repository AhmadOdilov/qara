import "server-only";
import { randomBytes, createHash } from "node:crypto";
import type { ApiKey } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * API kalitlari (§8).
 *
 * Qoida: ochiq matn kalit hech qachon bazaga yozilmaydi va hech qachon
 * ro'yxatda qaytarilmaydi. Bazada faqat SHA-256 xesh turadi — baza sizib
 * chiqsa ham kalitlar tiklanmaydi. To'liq qiymat chaqiruvchiga faqat bir
 * marta, `createApiKey` natijasida beriladi.
 *
 * Nega bcrypt emas, SHA-256? Parol emas: kalit 32 baytlik tasodifiy qiymat,
 * lug'at hujumi ma'nosiz. Bunda qidiruv xesh bo'yicha indeks orqali bitta
 * so'rovda ketadi — bcrypt bo'lsa har bir yozuvni navbatma-navbat tekshirish
 * kerak bo'lardi.
 */

export const API_KEY_PREFIX = "qara_sk";

/** Ro'yxatda ko'rsatiladigan shakl. Sir emas: xeshni ochishga yaramaydi. */
export function maskApiKey(prefix: string, lastFour: string): string {
  return `${prefix}_${"•".repeat(6)}${lastFour}`;
}

/** Kalit shu ilova bergan formatga o'xshaydimi — bazaga bormasdan tekshiruv. */
export function looksLikeApiKey(value: string): boolean {
  return new RegExp(`^${API_KEY_PREFIX}_[A-Za-z0-9_-]{32,}$`).test(value.trim());
}

export type ApiKeyView = {
  id: string;
  name: string;
  /** `qara_sk_••••••1a2b` — tanib olish uchun, sir emas. */
  masked: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  createdByName: string | null;
};

export class ApiKeyError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ApiKeyError";
  }
}

export function hashApiKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

function view(
  row: ApiKey & { createdBy?: { name: string } | null },
): ApiKeyView {
  return {
    id: row.id,
    name: row.name,
    masked: maskApiKey(row.prefix, row.lastFour),
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    createdByName: row.createdBy?.name ?? null,
  };
}

export async function listApiKeys(workspaceId: string): Promise<ApiKeyView[]> {
  const rows = await prisma.apiKey.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  return rows.map(view);
}

/**
 * Yangi kalit. Natijadagi `plain` — chaqiruvchi uni foydalanuvchiga bir marta
 * ko'rsatadi va tashlab yuboradi; qayta olish imkoni yo'q.
 */
export async function createApiKey(opts: {
  workspaceId: string;
  actorId: string;
  name: string;
}): Promise<{ key: ApiKeyView; plain: string }> {
  const count = await prisma.apiKey.count({
    where: { workspaceId: opts.workspaceId, revokedAt: null },
  });
  // Cheklov tasodifiy emas: kalit ko'paygani sari uni kuzatib borish qiyinlashadi.
  if (count >= 25) {
    throw new ApiKeyError(
      "Faol kalitlar chegarasi (25 ta) to'ldi. Ishlatilmayotganini bekor qiling.",
      409,
    );
  }

  const plain = `${API_KEY_PREFIX}_${randomBytes(24).toString("base64url")}`;

  const row = await prisma.apiKey.create({
    data: {
      workspaceId: opts.workspaceId,
      createdById: opts.actorId,
      name: opts.name,
      keyHash: hashApiKey(plain),
      prefix: API_KEY_PREFIX,
      lastFour: plain.slice(-4),
    },
    include: { createdBy: { select: { name: true } } },
  });

  return { key: view(row), plain };
}

/** Nomni o'zgartirish — kalitning o'zi o'zgarmaydi. */
export async function renameApiKey(
  keyId: string,
  workspaceId: string,
  name: string,
): Promise<ApiKeyView> {
  const existing = await prisma.apiKey.findFirst({
    where: { id: keyId, workspaceId },
    select: { id: true },
  });
  if (!existing) throw new ApiKeyError("Kalit topilmadi", 404);

  const row = await prisma.apiKey.update({
    where: { id: keyId },
    data: { name },
    include: { createdBy: { select: { name: true } } },
  });
  return view(row);
}

/**
 * Bekor qilish: yozuv qoladi (audit uchun) va darhol ishlamay qoladi.
 * Qayta yoqib bo'lmaydi — bu ataylab, chunki bekor qilingan kalit allaqachon
 * oshkor bo'lgan deb hisoblanadi.
 */
export async function revokeApiKey(
  keyId: string,
  workspaceId: string,
): Promise<ApiKeyView> {
  const existing = await prisma.apiKey.findFirst({
    where: { id: keyId, workspaceId },
    select: { id: true, revokedAt: true },
  });
  if (!existing) throw new ApiKeyError("Kalit topilmadi", 404);
  if (existing.revokedAt) throw new ApiKeyError("Kalit allaqachon bekor qilingan", 409);

  const row = await prisma.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
    include: { createdBy: { select: { name: true } } },
  });
  return view(row);
}

/** Butunlay o'chirish — ro'yxatni tozalash uchun. */
export async function deleteApiKey(
  keyId: string,
  workspaceId: string,
): Promise<void> {
  const existing = await prisma.apiKey.findFirst({
    where: { id: keyId, workspaceId },
    select: { id: true },
  });
  if (!existing) throw new ApiKeyError("Kalit topilmadi", 404);
  await prisma.apiKey.delete({ where: { id: keyId } });
}

/**
 * Kelgan kalitni tekshiradi. Topilmasa yoki bekor qilingan bo'lsa `null`.
 * Muvaffaqiyatda `lastUsedAt` yangilanadi (kutmasdan — javobni sekinlashtirmasin).
 */
export async function verifyApiKey(
  presented: string,
): Promise<{ workspaceId: string; keyId: string } | null> {
  const trimmed = presented.trim();
  // Formatga to'g'ri kelmasa bazaga umuman bormaymiz.
  if (!looksLikeApiKey(trimmed)) return null;

  const row = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(trimmed) },
    select: { id: true, workspaceId: true, revokedAt: true },
  });
  if (!row || row.revokedAt) return null;

  void prisma.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { workspaceId: row.workspaceId, keyId: row.id };
}
