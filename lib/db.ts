import "server-only";
import { PrismaClient } from "@prisma/client";

// Dev'da Next.js modullarni qayta yuklaganda har safar yangi pool ochilmasligi
// uchun klientni global obyektda saqlaymiz.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/*
  Toza to'xtash (§P5 PHASE 13).

  Konteyner to'xtatilganda Docker avval SIGTERM yuboradi, keyin (standart
  10 soniyadan keyin) SIGKILL. Shu oraliqda ulanishlar bo'shatilmasa
  Postgres tomonda ular `idle` holatda osilib qoladi va tez-tez qayta
  ishga tushirishda pool tugab qolishi mumkin.

  Signal ishlovchisi FAQAT bir marta o'rnatiladi: Next.js modulni qayta
  yuklaganda takror ro'yxatdan o'tsa Node `MaxListenersExceededWarning`
  beradi.
*/
const globalForShutdown = globalThis as unknown as { qaraShutdownHooked?: true };

if (!globalForShutdown.qaraShutdownHooked && typeof process !== "undefined") {
  globalForShutdown.qaraShutdownHooked = true;

  const close = (signal: string) => {
    void prisma
      .$disconnect()
      .catch((error: unknown) => {
        console.error("[shutdown] Prisma ulanishini yopib bo'lmadi:", error);
      })
      .finally(() => {
        console.info(`[shutdown] ${signal} — baza ulanishlari yopildi`);
      });
  };

  // `once` — takroriy signal ikkinchi marta yopishga urinmasin.
  process.once("SIGTERM", () => close("SIGTERM"));
  process.once("SIGINT", () => close("SIGINT"));
}
