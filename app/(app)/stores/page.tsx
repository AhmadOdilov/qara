import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { getDictionary } from "@/lib/i18n/server";
import { listStores, isStore, type StoreSummary } from "@/lib/bots/commerce";
import { anyProviderConfigured } from "@/lib/payments/registry";
import { formatMoney } from "@/lib/bots/buttons/cart";
import { formatOrderDate } from "@/lib/bots/buttons/orders";
import { statusTone } from "@/components/bots/status";
import { Badge, Card, EmptyState, PageHeading } from "@/components/ui";
import { IconArrowRight, IconCheck, IconStore } from "@/components/icons";

export const metadata: Metadata = { title: "Do'konlar" };

/**
 * Do'konlar (§7).
 *
 * Bu sahifa ilgari butunlay «tez orada» deb turardi — bu noto'g'ri edi:
 * mahsulot, savat, sevimlilar va buyurtma allaqachon ishlaydi
 * (`lib/bots/buttons/cart.ts`, `orders.ts`, `favorites.ts`). Faqat TO'LOV
 * qatlami yo'q.
 *
 * Shuning uchun sahifa har bir imkoniyatni ALOHIDA holat bilan ko'rsatadi:
 * ishlaydiganlari «Ishlaydi», to'lov esa «Tez orada». Butun bo'limni
 * qurilmagan deb ko'rsatish foydalanuvchini adashtiradi.
 */
export default async function StoresPage() {
  const ctx = await requireWorkspace();
  const { t } = await getDictionary();

  const all = await listStores(ctx.workspaceId);
  const stores = all.filter(isStore);

  // To'lov holati registrdan keladi, qo'lda yozilmaydi: provayder sozlangan
  // va protokoli tasdiqlangan zahoti bu yer o'zi «Ishlaydi» ga o'tadi.
  const paymentsReady = anyProviderConfigured();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <PageHeading title={t.stores.title} subtitle={t.stores.subtitle} />

        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {t.stores.intro}
        </p>

        {/* ── Imkoniyatlar va ularning HAQIQIY holati ────────────────────── */}
        <Card className="mb-6">
          <div className="px-5 py-4">
            <p className="mb-3 text-xs font-medium text-ink-subtle">
              {t.stores.capabilitiesTitle}
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              <Capability label={t.stores.capProducts} tag={t.stores.statusAvailable} />
              <Capability
                label={t.stores.capCategories}
                tag={t.stores.statusAvailable}
              />
              <Capability label={t.stores.capCart} tag={t.stores.statusAvailable} />
              <Capability
                label={t.stores.capFavorites}
                tag={t.stores.statusAvailable}
              />
              <Capability label={t.stores.capOrders} tag={t.stores.statusAvailable} />
              <Capability label={t.stores.capMiniApp} tag={t.stores.statusAvailable} />
              {/* Yagona qurilmagan qism — ochiq ajratilgan. */}
              <Capability
                label={t.stores.capPayments}
                tag={paymentsReady ? t.stores.statusAvailable : t.stores.statusSoon}
                soon={!paymentsReady}
              />
            </ul>

            {paymentsReady ? null : (
              <p className="mt-4 rounded-lg border border-line bg-surface-sunken px-4 py-3 text-xs leading-relaxed text-ink-muted">
                {t.stores.paymentNote}
              </p>
            )}
          </div>
        </Card>

        {/* ── Ish maydonidagi do'konlar ─────────────────────────────────── */}
        {all.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconStore width={28} height={28} />}
              title={t.stores.emptyTitle}
              body={t.stores.emptyBody}
              action={
                <Link
                  href="/build?template=ecommerce"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover"
                >
                  <IconStore width={16} height={16} />
                  {t.stores.emptyCta}
                </Link>
              }
            />
          </Card>
        ) : stores.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconStore width={28} height={28} />}
              title={t.stores.noProductsTitle}
              body={t.stores.noProductsBody}
              action={
                <Link
                  href={`/bots/${all[0].botId}`}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover"
                >
                  {t.stores.addProducts}
                  <IconArrowRight width={16} height={16} />
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {stores.map((store) => (
              <StoreCard key={store.botId} store={store} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Capability({
  label,
  tag,
  soon,
}: {
  label: string;
  tag: string;
  soon?: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2">
      <span className="flex items-start gap-2 text-sm text-ink">
        {soon ? (
          <span
            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-line-strong"
            aria-hidden="true"
          />
        ) : (
          <IconCheck
            width={16}
            height={16}
            className="mt-0.5 shrink-0 text-success"
          />
        )}
        {label}
      </span>
      <Badge tone={soon ? "warning" : "success"}>{tag}</Badge>
    </li>
  );
}

function StoreCard({
  store,
  t,
}: {
  store: StoreSummary;
  t: Awaited<ReturnType<typeof getDictionary>>["t"];
}) {
  const status = statusTone(store.status);

  return (
    <Link
      href={`/bots/${store.botId}`}
      className="rounded-card border border-line bg-surface-raised p-4 transition-colors hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{store.name}</p>
          <p className="truncate text-xs text-ink-subtle">@{store.username}</p>
        </div>
        <Badge tone={status.tone}>{t.bots[status.labelKey]}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Stat label={t.stores.statProducts} value={store.productCount} />
        <Stat label={t.stores.statCategories} value={store.categoryCount} />
        <Stat label={t.stores.statOrders} value={store.orderCount} />
        <Stat label={t.stores.statPending} value={store.pendingOrders} />
      </dl>

      {/* Summa faqat buyurtma bo'lganda — nol qiymat hech narsa aytmaydi. */}
      {store.orderCount > 0 && store.currency ? (
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3 text-xs">
          <span className="tabular-nums text-ink-muted">
            {formatMoney(store.grossAmount, store.currency)}
          </span>
          {store.lastOrderAt ? (
            <span className="text-ink-subtle">
              {t.stores.lastOrder}: {formatOrderDate(store.lastOrderAt)}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-subtle">
          {t.stores.noOrders}
        </p>
      )}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}
