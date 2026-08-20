"use client";

import { useEffect, useState } from "react";
import { api, formatDate, formatTime } from "@/lib/client";
import { useI18n } from "@/lib/i18n/provider";
import { Alert, Badge, Card, EmptyState } from "@/components/ui";

/**
 * Mini App ko'rsatkichlari.
 *
 * Barcha son `mini_app_events` jadvalidan keladi. Ma'lumot bo'lmasa bo'sh
 * holat chiqadi — soxta yoki «namuna» raqam ko'rsatilmaydi.
 */

type Analytics = {
  opens: number;
  uniqueUsers: number;
  pageViews: number;
  buttonClicks: number;
  apiCalls: number;
  errors: number;
  topPages: { slug: string; views: number }[];
  recent: {
    id: string;
    eventType: string;
    pageSlug: string | null;
    createdAt: string;
    reason: string | null;
  }[];
};

const EVENT_LABELS: Record<string, string> = {
  open: "Ochildi",
  page_view: "Sahifa ko'rildi",
  button_click: "Tugma bosildi",
  api_call: "API so'rovi",
  error: "Xato",
};

export function AnalyticsPanel({ botId }: { botId: string }) {
  const { lang } = useI18n();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await api<Analytics>(`/api/bots/${botId}/mini-app/analytics`);
      if (cancelled) return;
      if (result.ok) setData(result.data);
      else setError(result.error === "network" ? "Tarmoq xatosi" : result.error);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [botId]);

  const hasData = data ? data.opens + data.pageViews + data.errors > 0 : false;

  return (
    <Card>
      <p className="border-b border-line px-5 py-3 text-sm font-medium text-ink">
        Ko&apos;rsatkichlar
      </p>

      {loading ? (
        <p className="px-5 py-4 text-sm text-ink-subtle">Yuklanmoqda…</p>
      ) : error ? (
        <div className="px-5 py-4">
          <Alert>{error}</Alert>
        </div>
      ) : !data || !hasData ? (
        <EmptyState
          title="Hali ma'lumot yo'q"
          body="Mini App Telegram ichida ochilgach ko'rsatkichlar shu yerda paydo bo'ladi."
        />
      ) : (
        <div className="space-y-5 px-5 py-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Ochilishlar" value={data.opens} />
            <Stat label="Foydalanuvchilar" value={data.uniqueUsers} />
            <Stat label="Sahifa ko'rish" value={data.pageViews} />
            <Stat label="Tugma bosish" value={data.buttonClicks} />
            <Stat label="API so'rovlari" value={data.apiCalls} />
            <Stat label="Xatolar" value={data.errors} tone={data.errors > 0 ? "danger" : undefined} />
          </dl>

          {data.topPages.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-ink-subtle">Ko&apos;p ochilgan sahifalar</p>
              <ul className="space-y-1">
                {data.topPages.map((page) => (
                  <li
                    key={page.slug}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate text-ink">{page.slug}</span>
                    <span className="tabular-nums text-ink-muted">{page.views}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.recent.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-ink-subtle">Oxirgi hodisalar</p>
              <ul className="space-y-1.5">
                {data.recent.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge tone={event.eventType === "error" ? "danger" : "neutral"}>
                      {EVENT_LABELS[event.eventType] ?? event.eventType}
                    </Badge>
                    {event.pageSlug ? (
                      <span className="text-ink-muted">{event.pageSlug}</span>
                    ) : null}
                    {event.reason ? (
                      <span className="min-w-0 truncate text-danger">{event.reason}</span>
                    ) : null}
                    <span className="ml-auto shrink-0 text-ink-subtle">
                      {formatDate(event.createdAt, lang)} {formatTime(event.createdAt, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <div className="rounded-lg border border-line px-3 py-2.5">
      <dt className="text-[11px] text-ink-subtle">{label}</dt>
      <dd
        className={
          tone === "danger"
            ? "mt-0.5 text-lg font-semibold tabular-nums text-danger"
            : "mt-0.5 text-lg font-semibold tabular-nums text-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}
