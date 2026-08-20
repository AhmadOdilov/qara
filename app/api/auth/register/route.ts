import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { clientIp, fail, ok, parseBody, rateLimit } from "@/lib/api";
import { track } from "@/lib/analytics";

const schema = z.object({
  name: z.string().trim().min(2, "Ism kamida 2 belgidan iborat bo'lsin").max(80),
  email: z.email("Email manzil noto'g'ri").max(160),
  password: z
    .string()
    .min(8, "Parol kamida 8 belgidan iborat bo'lsin")
    .max(128),
  lang: z.enum(["uz", "ru", "en"]).default("uz"),
});

export async function POST(request: Request) {
  const limit = rateLimit(`register:ip:${clientIp(request)}`, 5, 60_000);
  if (!limit.allowed) {
    return fail(`Juda ko'p urinish. ${limit.retryAfter}s dan keyin urining.`, 429);
  }

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;
  const { name, email, password, lang } = parsed.data;

  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return fail("Bu email allaqachon ro'yxatdan o'tgan", 409);
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      lang,
    },
    select: { id: true, name: true, email: true, role: true, lang: true },
  });

  await createSession(user.id);
  await track("signup", user.id, { method: "password" });

  return ok({ user }, { status: 201 });
}
