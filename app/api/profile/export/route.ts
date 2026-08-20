import { prisma } from "@/lib/db";
import { guard } from "@/lib/api";

/**
 * GDPR (Art. 20) va O'zbekiston ZRU-547 talab qiladigan ma'lumot eksporti:
 * foydalanuvchining barcha yozuvlari bitta JSON faylda.
 */
export async function GET(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      lang: true,
      avatarUrl: true,
      notifyTelegram: true,
      notifyEmail: true,
      quietHours: true,
      createdAt: true,
      telegramLink: {
        select: {
          telegramUserId: true,
          telegramChatId: true,
          username: true,
          firstName: true,
          languageCode: true,
          connectedAt: true,
        },
      },
      messages: {
        orderBy: { timestamp: "asc" },
        select: {
          direction: true,
          fromUser: true,
          content: true,
          kind: true,
          status: true,
          timestamp: true,
        },
      },
      sessions: {
        select: { userAgent: true, ip: true, createdAt: true, expiresAt: true },
      },
      analytics: {
        orderBy: { recordedAt: "asc" },
        select: { event: true, value: true, meta: true, recordedAt: true },
      },
    },
  });

  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), data: user },
    null,
    2,
  );

  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="qara-export-${Date.now()}.json"`,
      "cache-control": "no-store",
    },
  });
}
