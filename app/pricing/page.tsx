import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { fill, type Dictionary } from "@/lib/i18n/dictionaries";
import {
  ANNUAL_MONTHS_CHARGED,
  annualUzs,
  approxUsd,
  formatUzs,
  listPlans,
  type Plan,
} from "@/lib/pricing";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { IconArrowRight, IconCheck } from "@/components/icons";

export const metadata: Metadata = { title: "Tariflar" };

/**
 * Tariflar sahifasi (§17).
 *
 * Sahifa narxni BILMAYDI — u `lib/pricing.ts` dan keladi va muhit
 * o'zgaruvchisi bilan almashtiriladi. Bu yerda faqat ko'rsatish mantig'i.
 *
 * Hali qurilmagan imkoniyatlar lug'atda «(tayyor bo'lganda)» deb belgilangan
 * va pastda alohida izoh bor: ishlamaydigan narsa ishlaydigandek ko'rsatilmaydi.
 */
export default async function PricingPage() {
  const { t } = await getDictionary();
  const user = await getCurrentUser();
  const plans = listPlans();

  return (
    <>
      <SiteHeader authed={Boolean(user)} />

      <main className="pb-20">
        <section className="border-b border-line bg-surface-sunken py-14 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {t.pricing.title}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
              {t.pricing.subtitle}
            </p>
            <p className="mt-5 text-sm text-ink-subtle">
              {fill(t.pricing.annualHint, { months: String(ANNUAL_MONTHS_CHARGED) })}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                t={t}
                authed={Boolean(user)}
              />
            ))}
          </div>

          <div className="mt-8 space-y-2">
            <Note>{t.pricing.activeNote}</Note>
            <Note>{t.pricing.soonNote}</Note>
          </div>
        </section>

        {/* ── Chegaralar jadvali ───────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="overflow-x-auto rounded-card border border-line bg-surface-raised">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">{t.pricing.title}</caption>
              <thead>
                <tr className="border-b border-line bg-surface-sunken">
                  <th scope="col" className="px-4 py-3 text-left font-medium text-ink-muted">
                    &nbsp;
                  </th>
                  {plans.map((plan) => (
                    <th
                      key={plan.id}
                      scope="col"
                      className="px-4 py-3 text-left font-semibold text-ink"
                    >
                      {planName(plan, t)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <LimitRow
                  label={t.pricing.limitBots}
                  plans={plans}
                  pick={(plan) => plan.limits.bots}
                  t={t}
                />
                <LimitRow
                  label={t.pricing.limitSubscribers}
                  plans={plans}
                  pick={(plan) => plan.limits.activeSubscribers}
                  t={t}
                />
                <LimitRow
                  label={t.pricing.limitMiniApps}
                  plans={plans}
                  pick={(plan) => plan.limits.miniApps}
                  t={t}
                />
                <LimitRow
                  label={t.pricing.limitMembers}
                  plans={plans}
                  pick={(plan) => plan.limits.members}
                  t={t}
                />
                <LimitRow
                  label={t.pricing.limitAiPlans}
                  plans={plans}
                  pick={(plan) => plan.limits.aiPlansPerMonth}
                  t={t}
                  last
                />
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Savollar ─────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-4 pt-16 sm:px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-ink">
            {t.pricing.faqTitle}
          </h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {[
              { q: t.pricing.faqQ1, a: t.pricing.faqA1 },
              { q: t.pricing.faqQ2, a: t.pricing.faqA2 },
              { q: t.pricing.faqQ3, a: t.pricing.faqA3 },
            ].map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-ink">
                  {item.q}
                  <span
                    className="shrink-0 text-ink-subtle transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/* ── Bo'laklar ───────────────────────────────────────────────────────────── */

function PlanCard({
  plan,
  t,
  authed,
}: {
  plan: Plan;
  t: Dictionary;
  authed: boolean;
}) {
  const annual = annualUzs(plan);
  const isEnterprise = plan.monthlyUzs === null;
  const isFree = plan.monthlyUzs === 0;

  return (
    <div
      className={
        plan.highlighted
          ? "flex flex-col rounded-card border border-accent bg-accent-soft p-5"
          : "flex flex-col rounded-card border border-line bg-surface-raised p-5"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{planName(plan, t)}</p>
        {plan.highlighted ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-fg">
            {t.pricing.popular}
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{planWho(plan, t)}</p>

      <div className="mt-5">
        {isEnterprise ? (
          <p className="text-2xl font-semibold tracking-tight text-ink">
            {t.pricing.custom}
          </p>
        ) : isFree ? (
          <p className="text-2xl font-semibold tracking-tight text-ink">
            {t.pricing.freeLabel}
          </p>
        ) : (
          <>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-ink">
              {formatUzs(plan.monthlyUzs as number)}
              <span className="ml-1 text-sm font-normal text-ink-muted">
                {t.pricing.perMonth}
              </span>
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-ink-subtle">
              ≈ ${approxUsd(plan.monthlyUzs as number)}
              {annual !== null
                ? ` · ${formatUzs(annual)} ${t.pricing.annual.toLowerCase()}`
                : ""}
            </p>
          </>
        )}
      </div>

      <p className="mt-3 text-xs font-medium text-ink-muted">
        {plan.gmvFeePercent > 0
          ? fill(t.pricing.gmvFee, { percent: String(plan.gmvFeePercent) })
          : t.pricing.noGmvFee}
      </p>

      <ul className="mt-5 flex-1 space-y-2">
        {plan.featureKeys
          .map((key) => ({ key, label: featureLabel(key, t) }))
          // Tarjimasi yo'q kalit bo'sh nuqta bo'lib qolmasin.
          .filter((item) => item.label.length > 0)
          .map((item) => (
            <li key={item.key} className="flex items-start gap-2">
              <IconCheck
                width={15}
                height={15}
                className="mt-0.5 shrink-0 text-accent"
              />
              <span className="text-xs leading-relaxed text-ink-muted">
                {item.label}
              </span>
            </li>
          ))}
      </ul>

      <Link
        href={isEnterprise ? "mailto:hello@qara.uz" : authed ? "/build" : "/signup"}
        className={
          plan.highlighted
            ? "mt-5 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            : "mt-5 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-inset"
        }
      >
        {isEnterprise ? t.pricing.ctaContact : t.pricing.cta}
        <IconArrowRight width={15} height={15} />
      </Link>
    </div>
  );
}

function LimitRow({
  label,
  plans,
  pick,
  t,
  last,
}: {
  label: string;
  plans: readonly Plan[];
  pick: (plan: Plan) => number | null;
  t: Dictionary;
  last?: boolean;
}) {
  return (
    <tr className={last ? "" : "border-b border-line"}>
      <th scope="row" className="px-4 py-3 text-left font-medium text-ink-muted">
        {label}
      </th>
      {plans.map((plan) => {
        const value = pick(plan);
        return (
          <td key={plan.id} className="px-4 py-3 tabular-nums text-ink">
            {value === null
              ? t.pricing.unlimited
              : value === 0
                ? t.pricing.none
                : formatUzs(value)}
          </td>
        );
      })}
    </tr>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-line bg-surface-sunken px-4 py-3 text-xs leading-relaxed text-ink-muted">
      {children}
    </p>
  );
}

/* ── Lug'at kalitlariga bog'lash ─────────────────────────────────────────── */

function planName(plan: Plan, t: Dictionary): string {
  const names: Record<Plan["id"], string> = {
    free: t.pricing.planFree,
    starter: t.pricing.planStarter,
    business: t.pricing.planBusiness,
    pro: t.pricing.planPro,
    enterprise: t.pricing.planEnterprise,
  };
  return names[plan.id];
}

function planWho(plan: Plan, t: Dictionary): string {
  const who: Record<Plan["id"], string> = {
    free: t.pricing.planFreeWho,
    starter: t.pricing.planStarterWho,
    business: t.pricing.planBusinessWho,
    pro: t.pricing.planProWho,
    enterprise: t.pricing.planEnterpriseWho,
  };
  return who[plan.id];
}

/**
 * `pricing.ts` dagi kalit (`localPayments`) lug'atdagi kalitga (`fLocalPayments`)
 * moslanadi. Nomos kalit bo'lsa uni ko'rsatmaymiz — landingda tushunarsiz
 * texnik satr chiqib qolmasin.
 */
function featureLabel(key: string, t: Dictionary): string {
  const dictKey = `f${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  const table = t.pricing as unknown as Record<string, string | undefined>;
  return table[dictKey] ?? "";
}
