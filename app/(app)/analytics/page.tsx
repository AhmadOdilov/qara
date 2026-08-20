import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { getDictionary } from "@/lib/i18n/server";
import { getWorkspaceAnalytics } from "@/lib/bots/analytics";
import { Card, CardHeader, EmptyState, PageHeading } from "@/components/ui";
import { BarList, MessagesLineChart, StatTile, VizStyle } from "@/components/charts";
import { IconChart } from "@/components/icons";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Analitika" };

const RANGES = [1, 7, 30, 90] as const;
type Range = (typeof RANGES)[number];

/**
 * Ish maydoni analitikasi (§22).
 *
 * Admin analitikasidan (`/admin/analytics`) farqi: bu yerda platforma emas,
 * FOYDALANUVCHINING o'z botlari hisoblanadi. Ma'lumot `getWorkspaceAnalytics`
 * orqali keladi va u har bir so'rovni workspace botlari bilan cheklaydi.
 *
 * Sahifa server komponenti: raqamlar to'g'ridan-to'g'ri bazadan o'qiladi,
 * klientga qo'shimcha so'rov ketmaydi.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const ctx = await requireWorkspace();
  const { lang, t } = await getDictionary();
  const { days: raw } = await searchParams;

  const days: Range = RANGES.includes(Number(raw) as Range)
    ? (Number(raw) as Range)
    : 30;

  const data = await getWorkspaceAnalytics(ctx.workspaceId, days);

  const rangeLabels: Record<Range, string> = {
    1: t.analytics.range1,
    7: t.analytics.range7,
    30: t.analytics.range30,
    90: t.analytics.range90,
  };

  // Hech qanday faollik bo'lmasa raqamlar qatorini ko'rsatish ma'nosiz —
  // nol to'la ekran foydalanuvchiga hech narsa aytmaydi (§19).
  const hasActivity =
    data.totalUsers > 0 || data.messages > 0 || data.buttonClicks > 0;

  return (
    <div className="viz-root min-h-0 flex-1 overflow-y-auto">
      <VizStyle />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <PageHeading
          title={t.analytics.title}
          subtitle={t.analytics.subtitle}
          action={
            <div
              className="inline-flex rounded-lg border border-line bg-surface-raised p-0.5"
              role="group"
              aria-label={t.analytics.subtitle}
            >
              {RANGES.map((range) => (
                <Link
                  key={range}
                  href={`/analytics?days=${range}`}
                  scroll={false}
                  aria-current={range === days ? "true" : undefined}
                  className={cn(
                    "rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors",
                    range === days
                      ? "bg-accent-soft text-accent"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {rangeLabels[range]}
                </Link>
              ))}
            </div>
          }
        />

        {!hasActivity ? (
          <Card>
            <EmptyState
              icon={<IconChart width={28} height={28} />}
              title={t.analytics.emptyTitle}
              body={t.analytics.emptyBody}
            />
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label={t.analytics.botUsers}
                value={data.totalUsers}
                hint={`+${data.newUsers} ${t.analytics.newUsers.toLowerCase()}`}
              />
              <StatTile label={t.analytics.activeUsers} value={data.activeUsers} />
              <StatTile
                label={t.analytics.messagesTotal}
                value={data.messages}
                hint={`${data.incoming} / ${data.outgoing}`}
              />
              <StatTile
                label={t.analytics.buttonClicks}
                value={data.buttonClicks}
              />
            </div>

            <section className="mt-6">
              <Card>
                <CardHeader
                  title={t.analytics.messagesOverTime}
                  subtitle={t.analytics.messagesOverTimeSub}
                />
                <div className="p-4">
                  <MessagesLineChart
                    data={data.series}
                    labels={{
                      sent: t.analytics.sent,
                      received: t.analytics.received,
                    }}
                    locale={lang}
                    emptyLabel={t.analytics.noData}
                  />
                </div>
              </Card>
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader
                  title={t.analytics.topButtons}
                  subtitle={t.analytics.topButtonsSub}
                />
                <BarList rows={data.topButtons} emptyLabel={t.analytics.noData} />
              </Card>

              <Card>
                <CardHeader
                  title={t.analytics.topCommands}
                  subtitle={t.analytics.topCommandsSub}
                />
                <BarList rows={data.topCommands} emptyLabel={t.analytics.noData} />
              </Card>
            </div>

            <div className="mt-6">
              <Card>
                <CardHeader
                  title={t.analytics.byBot}
                  subtitle={t.analytics.byBotSub}
                />
                <BarList
                  rows={data.topBots}
                  emptyLabel={t.analytics.noData}
                  colorBySlot
                />
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
