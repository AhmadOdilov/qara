import "server-only";
import type { BotSecretType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { encryptSecret, maskSecret, tryDecryptSecret } from "@/lib/crypto";

/**
 * Bot sirlari bilan ishlashning yagona nuqtasi.
 *
 * Qoida: ochiq matn sir faqat shu modul orqali o'qiladi va faqat server
 * tomonda ishlatiladi. API javoblariga hech qachon `readSecret` natijasi
 * qaytarilmaydi — o'rniga `describeSecret` beradigan maska ishlatiladi.
 */

export async function writeSecret(
  botId: string,
  secretType: BotSecretType,
  plain: string,
  scope = "default",
): Promise<void> {
  const encryptedValue = encryptSecret(plain);
  const maskedHint = maskSecret(plain);

  await prisma.telegramBotSecret.upsert({
    where: { botId_secretType_scope: { botId, secretType, scope } },
    update: { encryptedValue, maskedHint },
    create: { botId, secretType, scope, encryptedValue, maskedHint },
  });
}

export async function readSecret(
  botId: string,
  secretType: BotSecretType,
  scope = "default",
): Promise<string | null> {
  const row = await prisma.telegramBotSecret.findUnique({
    where: { botId_secretType_scope: { botId, secretType, scope } },
    select: { encryptedValue: true },
  });
  return tryDecryptSecret(row?.encryptedValue);
}

export async function deleteSecret(
  botId: string,
  secretType: BotSecretType,
  scope = "default",
): Promise<void> {
  await prisma.telegramBotSecret
    .delete({ where: { botId_secretType_scope: { botId, secretType, scope } } })
    .catch(() => undefined);
}

/** UI uchun xavfsiz ko'rinish: sir bor-yo'qligi va maskasi. */
export async function describeSecret(
  botId: string,
  secretType: BotSecretType,
  scope = "default",
): Promise<{ hasValue: boolean; hint: string | null }> {
  const row = await prisma.telegramBotSecret.findUnique({
    where: { botId_secretType_scope: { botId, secretType, scope } },
    select: { maskedHint: true },
  });
  return { hasValue: Boolean(row), hint: row?.maskedHint ?? null };
}

export async function describeSecrets(
  botId: string,
): Promise<Record<string, { hasValue: boolean; hint: string | null }>> {
  const rows = await prisma.telegramBotSecret.findMany({
    where: { botId },
    select: { secretType: true, scope: true, maskedHint: true },
  });
  const result: Record<string, { hasValue: boolean; hint: string | null }> = {};
  for (const row of rows) {
    const key = row.scope === "default" ? row.secretType : `${row.secretType}:${row.scope}`;
    result[key] = { hasValue: true, hint: row.maskedHint };
  }
  return result;
}
