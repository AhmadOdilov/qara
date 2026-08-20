import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { clientIp, fail, ok, parseBody, rateLimit } from "@/lib/api";
import { track } from "@/lib/analytics";

const schema = z.object({
  email: z.email("Email manzil noto'g'ri").max(160),
  password: z.string().min(1, "Parolni kiriting").max(128),
});

/**
 * Haqiqiy, lekin hech kimga tegishli bo'lmagan bcrypt hash. Foydalanuvchi
 * topilmaganda ham shu bilan solishtiramiz — javob vaqti bir xil bo'lib,
 * email bazada bor-yo'qligini vaqt bo'yicha aniqlab bo'lmaydi.
 */
const DUMMY_HASH =
  "$2b$12$qBVt7R4zIiO/YMalwUQcueIWcBOyl4F93gDLODeCJYB7gBwCtsDD2";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limit = rateLimit(`login:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return fail(`Juda ko'p urinish. ${limit.retryAfter}s dan keyin urining.`, 429);
  }

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  const validPassword = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_HASH,
  );

  if (!user || !user.passwordHash || !validPassword) {
    // Hisob faqat Google orqali yaratilgan bo'lsa passwordHash bo'lmaydi —
    // bunda ham xabar bir xil, hisob turini oshkor qilmaymiz.
    return fail("Email yoki parol noto'g'ri", 401);
  }

  await createSession(user.id);
  await track("login", user.id, { method: "password" });

  return ok({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      lang: user.lang,
    },
  });
}
