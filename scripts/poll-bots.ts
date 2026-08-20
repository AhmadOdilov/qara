/**
 * Bot polling rejimi — lokal ishlab chiqish uchun.
 *
 * Ishga tushirish:  npm run bot:poll
 *
 * Telegram webhook faqat HTTPS manzilga yuboradi, lokal `http://localhost`
 * esa unga to'g'ri kelmaydi. Polling teskari tomondan ishlaydi: biz Telegram'dan
 * update'larni o'zimiz so'rab olamiz, ya'ni tunnel ochish va serverni internetga
 * chiqarish shart emas.
 *
 * Muhimi: update'lar aynan webhook o'tadigan `handleBotUpdate()` yo'lidan
 * o'tkaziladi — bot mantig'i ikkiga bo'linmaydi va prodda (webhook bilan)
 * xatti-harakat o'zgarmaydi.
 *
 * Polling va webhook birga ishlamaydi: skript ishga tushganda har bir botning
 * webhook'i olib tashlanadi. Prodga qaytishda bot sahifasidan «O'rnatish» ni
 * bosish kerak.
 */
import { prisma } from "@/lib/db";
import { readSecret } from "@/lib/bots/secrets";
import { handleBotUpdate, telegramTransport, type BotUpdate } from "@/lib/bots/runtime";
import {
  deleteWebhookForBot,
  getUpdates,
  TelegramApiError,
  type RawUpdate,
} from "@/lib/bots/telegram-api";

const POLL_TIMEOUT_SEC = 25;
const RESCAN_MS = 15_000;
const BACKOFF_MS = 3_000;

type Tracked = {
  id: string;
  name: string;
  username: string;
  token: string;
  offset: number;
};

const tracked = new Map<string, Tracked>();
let running = true;

/* ── Log ─────────────────────────────────────────────────────────────────── */

const log = (message: string) => console.log(`[poll] ${message}`);
const warn = (message: string) => console.warn(`[poll] ${message}`);

/** Uzun matnni bir qatorga sig'diradi. */
function oneLine(text: string, max = 60): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

type UpdateFrom = {
  first_name?: string;
  last_name?: string;
  username?: string;
  id?: number;
};

function describeIncoming(update: RawUpdate): string {
  const message = (update.message ?? update.edited_message) as
    | { text?: string; from?: UpdateFrom }
    | undefined;
  const callback = update.callback_query as
    | { data?: string; from?: UpdateFrom }
    | undefined;

  const from = message?.from ?? callback?.from;
  // Telegram `first_name` ni bo'sh satr qilib ham yuboradi (bu hisobda aynan
  // shunday), shuning uchun `??` emas — bo'sh qiymatlarni ham suzib tashlaymiz.
  const who =
    [from?.first_name, from?.last_name]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ") ||
    (from?.username ? `@${from.username}` : "") ||
    "anonim";
  const id = from?.id ?? "?";
  const what = message?.text
    ? oneLine(message.text, 40)
    : callback
      ? `[tugma ${callback.data ?? ""}]`
      : "[media]";

  return `${what}  ← ${who} (id ${id})`;
}

/* ── Botlarni kuzatuvga olish ────────────────────────────────────────────── */

async function rescan(): Promise<void> {
  const bots = await prisma.telegramBot.findMany({
    where: { status: { not: "disabled" } },
    select: { id: true, name: true, username: true },
  });

  // O'chirilgan yoki to'xtatilgan botlarni kuzatuvdan chiqaramiz.
  for (const id of [...tracked.keys()]) {
    if (!bots.some((bot) => bot.id === id)) {
      const gone = tracked.get(id);
      tracked.delete(id);
      log(`to'xtatildi: @${gone?.username ?? id}`);
    }
  }

  for (const bot of bots) {
    if (tracked.has(bot.id)) continue;

    const token = await readSecret(bot.id, "telegram_token");
    if (!token) {
      warn(`@${bot.username}: token topilmadi yoki ochilmadi — o'tkazib yuborildi`);
      continue;
    }

    // Webhook o'rnatilgan bo'lsa getUpdates ishlamaydi.
    await deleteWebhookForBot(token).catch(() => undefined);
    await prisma.telegramBot.update({
      where: { id: bot.id },
      data: { webhookSetAt: null, lastError: null, status: "active" },
    });

    const entry: Tracked = { ...bot, token, offset: 0 };
    tracked.set(bot.id, entry);
    log(`kuzatilmoqda: @${bot.username} (${bot.name})`);

    void pollLoop(entry);
  }
}

/* ── Bitta bot uchun tsikl ───────────────────────────────────────────────── */

async function pollLoop(bot: Tracked): Promise<void> {
  while (running && tracked.has(bot.id)) {
    try {
      const updates = await getUpdates(bot.token, bot.offset, POLL_TIMEOUT_SEC);

      for (const update of updates) {
        // Offset darhol suriladi: bitta update xato bersa ham tsikl unda
        // tiqilib qolmasin.
        bot.offset = update.update_id + 1;
        log(describeIncoming(update));

        // Javoblarni ko'rsatish uchun haqiqiy transportni o'rab olamiz.
        const base = telegramTransport(bot.token);
        await handleBotUpdate(bot.id, update as BotUpdate, {
          transport: {
            ...base,
            async send(chatId, text, opts) {
              const sent = await base.send(chatId, text, opts);
              log(`  → «${oneLine(text)}»`);
              return sent;
            },
          },
        });
      }
    } catch (error) {
      if (!running) return;

      if (error instanceof TelegramApiError) {
        // 409 — webhook qaytadan o'rnatilgan (masalan UI'dan). Olib tashlaymiz.
        if (error.status === 409) {
          warn(`@${bot.username}: webhook faol edi, olib tashlandi`);
          await deleteWebhookForBot(bot.token).catch(() => undefined);
          await prisma.telegramBot
            .update({ where: { id: bot.id }, data: { webhookSetAt: null } })
            .catch(() => undefined);
          continue;
        }
        if (error.status === 401) {
          warn(`@${bot.username}: token yaroqsiz — kuzatuvdan chiqarildi`);
          tracked.delete(bot.id);
          return;
        }
      }

      warn(`@${bot.username}: ${error instanceof Error ? error.message : error}`);
      await sleep(BACKOFF_MS);
    }
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ── Kirish nuqtasi ──────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  log("polling rejimi ishga tushdi — to'xtatish uchun Ctrl+C");

  await rescan();
  if (tracked.size === 0) {
    warn("kuzatiladigan bot topilmadi. Veb-ilovadan bot ulang: /bots");
  }

  // Yangi qo'shilgan yoki o'chirilgan botlarni vaqti-vaqti bilan tekshiramiz —
  // skriptni qayta ishga tushirish shart bo'lmasin.
  while (running) {
    await sleep(RESCAN_MS);
    if (!running) break;
    await rescan().catch((error) => warn(`ro'yxatni yangilab bo'lmadi: ${error}`));
  }
}

async function shutdown(signal: string): Promise<void> {
  if (!running) return;
  running = false;
  console.log();
  log(`${signal} — to'xtatilmoqda…`);

  // Bot endi javob bermaydi: holatni haqiqatga qaytaramiz, aks holda UI'da
  // «Ishlayapti» bo'lib qolaveradi.
  for (const bot of tracked.values()) {
    await prisma.telegramBot
      .update({ where: { id: bot.id }, data: { status: "setup_required" } })
      .catch(() => undefined);
  }

  await prisma.$disconnect().catch(() => undefined);
  log("to'xtadi");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch(async (error) => {
  console.error("[poll] ishga tushmadi:", error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
