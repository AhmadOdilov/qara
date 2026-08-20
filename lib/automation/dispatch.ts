import "server-only";
import { prisma } from "@/lib/db";
import { assertSafeUrl, SsrfError } from "@/lib/mini-app/ssrf";
import { recordEvent } from "@/lib/bots/audit";
import type { BotTransport } from "@/lib/bots/transport";
import {
  executeAutomation,
  type ActionRunner,
  type AutomationDefinition,
} from "@/lib/automation/engine";
import type { EventContext } from "@/lib/automation/conditions";
import {
  actionSchema,
  conditionSchema,
  isLiveTrigger,
  LIMITS,
  type Action,
  type LiveTrigger,
} from "@/lib/automation/types";

/**
 * Hodisadan avtomatgacha (§P4 PHASE 6–8, 11–14).
 *
 * Runtime bu modulni chaqiradi, u esa:
 *   1. shu bot va shu trigger uchun NASHR ETILGAN avtomatlarni topadi,
 *   2. har birini idempotentlik kaliti bilan «band qiladi»,
 *   3. dvigatelda bajaradi va natijani yozib qo'yadi.
 *
 * Butun oqim best-effort: avtomat yiqilsa ham botning asosiy javobi
 * to'xtamaydi — shuning uchun `dispatch()` hech qachon xato tashlamaydi.
 */

export type DispatchInput = {
  botId: string;
  trigger: LiveTrigger;
  /** Hodisani takrorlanmas qiladigan qiymat (update id, buyurtma kodi, …). */
  dedupeKey: string;
  context: EventContext;
  transport?: BotTransport;
  /** Xabar yuboriladigan chat. Yo'q bo'lsa `send_message` o'tkazib yuboriladi. */
  chatId?: string;
  botUserId?: string;
};

export async function dispatch(input: DispatchInput): Promise<void> {
  try {
    if (!isLiveTrigger(input.trigger)) return;

    const rows = await prisma.telegramBotAutomation.findMany({
      where: {
        botId: input.botId,
        trigger: input.trigger,
        // FAQAT nashr etilgan. Qoralama va o'chirilgani runtime'da ishlamaydi.
        status: "published",
      },
      orderBy: { createdAt: "asc" },
      take: LIMITS.maxAutomationsPerEvent,
      select: {
        id: true,
        name: true,
        trigger: true,
        conditions: true,
        actions: true,
      },
    });

    for (const row of rows) {
      await runOne(row, input);
    }
  } catch (error) {
    // Avtomatlashtirish botning asosiy ishini yiqitmasligi kerak.
    await recordEvent(input.botId, "error", "automation_dispatch_failed", {
      ok: false,
      detail: { reason: error instanceof Error ? error.message : "noma'lum" },
    }).catch(() => undefined);
  }
}

async function runOne(
  row: {
    id: string;
    name: string;
    trigger: string;
    conditions: unknown;
    actions: unknown;
  },
  input: DispatchInput,
): Promise<void> {
  const definition = parseDefinition(row);
  if (!definition) return;

  // Idempotentlik: `(automationId, dedupeKey)` unikal. Ikkinchi nusxa shu
  // yerda to'xtaydi — `claimUpdate()` bilan bir xil naqsh.
  let runId: string;
  try {
    const created = await prisma.telegramBotAutomationRun.create({
      data: {
        automationId: row.id,
        botId: input.botId,
        triggerEvent: input.trigger,
        dedupeKey: input.dedupeKey,
        status: "running",
      },
      select: { id: true },
    });
    runId = created.id;
  } catch (error) {
    // Allaqachon bajarilgan — bu kutilgan holat, xato emas.
    if (isUniqueViolation(error)) return;
    throw error;
  }

  const startedAt = Date.now();
  const outcome = await executeAutomation(
    definition,
    input.context,
    actionRunner(input),
    { loadAutomation: (id) => loadPublished(input.botId, id) },
  );
  const durationMs = Date.now() - startedAt;

  await prisma.telegramBotAutomationRun
    .update({
      where: { id: runId },
      data: {
        status: outcome.status === "skipped" ? "skipped" : outcome.status,
        actionsRun: outcome.actionsRun,
        depth: outcome.depth,
        failedAction: outcome.failedAction ?? null,
        // Sikl/chegara sababi ham xato matniga qo'shiladi.
        error: outcome.error ?? outcome.haltReason ?? null,
        finishedAt: new Date(),
        durationMs,
      },
    })
    .catch(() => undefined);

  if (outcome.status === "completed") {
    await prisma.telegramBotAutomation
      .update({
        where: { id: row.id },
        data: { lastRunAt: new Date(), runCount: { increment: 1 } },
      })
      .catch(() => undefined);
  }

  // Mavjud hodisa jurnaliga yozamiz — parallel analitika tizimi qurilmaydi.
  await recordEvent(
    input.botId,
    outcome.status === "failed" ? "error" : "tool_call",
    `automation_${outcome.status}`,
    {
      ok: outcome.status !== "failed",
      latencyMs: durationMs,
      detail: {
        automationId: row.id,
        trigger: input.trigger,
        actionsRun: outcome.actionsRun,
        ...(outcome.failedAction ? { failedAction: outcome.failedAction } : {}),
        ...(outcome.haltReason ? { haltReason: outcome.haltReason } : {}),
      },
    },
  ).catch(() => undefined);
}

/** Nashr etilgan avtomatni id bo'yicha oladi — `start_automation` uchun. */
async function loadPublished(
  botId: string,
  automationId: string,
): Promise<AutomationDefinition | null> {
  // `botId` shart: boshqa botning (va shu bilan boshqa ish maydonining)
  // avtomatini chaqirib bo'lmaydi.
  const row = await prisma.telegramBotAutomation.findFirst({
    where: { id: automationId, botId, status: "published" },
    select: { id: true, name: true, trigger: true, conditions: true, actions: true },
  });
  return row ? parseDefinition(row) : null;
}

/**
 * Bazadagi JSON'ni tekshirib, ishonchli shaklga keltiradi.
 *
 * Noto'g'ri yozuv jimgina o'tkazib yuboriladi: yarim tushunilgan
 * konfiguratsiya bo'yicha amal bajarishdan ko'ra hech narsa qilmagan
 * yaxshiroq.
 */
function parseDefinition(row: {
  id: string;
  name: string;
  trigger: string;
  conditions: unknown;
  actions: unknown;
}): AutomationDefinition | null {
  const conditions = conditionSchema.safeParse(row.conditions ?? {});
  const actions = actionSchema.array().safeParse(row.actions ?? []);
  if (!conditions.success || !actions.success || actions.data.length === 0) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    trigger: row.trigger,
    conditions: conditions.data,
    actions: actions.data,
  };
}

/* ── Amallarni bajarish ──────────────────────────────────────────────────── */

function actionRunner(input: DispatchInput): ActionRunner {
  return async (action: Action) => {
    switch (action.type) {
      case "send_message": {
        // Transport yoki chat yo'q bo'lsa jim o'tkazamiz: bu hodisa
        // kontekstida yuboradigan joy yo'q.
        if (!input.transport || !input.chatId) return;
        await input.transport.send(input.chatId, action.text, {});
        return;
      }

      case "notify_admin": {
        // Admin — `admin` tegi qo'yilgan bot foydalanuvchilari.
        if (!input.transport) return;
        const admins = await prisma.telegramBotUser.findMany({
          where: { botId: input.botId, tags: { has: "admin" }, blocked: false },
          select: { chatId: true },
          take: 10,
        });
        for (const admin of admins) {
          await input.transport.send(admin.chatId, action.text, {}).catch(() => undefined);
        }
        return;
      }

      case "add_tag":
      case "remove_tag": {
        if (!input.botUserId) return;
        const user = await prisma.telegramBotUser.findUnique({
          where: { id: input.botUserId },
          select: { tags: true },
        });
        if (!user) return;

        const tag = action.tag.trim();
        const next =
          action.type === "add_tag"
            ? Array.from(new Set([...user.tags, tag]))
            : user.tags.filter((item) => item !== tag);

        await prisma.telegramBotUser.update({
          where: { id: input.botUserId },
          data: { tags: next },
        });
        return;
      }

      case "call_webhook": {
        // Mavjud SSRF himoyasi — localhost, xususiy tarmoq va bulut
        // metadata manzillari bloklanadi.
        let url: URL;
        try {
          url = assertSafeUrl(action.url);
        } catch (error) {
          throw new Error(
            error instanceof SsrfError ? error.message : "Manzil xavfsiz emas",
          );
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5_000);
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: action.body ?? JSON.stringify({ event: input.trigger }),
            signal: controller.signal,
            redirect: "manual",
          });
          if (!response.ok) {
            throw new Error(`Webhook ${response.status} qaytardi`);
          }
        } finally {
          clearTimeout(timer);
        }
        return;
      }

      // `start_automation` va `stop` dvigatelda hal qilinadi.
      case "start_automation":
      case "stop":
        return;
    }
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
