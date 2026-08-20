import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, guard, ok, parseBody } from "@/lib/api";

const schema = z.object({
  userId: z.string().min(1),
  role: z.enum(["user", "admin"]),
});

/** Foydalanuvchi rolini o'zgartirish (faqat adminlar). */
export async function PATCH(request: Request) {
  const auth = await guard(request, { admin: true });
  if ("response" in auth) return auth.response;

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;
  const { userId, role } = parsed.data;

  if (userId === auth.user.id && role !== "admin") {
    // Aks holda admin o'zini tizimdan qulflab qo'yishi mumkin.
    return fail("O'z adminlik huquqingizni ola olmaysiz", 400);
  }

  if (role !== "admin") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) return fail("Tizimda kamida bitta admin qolishi kerak", 400);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, role: true },
  });

  return ok({ user });
}
