import { prisma } from "@/lib/db";
import { fail, guard, ok } from "@/lib/api";
import { randomToken } from "@/lib/auth";
import { deepLink } from "@/lib/telegram";
import { telegramMockMode } from "@/lib/env";
import { handleUpdate } from "@/lib/bot-handler";
import { track } from "@/lib/analytics";

const LINK_TTL_MIN = 15;

/** Joriy bog'lanish holati va (bog'lanmagan bo'lsa) yangi deep link. */
export async function GET(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;

  const link = await prisma.telegramLink.findUnique({
    where: { userId: auth.user.id },
  });

  if (link?.connectedAt) {
    return ok({
      linked: true,
      mockMode: telegramMockMode,
      telegram: {
        username: link.username,
        firstName: link.firstName,
        chatId: link.telegramChatId,
        connectedAt: link.connectedAt,
      },
    });
  }

  return ok({ linked: false, mockMode: telegramMockMode });
}

/** Yangi (yoki muddati yangilangan) deep link yaratadi. */
export async function POST(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;

  const existing = await prisma.telegramLink.findUnique({
    where: { userId: auth.user.id },
  });
  if (existing?.connectedAt) {
    return fail("Telegram allaqachon bog'langan", 409);
  }

  const token = randomToken(24);
  const expiresAt = new Date(Date.now() + LINK_TTL_MIN * 60_000);

  await prisma.telegramLink.upsert({
    where: { userId: auth.user.id },
    update: { linkToken: token, linkTokenExp: expiresAt },
    create: {
      userId: auth.user.id,
      linkToken: token,
      linkTokenExp: expiresAt,
    },
  });

  return ok({
    url: deepLink(token),
    token,
    expiresAt,
    mockMode: telegramMockMode,
  });
}

/** Bog'lanishni uzish. Xabarlar tarixi saqlanib qoladi. */
export async function DELETE(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;

  await prisma.telegramLink
    .delete({ where: { userId: auth.user.id } })
    .catch(() => undefined);
  await track("telegram_unlinked", auth.user.id, { via: "web" });

  return ok({ ok: true });
}

/**
 * MOCK rejim uchun: Telegram tomonini simulyatsiya qilib /start yuboradi.
 * Token bo'lmaganda ham bog'lash oqimini to'liq sinash imkonini beradi.
 */
export async function PUT(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;
  if (!telegramMockMode) {
    return fail("Bu amal faqat MOCK rejimda mavjud", 400);
  }

  const link = await prisma.telegramLink.findUnique({
    where: { userId: auth.user.id },
  });
  if (!link) return fail("Avval bog'lash havolasini yarating", 400);
  if (link.connectedAt) return fail("Telegram allaqachon bog'langan", 409);

  // Har bir foydalanuvchi uchun barqaror soxta chat id.
  const fakeChatId = 900_000_000 + Math.abs(hash(auth.user.id)) % 99_999_999;

  await handleUpdate({
    update_id: Date.now(),
    message: {
      message_id: Date.now() % 100000,
      date: Math.floor(Date.now() / 1000),
      text: `/start ${link.linkToken}`,
      chat: { id: fakeChatId, type: "private" },
      from: {
        id: fakeChatId,
        is_bot: false,
        first_name: auth.user.name.split(" ")[0],
        username: `${auth.user.email.split("@")[0]}_mock`,
        language_code: auth.user.lang,
      },
    },
  });

  return ok({ ok: true, chatId: String(fakeChatId) });
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return h;
}
