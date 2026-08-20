import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, guard, ok, parseBody } from "@/lib/api";
import { destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { track } from "@/lib/analytics";

const schema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    lang: z.enum(["uz", "ru", "en"]).optional(),
    notifyTelegram: z.boolean().optional(),
    notifyEmail: z.boolean().optional(),
    quietHours: z.boolean().optional(),
    currentPassword: z.string().max(128).optional(),
    newPassword: z.string().min(8, "Parol kamida 8 belgi").max(128).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "O'zgartirish uchun maydon berilmadi",
  });

export async function PATCH(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.lang !== undefined) data.lang = input.lang;
  if (input.notifyTelegram !== undefined) data.notifyTelegram = input.notifyTelegram;
  if (input.notifyEmail !== undefined) data.notifyEmail = input.notifyEmail;
  if (input.quietHours !== undefined) data.quietHours = input.quietHours;

  if (input.newPassword) {
    const current = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { passwordHash: true },
    });

    // Parol allaqachon o'rnatilgan bo'lsa — joriy parolni tasdiqlash shart.
    // Google orqali yaratilgan hisobda parol yo'q, u holda birinchi parolni
    // tasdiqsiz qo'shish mumkin (sessiya allaqachon tekshirilgan).
    if (current?.passwordHash) {
      if (!input.currentPassword) {
        return fail("Joriy parolni kiriting", 422);
      }
      const valid = await verifyPassword(
        input.currentPassword,
        current.passwordHash,
      );
      if (!valid) return fail("Joriy parol noto'g'ri", 403);
    }

    data.passwordHash = await hashPassword(input.newPassword);
  }

  const user = await prisma.user.update({
    where: { id: auth.user.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      lang: true,
      notifyTelegram: true,
      notifyEmail: true,
      quietHours: true,
    },
  });

  await track("profile_updated", user.id, { fields: Object.keys(data) });
  return ok({ user });
}

/** GDPR/PDPA: hisobni va unga bog'liq barcha yozuvlarni o'chirish. */
export async function DELETE(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;

  // Bog'liq jadvallar sxemada onDelete: Cascade bilan belgilangan.
  await prisma.user.delete({ where: { id: auth.user.id } });
  await destroySession();

  return ok({ ok: true });
}
