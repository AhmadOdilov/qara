import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";
import {
  getDailySeries,
  getLanguageSplit,
  getOverview,
  getTopUsers,
  periodStart,
} from "@/lib/stats";
import { Card, CardHeader, PageHeading } from "@/components/ui";
import {
  BarList,
  MessagesLineChart,
  StatTile,
  VizStyle,
} from "@/components/charts";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Analitika" };

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { lang, t } = await getDictionary();
  const { days: raw } = await searchParams;

  const days: Range = RANGES.includes(Number(raw) as Range)
    ? (Number(raw) as Range)
    : 30;
  const since = periodStart(days);

  const [overview, series, langSplit, topUsers] = await Promise.all([
    getOverview(since),
    getDailySeries(since, days),
    getLanguageSplit(),
    getTopUsers(since),
  ]);

  const rangeLabels: Record<Range, string> = {
    7: t.analytics.range7,
    30: t.analytics.range30,
    90: t.analytics.range90,
  };

  return (
    <div className="viz-root min-h-0 flex-1 overflow-y-auto">
      <VizStyle />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <PageHeading
          title={t.analytics.title}
          subtitle={t.analytics.subtitle}
          action={
            // Davr filtri — grafiklar ustidagi bitta qatorda
            <div
              className="inline-flex rounded-lg border border-line bg-surface-raised p-0.5"
              role="group"
              aria-label={t.analytics.subtitle}
            >
              {RANGES.map((range) => (
                <Link
                  key={range}
                  href={`/admin/analytics?days=${range}`}
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label={t.admin.messagesTotal} value={overview.messages} />
          <StatTile label={t.analytics.signups} value={overview.signups} />
          <StatTile
            label={t.analytics.avgPerUser}
            value={overview.avgPerUser}
          />
          <StatTile
            label={t.analytics.linkRate}
            value={`${overview.linkRate}%`}
            hint={`${overview.linkedUsers}/${overview.users}`}
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
                data={series}
                labels={{ sent: t.analytics.sent, received: t.analytics.received }}
                locale={lang}
                emptyLabel={t.analytics.noData}
              />
            </div>
          </Card>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={t.analytics.topUsers}
              subtitle={t.analytics.topUsersSub}
            />
            <BarList rows={topUsers} emptyLabel={t.analytics.noData} />
          </Card>

          <Card>
            <CardHeader
              title={t.analytics.langSplit}
              subtitle={t.analytics.langSplitSub}
            />
            <BarList
              rows={langSplit}
              emptyLabel={t.analytics.noData}
              colorBySlot
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
