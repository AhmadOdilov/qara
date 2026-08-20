import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { telegramMockMode } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/server";
import { PageHeading } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";
import { TelegramLinkPanel, type LinkState } from "@/components/telegram-link-panel";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser();
  const { t } = await getDictionary();

  const [account, link] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    }),
    prisma.telegramLink.findUnique({ where: { userId: user.id } }),
  ]);

  const linkState: LinkState =
    link?.connectedAt && link.telegramChatId
      ? {
          linked: true,
          mockMode: telegramMockMode,
          telegram: {
            username: link.username,
            firstName: link.firstName,
            chatId: link.telegramChatId,
            connectedAt: link.connectedAt.toISOString(),
          },
        }
      : { linked: false, mockMode: telegramMockMode };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <PageHeading title={t.profile.title} subtitle={t.profile.subtitle} />

        <div className="mb-5">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            {t.telegram.title}
          </h2>
          <TelegramLinkPanel initial={linkState} />
        </div>

        <ProfileForm
          profile={{
            name: user.name,
            email: user.email,
            lang: user.lang,
            hasPassword: Boolean(account.passwordHash),
            notifyTelegram: user.notifyTelegram,
            notifyEmail: user.notifyEmail,
            quietHours: user.quietHours,
            createdAt: user.createdAt.toISOString(),
          }}
        />
      </div>
    </div>
  );
}
