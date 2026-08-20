import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, guard, ok, parseBody, rateLimit, sanitizeText } from "@/lib/api";
import { sendMessage } from "@/lib/telegram";
import { track } from "@/lib/analytics";
import { log } from "@/lib/log";

const sendSchema = z.object({
  content: z.string().trim().min(1, "Xabar bo'sh").max(4096),
  /** disable_notification — tinch bildirishnoma */
  silent: z.boolean().optional(),
});

/**
 * Chat tarixi. `after` berilsa o'sha vaqtdan boshlab qaytadi — klient shu
 * bilan yangi xabarlarni arzon polling qiladi.
 *
 * Chegara ataylab `gte`: Telegram `date` maydonini sekund aniqligida beradi,
 * shuning uchun bir necha xabar bir xil timestamp'ga tushishi mumkin. `gt`
 * ularning bir qismini butunlay o'tkazib yuborardi; `gte` esa oxirgi xabarni
 * qayta qaytaradi va klient uni id bo'yicha filtrlaydi.
 *
 * Ikkilamchi `id` saralashi ham shu sabab: teng timestamp'da tartib barqaror
 * bo'lsin (cuid vaqt bo'yicha o'sadi).
 */
export async function GET(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);

  const direction = after ? "asc" : "desc";
  const messages = await prisma.message.findMany({
    where: {
      userId: auth.user.id,
      ...(after ? { timestamp: { gte: new Date(after) } } : {}),
    },
    orderBy: [{ timestamp: direction }, { id: direction }],
    take: limit,
    select: {
      id: true,
      direction: true,
      fromUser: true,
      content: true,
      kind: true,
      status: true,
      error: true,
      timestamp: true,
    },
  });

  return ok({ messages: after ? messages : messages.reverse() });
}

/** Vebdan Telegramga xabar yuborish. */
export async function POST(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;

  const limit = rateLimit(`send:${auth.user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return fail(
      `Juda tez yuboryapsiz. ${limit.retryAfter}s dan keyin urining.`,
      429,
    );
  }

  const parsed = await parseBody(request, sendSchema);
  if ("response" in parsed) return parsed.response;

  const link = await prisma.telegramLink.findUnique({
    where: { userId: auth.user.id },
  });
  if (!link?.telegramChatId || !link.connectedAt) {
    return fail("Avval Telegramni bog'lang", 409);
  }

  const content = sanitizeText(parsed.data.content);
  if (!content) return fail("Xabar bo'sh", 422);

  // Avval "pending" holatida yozamiz — Telegram javob bermay qolsa ham
  // xabar tarixdan yo'qolmaydi va holati ko'rinib turadi.
  const message = await prisma.message.create({
    data: {
      userId: auth.user.id,
      telegramUserId: link.telegramUserId,
      direction: "outgoing",
      fromUser: true,
      content,
      kind: "text",
      status: "pending",
    },
  });

  try {
    const sent = await sendMessage(link.telegramChatId, content, {
      silent: parsed.data.silent ?? auth.user.quietHours,
    });
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { status: "sent", telegramMsgId: sent.message_id },
      select: {
        id: true,
        direction: true,
        fromUser: true,
        content: true,
        kind: true,
        status: true,
        error: true,
        timestamp: true,
      },
    });
    await track("message_sent", auth.user.id, { kind: "text" });
    return ok({ message: updated }, { status: 201 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Noma'lum xato";
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { status: "failed", error: reason.slice(0, 500) },
      select: {
        id: true,
        direction: true,
        fromUser: true,
        content: true,
        kind: true,
        status: true,
        error: true,
        timestamp: true,
      },
    });
    log.error("messages: Telegramga yuborilmadi", {
      reason: error instanceof Error ? error.message : "noma'lum",
    });
    return ok({ message: updated, warning: reason }, { status: 502 });
  }
}
