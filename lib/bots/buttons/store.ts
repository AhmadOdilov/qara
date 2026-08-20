import "server-only";
import type { Prisma, TelegramBotButton } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/bots/audit";
import { BotServiceError } from "@/lib/bots/service";
import { cacheTree, cachedTree, invalidateTree } from "@/lib/bots/buttons/cache";
import { validateTree, type ValidationResult } from "@/lib/bots/buttons/validate";
import type { ButtonSeed } from "@/lib/bots/buttons/templates";
import {
  newCallbackId,
  typeFitsKeyboard,
  type ActionType,
  type ButtonRecord,
  type ButtonType,
  type Condition,
  type KeyboardKind,
  type Visibility,
} from "@/lib/bots/buttons/types";

/**
 * Tugmalar ombori: qoralama (jonli qatorlar) va nashr (suratlar).
 *
 * Tahrirlash har doim `telegram_bot_buttons` ustida ketadi, bot esa faqat
 * oxirgi nashr etilgan suratni o'qiydi. Shu ajratma tufayli yarim tahrirlangan
 * menyu hech qachon jonli botga tushmaydi (§41).
 */

/* ── O'girish ────────────────────────────────────────────────────────────── */

export function toRecord(row: TelegramBotButton): ButtonRecord {
  return {
    id: row.id,
    parentId: row.parentId,
    text: row.text,
    emoji: row.emoji,
    buttonType: row.buttonType as ButtonType,
    actionType: row.actionType as ActionType,
    actionConfig: (row.actionConfig ?? {}) as Record<string, unknown>,
    keyboardKind: row.keyboardKind as KeyboardKind,
    rowIndex: row.rowIndex,
    sortOrder: row.sortOrder,
    callbackId: row.callbackId,
    visibility: (row.visibility ?? {}) as Visibility,
    conditions: (row.conditions ?? []) as Condition[],
    enabled: row.enabled,
    adminOnly: row.adminOnly,
  };
}

/* ── O'qish ──────────────────────────────────────────────────────────────── */

/** Konstruktor ko'radigan holat. */
export async function loadDraft(botId: string): Promise<ButtonRecord[]> {
  const rows = await prisma.telegramBotButton.findMany({
    where: { botId },
    orderBy: [{ rowIndex: "asc" }, { sortOrder: "asc" }],
  });
  return rows.map(toRecord);
}

/**
 * Jonli bot ko'radigan holat. Hech narsa nashr etilmagan bo'lsa — bo'sh.
 *
 * Natija keshlanadi: surat faqat nashrda o'zgaradi, tugma bosilishi esa juda
 * ko'p (§15). Kesh nashr va tiklashda darhol tozalanadi.
 */
export async function loadPublished(botId: string): Promise<ButtonRecord[]> {
  const cached = cachedTree(botId);
  if (cached) return cached;

  const latest = await prisma.telegramBotButtonVersion.findFirst({
    where: { botId },
    orderBy: { version: "desc" },
    select: { tree: true },
  });

  const tree = latest ? ((latest.tree as unknown as ButtonRecord[]) ?? []) : [];
  cacheTree(botId, tree);
  return tree;
}

export async function latestVersionNumber(botId: string): Promise<number> {
  const latest = await prisma.telegramBotButtonVersion.findFirst({
    where: { botId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return latest?.version ?? 0;
}

/** Tugma bo'yicha ko'rsatilish va bosilish soni. */
export type ButtonStats = Record<string, { shown: number; clicks: number }>;

export async function buttonStats(botId: string): Promise<ButtonStats> {
  const rows = await prisma.telegramBotButtonEvent.groupBy({
    by: ["buttonId", "eventType"],
    where: { botId },
    _count: { _all: true },
  });

  const stats: ButtonStats = {};
  for (const row of rows) {
    const entry = (stats[row.buttonId] ??= { shown: 0, clicks: 0 });
    if (row.eventType === "shown") entry.shown += row._count._all;
    if (row.eventType === "click") entry.clicks += row._count._all;
  }
  return stats;
}

/**
 * Konstruktor bir marta ko'radigan to'liq holat.
 *
 * Sahifa (server) va `GET /buttons` (mutatsiyadan keyingi yangilanish) aynan
 * shu funksiyani chaqiradi — shuning uchun ikkalasi hech qachon ajralmaydi.
 */
export async function loadBuilderState(botId: string) {
  const [buttons, diff, publishedVersion, stats] = await Promise.all([
    loadDraft(botId),
    diffAgainstPublished(botId),
    latestVersionNumber(botId),
    buttonStats(botId),
  ]);
  // Tekshiruv qoralama ustida: foydalanuvchi xatoni «Nashr etish» tugmasini
  // bosmasdan, tugmani tahrirlagan zahoti ko'radi (§12).
  return { buttons, diff, publishedVersion, stats, validation: validateTree(buttons) };
}

/* ── Nashrga tayyorlik ───────────────────────────────────────────────────── */

export type PublishDiff = {
  added: number;
  updated: number;
  removed: number;
  hasChanges: boolean;
};

/**
 * Qoralama bilan nashr orasidagi farq — «Publish» oynasida ko'rsatiladi.
 *
 * Taqqoslash tugma mazmuni bo'yicha: faqat joyi o'zgargan tugma ham
 * «o'zgargan» hisoblanadi, chunki bu Telegram klaviaturasini o'zgartiradi.
 */
export async function diffAgainstPublished(botId: string): Promise<PublishDiff> {
  const [draft, published] = await Promise.all([
    loadDraft(botId),
    loadPublished(botId),
  ]);

  const publishedById = new Map(published.map((b) => [b.id, b]));
  let added = 0;
  let updated = 0;

  for (const button of draft) {
    const before = publishedById.get(button.id);
    if (!before) {
      added += 1;
      continue;
    }
    if (fingerprint(before) !== fingerprint(button)) updated += 1;
    publishedById.delete(button.id);
  }

  const removed = publishedById.size;
  return { added, updated, removed, hasChanges: added + updated + removed > 0 };
}

/**
 * Taqqoslash uchun barqaror shakl.
 *
 * Nashr surati Postgres `jsonb` ustunida yotadi, u esa kalitlar tartibini o'zi
 * qayta tuzadi. Shu sababli suratni `JSON.stringify` bilan solishtirib
 * bo'lmaydi — mazmuni bir xil tugma ham «o'zgargan» bo'lib ko'rinardi va
 * «o'zgarish yo'q» holati hech qachon yuzaga kelmasdi.
 */
function fingerprint(button: ButtonRecord): string {
  return stableJson([
    button.parentId,
    button.text,
    button.emoji,
    button.buttonType,
    button.actionType,
    button.actionConfig,
    button.keyboardKind,
    button.rowIndex,
    button.sortOrder,
    button.callbackId,
    button.visibility,
    button.conditions,
    button.enabled,
    button.adminOnly,
  ]);
}

/** Kalitlari tartiblangan JSON — ichma-ich obyektlar uchun ham. */
function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",")}}`;
}

/* ── Nashr etish ─────────────────────────────────────────────────────────── */

/** Nashr yaroqsiz daraxt bilan to'xtatilganda — sabablar bilan. */
export class ButtonValidationError extends BotServiceError {
  constructor(readonly validation: ValidationResult) {
    super("Menyu daraxtida xato bor — nashr to'xtatildi", 422);
    this.name = "ButtonValidationError";
  }
}

export async function publishButtons(
  botId: string,
  actorId: string,
): Promise<{ version: number; diff: PublishDiff; validation: ValidationResult }> {
  const [draft, diff, previous] = await Promise.all([
    loadDraft(botId),
    diffAgainstPublished(botId),
    latestVersionNumber(botId),
  ]);

  // Yaroqsiz daraxt jonli botga chiqmaydi: Telegram uni rad etsa foydalanuvchi
  // buzilgan klaviatura bilan qolib ketardi (§12).
  const validation = validateTree(draft);
  if (!validation.ok) throw new ButtonValidationError(validation);

  const version = previous + 1;

  await prisma.telegramBotButtonVersion.create({
    data: {
      botId,
      version,
      tree: draft as unknown as Prisma.InputJsonValue,
      summary: diff as unknown as Prisma.InputJsonValue,
      publishedById: actorId,
    },
  });

  // Jonli bot yangi suratni darhol ko'rishi kerak.
  invalidateTree(botId);

  await audit("BUTTONS_UPDATED", {
    botId,
    actorId,
    metadata: { version, ...diff },
  });

  return { version, diff, validation };
}

export async function listVersions(botId: string) {
  return prisma.telegramBotButtonVersion.findMany({
    where: { botId },
    orderBy: { version: "desc" },
    take: 20,
    select: { id: true, version: true, summary: true, publishedAt: true },
  });
}

/**
 * Versiyani tiklash: surat qoralamaga qaytariladi.
 *
 * Nashr avtomatik qilinmaydi — foydalanuvchi avval ko'rib chiqib, so'ng
 * «Publish» bosadi. Shu tariqa tiklash ham xuddi oddiy tahrir kabi ishlaydi.
 */
export async function restoreVersion(
  botId: string,
  versionId: string,
  actorId: string,
): Promise<number> {
  const snapshot = await prisma.telegramBotButtonVersion.findFirst({
    where: { id: versionId, botId },
    select: { version: true, tree: true },
  });
  if (!snapshot) throw new BotServiceError("Versiya topilmadi", 404);

  const buttons = (snapshot.tree as unknown as ButtonRecord[]) ?? [];

  await prisma.$transaction([
    prisma.telegramBotButton.deleteMany({ where: { botId } }),
    // Ota-bola bog'lanishi buzilmasin: avval ildizlar, keyin bolalar.
    ...orderByDepth(buttons).map((button) =>
      prisma.telegramBotButton.create({
        data: {
          id: button.id,
          botId,
          parentId: button.parentId,
          text: button.text,
          emoji: button.emoji,
          buttonType: button.buttonType,
          actionType: button.actionType,
          actionConfig: button.actionConfig as Prisma.InputJsonValue,
          keyboardKind: button.keyboardKind,
          rowIndex: button.rowIndex,
          sortOrder: button.sortOrder,
          callbackId: button.callbackId,
          visibility: button.visibility as Prisma.InputJsonValue,
          conditions: button.conditions as Prisma.InputJsonValue,
          enabled: button.enabled,
          adminOnly: button.adminOnly,
        },
      }),
    ),
  ]);

  await audit("BUTTONS_UPDATED", {
    botId,
    actorId,
    metadata: { restoredFrom: snapshot.version },
  });

  return snapshot.version;
}

/* ── Shablondan qo'shish ─────────────────────────────────────────────────── */

/**
 * Shablon urug'larini qoralamaga qo'shadi va nechta tugma yaratilganini
 * qaytaradi.
 *
 * Qo'shish — almashtirish emas: mavjud tugmalar joyida qoladi, yangilari
 * ularning ostidagi qatorlardan boshlanadi. Shu sababli shablonni bir necha
 * marta qo'llash ham hech narsani yo'qotmaydi.
 */
export async function insertSeeds(
  botId: string,
  seeds: ButtonSeed[],
  parentId: string | null = null,
  /**
   * Ildizdagi klaviatura turi.
   *
   * Shablon inline bo'lsa hamma ildiz tugmasi ham inline bo'lishi kerak:
   * Telegram bitta xabarda ikki xil klaviaturani ko'rsatmaydi va aralash
   * ildiz nashrda ogohlantirishga tushardi.
   */
  kind: KeyboardKind = "reply",
): Promise<number> {
  const last = await prisma.telegramBotButton.aggregate({
    where: { botId, parentId },
    _max: { rowIndex: true },
  });
  const startRow = last._max.rowIndex === null ? 0 : last._max.rowIndex + 1;
  return createSeeds(botId, seeds, parentId, startRow, kind);
}

async function createSeeds(
  botId: string,
  seeds: ButtonSeed[],
  parentId: string | null,
  startRow: number,
  inherited: KeyboardKind,
): Promise<number> {
  let created = 0;

  for (const [index, seed] of seeds.entries()) {
    // Urug' o'zi qator raqamini bermasa — har biri o'z qatoriga tushadi va
    // foydalanuvchi keyin konstruktorda ularni bitta qatorga yig'ib oladi.
    // `row` berilgan bo'lsa shablon juftlashtirishni o'zi hal qiladi.
    //
    // Klaviatura turi ichki menyularga meros bo'lib o'tadi: inline shablon
    // ichida reply tugmasi paydo bo'lsa, Telegram menyuni aralashtira olmay
    // yarmini tashlab ketardi.
    const keyboardKind = seed.keyboardKind ?? inherited;
    const button = await prisma.telegramBotButton.create({
      data: {
        botId,
        parentId,
        text: seed.text.slice(0, 64),
        emoji: seed.emoji ?? null,
        keyboardKind,
        buttonType: seedType(seed, keyboardKind),
        actionType: seed.actionType,
        actionConfig: (seed.config ?? {}) as Prisma.InputJsonValue,
        rowIndex: startRow + (seed.row ?? index),
        sortOrder: index,
        callbackId: newCallbackId(),
      },
    });
    created += 1;

    if (seed.children?.length) {
      created += await createSeeds(botId, seed.children, button.id, 0, keyboardKind);
    }
  }

  return created;
}

/**
 * Urug'dagi tur tanlangan klaviaturaga to'g'ri kelmasa — mos turga tushiriladi.
 *
 * Masalan reply klaviaturada `url` tugmasi bo'lmaydi; u oddiy matn tugmasiga
 * aylanadi, amali esa o'zgarmaydi — `open_url` havolani matn sifatida yuboradi.
 */
function seedType(seed: ButtonSeed, kind: KeyboardKind): ButtonType {
  const declared =
    seed.buttonType ?? (seed.actionType === "submenu" ? "submenu" : "text");
  if (typeFitsKeyboard(declared, kind)) return declared;
  return kind === "reply" ? "text" : "callback";
}

/** Ota tugma bolasidan oldin yaratilishi uchun daraxtni chuqurlik bo'yicha tartiblaydi. */
function orderByDepth(buttons: ButtonRecord[]): ButtonRecord[] {
  const byId = new Map(buttons.map((b) => [b.id, b]));
  const depth = (button: ButtonRecord, guard = 0): number => {
    if (!button.parentId || guard > 20) return 0;
    const parent = byId.get(button.parentId);
    return parent ? depth(parent, guard + 1) + 1 : 0;
  };
  return [...buttons].sort((a, b) => depth(a) - depth(b));
}
