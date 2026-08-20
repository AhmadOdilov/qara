import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type AnalyticsEventName =
  | "signup"
  | "login"
  | "logout"
  | "message_sent"
  | "message_received"
  | "telegram_linked"
  | "telegram_unlinked"
  | "lang_changed"
  | "profile_updated"
  // Onboarding voronkasi (§53). Nomlar ataylab bosqich tartibida —
  // voronka hisobotini shu ro'yxatdan qurish mumkin.
  | "telegram_started"
  | "onboarding_started"
  | "onboarding_plan_generated"
  | "onboarding_completed"
  | "workspace_created"
  | "bot_created";

/**
 * Analitika yozuvi asosiy oqimni bloklamasligi kerak — xato bo'lsa
 * jimgina o'tkazib yuboriladi.
 */
export async function track(
  event: AnalyticsEventName,
  userId?: string | null,
  meta?: Prisma.InputJsonValue,
  value = 1,
): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: { event, userId: userId ?? null, value, meta },
    });
  } catch (error) {
    console.error("[analytics] yozib bo'lmadi:", event, error);
  }
}
