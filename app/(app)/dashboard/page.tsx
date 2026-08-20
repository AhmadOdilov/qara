import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { listBots } from "@/lib/bots/service";
import { getDictionary } from "@/lib/i18n/server";
import { templateCards } from "@/lib/ai/planner";
import { statusTone } from "@/components/bots/status";
import { Badge, Card, EmptyState, PageHeading } from "@/components/ui";
import {
  IconArrowRight,
  IconBolt,
  IconBot,
  IconSparkle,
  IconStore,
} from "@/components/icons";

export const metadata: Metadata = { title: "Boshqaruv paneli" };

/**
 * Bosh sahifa (§3–4).
 *
 * Bitta savol bilan boshlanadi — "nima yaratamiz?". Sozlamalar, jadvallar va
 * statistika bu yerda yo'q: ular kerak bo'lganda o'z bo'limida ochiladi.
 */
export default async function HomePage() {
  const ctx = await requireWorkspace();
  const { t } = await getDictionary();

  const bots = await listBots(ctx.workspaceId);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t.home.morning : hour < 18 ? t.home.afternoon : t.home.evening;
  const firstName = ctx.user.name.trim().split(" ")[0];

  // Tez boshlash kartalari — shablon katalogidan, qo'lda takrorlamaymiz.
  const quickStart = templateCards().filter((card) =>
    ["ai_assistant", "ecommerce", "booking", "support", "education", "other"].includes(
      card.id,
    ),
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <PageHeading
          title={`${greeting}, ${firstName} 👋`}
          subtitle={t.home.letsBuild}
        />

        {/* ── Ko'rsatkichlar ─────────────────────────────────────────────
            Raqamlar boshi berk ko'cha bo'lmasin: har biri o'zi haqidagi
            sahifaga olib boradi (§3). Bot yo'q bo'lsa umuman ko'rsatilmaydi —
            to'rtta nol foydalanuvchiga hech narsa aytmaydi. */}
        {bots.length > 0 ? (
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatLink
              href="/bots"
              label={t.home.statBots}
              value={bots.length}
            />
            <StatLink
              href="/bots?filter=active"
              label={t.home.statActive}
              value={bots.filter((bot) => bot.status === "active").length}
            />
            <StatLink
              href="/analytics"
              label={t.home.statUsers}
              value={bots.reduce((total, bot) => total + bot.userCount, 0)}
            />
            <StatLink
              href="/analytics"
              label={t.home.statMessages}
              value={bots.reduce((total, bot) => total + bot.messageCount, 0)}
            />
          </div>
        ) : null}

        {/* ── Asosiy amallar ─────────────────────────────────────────────── */}
        <Card className="mb-8 p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">{t.home.createNew}</h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <PrimaryAction
              href="/build"
              icon={<IconSparkle width={18} height={18} />}
              label={t.home.createWithAi}
              featured
            />
            <PrimaryAction
              href="/build?template=other"
              icon={<IconBot width={18} height={18} />}
              label={t.home.createBot}
            />
            <PrimaryAction
              href="/build?template=ecommerce"
              icon={<IconStore width={18} height={18} />}
              label={t.home.createStore}
            />
            <PrimaryAction
              href="/automations"
              icon={<IconBolt width={18} height={18} />}
              label={t.home.createAutomation}
              soon={t.home.comingSoon}
            />
          </div>
        </Card>

        {/* ── 2 daqiqada boshlash ────────────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-ink">{t.home.quickStart}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quickStart.map((card) => (
              <Link
                key={card.id}
                href={`/build?template=${card.id}`}
                className="group rounded-card border border-line bg-surface-raised p-4 transition-colors hover:border-line-strong hover:bg-surface-inset"
              >
                <span className="text-xl">{card.emoji}</span>
                <p className="mt-2 text-sm font-medium text-ink">{card.title}</p>
                <p className="mt-0.5 text-xs text-ink-subtle">{card.tagline}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Mavjud botlar ──────────────────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{t.home.yourBots}</h2>
            {bots.length > 0 ? (
              <Link
                href="/bots"
                className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
              >
                {t.home.viewAll}
                <IconArrowRight width={14} height={14} />
              </Link>
            ) : null}
          </div>

          {bots.length === 0 ? (
            <Card>
              <EmptyState
                icon={<IconBot width={28} height={28} />}
                title={t.home.noBots}
                body={t.home.noBotsBody}
                action={
                  <Link
                    href="/build"
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover"
                  >
                    <IconSparkle width={16} height={16} />
                    {t.home.createWithAi}
                  </Link>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {bots.slice(0, 4).map((bot) => {
                const status = statusTone(bot.status);
                return (
                  <Link
                    key={bot.id}
                    href={`/bots/${bot.id}`}
                    className="rounded-card border border-line bg-surface-raised p-4 transition-colors hover:border-line-strong"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{bot.name}</p>
                        <p className="truncate text-xs text-ink-subtle">@{bot.username}</p>
                      </div>
                      <Badge tone={status.tone}>{t.bots[status.labelKey]}</Badge>
                    </div>
                    <dl className="mt-3 flex gap-4 text-xs text-ink-muted">
                      <div>
                        <dt className="text-ink-subtle">{t.bots.statUsers}</dt>
                        <dd className="font-medium tabular-nums text-ink">
                          {bot.userCount}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-subtle">{t.bots.statMessages}</dt>
                        <dd className="font-medium tabular-nums text-ink">
                          {bot.messageCount}
                        </dd>
                      </div>
                    </dl>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Bosiladigan ko'rsatkich kartasi (§3). */
function StatLink({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="rounded-card border border-line bg-surface-raised p-4 transition-colors hover:border-line-strong hover:bg-surface-inset"
    >
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">{value}</p>
    </Link>
  );
}

function PrimaryAction({
  href,
  icon,
  label,
  featured,
  soon,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  featured?: boolean;
  soon?: string;
}) {
  return (
    <Link
      href={href}
      className={
        featured
          ? "flex items-center gap-2.5 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
          : "flex items-center gap-2.5 rounded-lg border border-line-strong bg-surface px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface-inset"
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {soon ? (
        <span className="rounded-full bg-surface-inset px-1.5 py-0.5 text-[10px] font-medium text-ink-subtle">
          {soon}
        </span>
      ) : null}
    </Link>
  );
}
