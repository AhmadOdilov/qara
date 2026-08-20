import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { templateCards } from "@/lib/ai/planner";
import { SiteFooter, SiteHeader, SectionHeading } from "@/components/site-chrome";
import {
  IconArrowRight,
  IconBolt,
  IconBot,
  IconChart,
  IconCheck,
  IconShield,
  IconSparkle,
  IconStore,
  IconTelegram,
} from "@/components/icons";

/**
 * Landing (§1–2).
 *
 * Pozitsiya: Qara — «bot konstruktori» emas, AI bilan ishlaydigan Telegram
 * biznes platformasi. Shuning uchun sahifa imkoniyat ro'yxatidan emas,
 * FOYDALANUVCHI OQIMIDAN boradi: bir jumla → reja → konstruktor → sinov →
 * Mini App → buyurtma → analitika.
 *
 * Maketlar — sof CSS, tashqi rasm yuklanmaydi. Ular mahsulot HAQIQATAN
 * chiqaradigan natijani ko'rsatadi: soxta skrinshot yo'q.
 */
export default async function LandingPage() {
  const { t } = await getDictionary();
  const user = await getCurrentUser();

  const startHref = user ? "/dashboard" : "/signup";
  const startLabel = user ? t.nav.dashboard : t.landing.ctaPrimary;

  const useCases = [
    t.landing.uc1,
    t.landing.uc2,
    t.landing.uc3,
    t.landing.uc4,
    t.landing.uc5,
    t.landing.uc6,
  ];

  // Shablonlar landingda ham, ilova ichida ham BITTA manbadan keladi.
  const templates = templateCards().slice(0, 6);

  const faqs = [
    { q: t.landing.faqQ1, a: t.landing.faqA1 },
    { q: t.landing.faqQ2, a: t.landing.faqA2 },
    { q: t.landing.faqQ3, a: t.landing.faqA3 },
    { q: t.landing.faqQ4, a: t.landing.faqA4 },
    { q: t.landing.faqQ5, a: t.landing.faqA5 },
    { q: t.landing.faqQ6, a: t.landing.faqA6 },
  ];

  return (
    <>
      <SiteHeader authed={Boolean(user)} />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div
            className="grid-backdrop pointer-events-none absolute inset-0 -z-10"
            aria-hidden="true"
          />
          <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-24 lg:pt-20">
            <div className="animate-rise">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-raised px-3 py-1 text-xs font-medium text-ink-muted">
                <IconSparkle width={14} height={14} className="text-accent" />
                {t.landing.heroBadge}
              </span>

              <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
                {t.landing.heroTitle}
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">
                {t.landing.heroSubtitle}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={startHref}
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-accent px-6 text-base font-medium text-accent-fg transition-colors hover:bg-accent-hover"
                >
                  {startLabel}
                  <IconArrowRight width={18} height={18} />
                </Link>
                <a
                  href="#demo"
                  className="inline-flex h-12 items-center rounded-lg border border-line-strong bg-surface-raised px-6 text-base font-medium text-ink transition-colors hover:bg-surface-inset"
                >
                  {t.landing.ctaSecondary}
                </a>
              </div>

              <p className="mt-6 text-xs text-ink-subtle">{t.landing.trustLine}</p>
            </div>

            <BotMockup />
          </div>
        </section>

        {/* ── Kimlar uchun ─────────────────────────────────────────────── */}
        <section className="border-t border-line bg-surface-sunken py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-center text-sm font-medium text-ink">
              {t.landing.useCasesTitle}
            </p>
            <p className="mt-1 text-center text-sm text-ink-muted">
              {t.landing.useCasesSubtitle}
            </p>
            <ul className="mt-6 flex flex-wrap justify-center gap-2">
              {useCases.map((label) => (
                <li
                  key={label}
                  className="rounded-full border border-line bg-surface-raised px-3.5 py-1.5 text-sm text-ink-muted"
                >
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── AI: bir jumladan bot ─────────────────────────────────────── */}
        <section id="demo" className="scroll-mt-16 py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <Eyebrow>{t.landing.aiEyebrow}</Eyebrow>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {t.landing.aiTitle}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-muted">
                {t.landing.aiBody}
              </p>
              <p className="mt-5 rounded-lg border border-line bg-surface-sunken px-4 py-3 text-sm leading-relaxed text-ink-muted">
                {t.landing.aiFallbackNote}
              </p>
            </div>

            <div className="space-y-3">
              <Mock label={t.landing.aiPromptLabel}>
                <p className="px-4 py-3.5 text-sm text-ink">
                  {t.landing.aiPromptExample}
                </p>
              </Mock>

              <div className="flex justify-center text-ink-subtle" aria-hidden="true">
                <IconSparkle width={18} height={18} className="text-accent" />
              </div>

              <Mock label={t.landing.aiOutputLabel}>
                <BotMenuList />
              </Mock>
            </div>
          </div>
        </section>

        {/* ── Konstruktor ──────────────────────────────────────────────── */}
        <section
          id="features"
          className="scroll-mt-16 border-t border-line bg-surface-sunken py-16 sm:py-24"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
            <BuilderMockup />
            <div className="lg:order-first">
              <Eyebrow>{t.landing.builderEyebrow}</Eyebrow>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {t.landing.builderTitle}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-muted">
                {t.landing.builderBody}
              </p>
              <ul className="mt-6 space-y-2.5">
                {[t.landing.builderP1, t.landing.builderP2, t.landing.builderP3].map(
                  (point) => (
                    <Point key={point}>{point}</Point>
                  ),
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Sinov ────────────────────────────────────────────────────── */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Eyebrow>{t.landing.previewEyebrow}</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {t.landing.previewTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
              {t.landing.previewBody}
            </p>
          </div>
        </section>

        {/* ── Mini App ─────────────────────────────────────────────────── */}
        <section className="border-t border-line bg-surface-sunken py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <Eyebrow>{t.landing.miniAppEyebrow}</Eyebrow>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {t.landing.miniAppTitle}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-muted">
                {t.landing.miniAppBody}
              </p>
              <ul className="mt-6 space-y-2.5">
                {[t.landing.miniAppP1, t.landing.miniAppP2, t.landing.miniAppP3].map(
                  (point) => (
                    <Point key={point}>{point}</Point>
                  ),
                )}
              </ul>
            </div>
            <MiniAppMockup />
          </div>
        </section>

        {/* ── Savdo ────────────────────────────────────────────────────── */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>{t.landing.commerceEyebrow}</Eyebrow>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {t.landing.commerceTitle}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-muted">
                {t.landing.commerceBody}
              </p>
            </div>

            {/* Oqim — oxirgi qadam ataylab farqlanadi: u hali ulanmagan. */}
            <ol className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-2">
              {[
                t.landing.commerceStep1,
                t.landing.commerceStep2,
                t.landing.commerceStep3,
                t.landing.commerceStep4,
              ].map((step) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="rounded-lg border border-line bg-surface-raised px-3.5 py-2 text-sm font-medium text-ink">
                    {step}
                  </span>
                  <IconArrowRight
                    width={14}
                    height={14}
                    className="text-ink-subtle"
                    aria-hidden="true"
                  />
                </li>
              ))}
              <li>
                <span className="rounded-lg border border-dashed border-line-strong bg-surface-sunken px-3.5 py-2 text-sm font-medium text-ink-subtle">
                  {t.landing.commerceStep5}
                </span>
              </li>
            </ol>

            <p className="mt-4 text-center text-xs text-ink-subtle">
              {t.landing.commercePaymentNote}
            </p>
          </div>
        </section>

        {/* ── Analitika ────────────────────────────────────────────────── */}
        <section className="border-t border-line bg-surface-sunken py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
            <AnalyticsMockup />
            <div className="lg:order-first">
              <Eyebrow>{t.landing.analyticsEyebrow}</Eyebrow>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {t.landing.analyticsTitle}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-muted">
                {t.landing.analyticsBody}
              </p>
              <ul className="mt-6 space-y-2.5">
                {[
                  t.landing.analyticsM1,
                  t.landing.analyticsM2,
                  t.landing.analyticsM3,
                  t.landing.analyticsM4,
                ].map((metric) => (
                  <Point key={metric}>{metric}</Point>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Shablonlar ───────────────────────────────────────────────── */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow={t.landing.templatesEyebrow}
              title={t.landing.templatesTitle}
              subtitle={t.landing.templatesBody}
            />
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((card) => (
                <div
                  key={card.id}
                  className="rounded-card border border-line bg-surface-raised p-5"
                >
                  <span className="text-xl">{card.emoji}</span>
                  <p className="mt-2.5 text-sm font-semibold text-ink">{card.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                    {card.tagline}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Avtomatlar — qurilmoqda ──────────────────────────────────── */}
        <section className="border-t border-line bg-surface-sunken py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-raised px-3 py-1 text-xs font-medium text-ink-subtle">
              <IconBolt width={14} height={14} />
              {t.landing.automationsBadge}
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {t.landing.automationsTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
              {t.landing.automationsBody}
            </p>
          </div>
        </section>

        {/* ── Xavfsizlik ───────────────────────────────────────────────── */}
        <section id="security" className="scroll-mt-16 py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <IconShield width={22} height={22} />
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {t.landing.securityTitle}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-muted">
                {t.landing.securityBody}
              </p>
            </div>
            <ul className="space-y-3">
              {[t.landing.sec1, t.landing.sec2, t.landing.sec3, t.landing.sec4].map(
                (item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 rounded-lg border border-line bg-surface-raised px-4 py-3"
                  >
                    <IconCheck
                      width={18}
                      height={18}
                      className="mt-0.5 shrink-0 text-success"
                    />
                    <span className="text-sm text-ink">{item}</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>

        {/* ── Tariflar (qisqa) ─────────────────────────────────────────── */}
        <section className="border-t border-line bg-surface-sunken py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {t.landing.pricingTeaserTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
              {t.landing.pricingTeaserBody}
            </p>
            <Link
              href="/pricing"
              className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface-raised px-5 text-sm font-medium text-ink transition-colors hover:bg-surface-inset"
            >
              {t.landing.pricingTeaserCta}
              <IconArrowRight width={16} height={16} />
            </Link>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {t.landing.faqTitle}
            </h2>
            {/* `details` — JS'siz ham ochiladi va klaviaturadan yuriladi. */}
            <div className="mt-10 divide-y divide-line border-y border-line">
              {faqs.map((item) => (
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
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Yakuniy CTA ──────────────────────────────────────────────── */}
        <section className="border-t border-line bg-surface-sunken py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {t.landing.finalTitle}
            </h2>
            <p className="mt-4 text-base text-ink-muted">{t.landing.finalBody}</p>
            <div className="mt-8 flex justify-center">
              <Link
                href={startHref}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-accent px-6 text-base font-medium text-accent-fg transition-colors hover:bg-accent-hover"
              >
                {startLabel}
                <IconArrowRight width={18} height={18} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/* ── Kichik yordamchilar ─────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-wider text-accent">
      {children}
    </span>
  );
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <IconCheck width={18} height={18} className="mt-0.5 shrink-0 text-accent" />
      <span className="text-sm text-ink-muted">{children}</span>
    </li>
  );
}

/** Maket ramkasi — tepasida nima ko'rsatilayotganini aytadigan yorliq. */
function Mock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface-raised">
      <p className="border-b border-line px-4 py-2 text-xs font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </p>
      {children}
    </div>
  );
}

/* ── Maketlar ────────────────────────────────────────────────────────────
   Hammasi sof CSS. Bu maketlar mahsulot HAQIQATAN chiqaradigan natijani
   ko'rsatadi — soxta raqam va soxta imkoniyat yo'q. */

const DEMO_MENU = [
  { emoji: "🍕", label: "Menyu" },
  { emoji: "🛒", label: "Buyurtma" },
  { emoji: "❤️", label: "Sevimlilar" },
  { emoji: "📍", label: "Yetkazib berish" },
  { emoji: "📞", label: "Aloqa" },
] as const;

function BotMenuList() {
  return (
    <ul className="space-y-1.5 p-3" aria-hidden="true">
      {DEMO_MENU.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
        >
          <span>{item.emoji}</span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Hero maketi — Telegram oynasidagi bot menyusi. */
function BotMockup() {
  return (
    <div
      className="animate-rise rounded-card border border-line bg-surface-raised"
      style={{ boxShadow: "var(--shadow-lg)" }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent">
          <IconTelegram width={18} height={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Pizza House</p>
          <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
            <span className="inline-block size-1.5 rounded-full bg-success" />
            bot
          </p>
        </div>
      </div>

      <div className="bg-surface-sunken px-4 py-5">
        <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink">
          Assalomu alaykum! Nima buyurtma qilamiz?
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 border-t border-line p-3">
        {DEMO_MENU.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 rounded-lg bg-surface-inset px-3 py-2.5 text-sm text-ink"
          >
            <span>{item.emoji}</span>
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Konstruktor maketi — daraxt, ko'rinish va sozlamalar uch ustunda. */
function BuilderMockup() {
  const tree = [
    { label: "Menyu", depth: 0, active: true },
    { label: "Pizza", depth: 1 },
    { label: "Ichimliklar", depth: 1 },
    { label: "Buyurtma", depth: 0 },
    { label: "Aloqa", depth: 0 },
  ];

  return (
    <div
      className="rounded-card border border-line bg-surface-raised"
      style={{ boxShadow: "var(--shadow-md)" }}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <IconBot width={16} height={16} className="text-accent" />
          Pizza House
        </div>
        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-warning">
          Qoralama
        </span>
      </div>

      <div className="grid grid-cols-[1fr_1fr] divide-x divide-line">
        <ul className="space-y-1 p-3">
          {tree.map((node) => (
            <li
              key={node.label}
              className={
                node.active
                  ? "rounded-md bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent"
                  : "rounded-md px-2.5 py-1.5 text-xs text-ink-muted"
              }
              style={{ marginLeft: `${node.depth * 12}px` }}
            >
              {node.label}
            </li>
          ))}
        </ul>

        <div className="space-y-1.5 bg-surface-sunken p-3">
          {DEMO_MENU.slice(0, 4).map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-1.5 text-xs text-ink"
            >
              <span>{item.emoji}</span>
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Mini App maketi — katalog va asosiy tugma. */
function MiniAppMockup() {
  const products = [
    { name: "Margarita", price: "45 000" },
    { name: "Pepperoni", price: "55 000" },
    { name: "To'rt pishloq", price: "62 000" },
  ];

  return (
    <div
      className="mx-auto w-full max-w-sm rounded-card border border-line bg-surface-raised"
      style={{ boxShadow: "var(--shadow-md)" }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm font-medium text-ink">
        <IconStore width={16} height={16} className="text-accent" />
        Katalog
      </div>

      <div className="space-y-2 p-3">
        {products.map((product) => (
          <div
            key={product.name}
            className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5"
          >
            <span className="text-sm text-ink">{product.name}</span>
            <span className="text-sm tabular-nums text-ink-muted">
              {product.price}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-line p-3">
        <div className="flex h-10 items-center justify-center rounded-lg bg-accent text-sm font-medium text-accent-fg">
          {"Savatga qo'shish"}
        </div>
      </div>
    </div>
  );
}

/** Analitika maketi — ustunlar balandligi qat'iy, tasodifiy raqam yo'q. */
function AnalyticsMockup() {
  const bars = [38, 52, 44, 68, 61, 84, 72];

  return (
    <div
      className="rounded-card border border-line bg-surface-raised p-5"
      style={{ boxShadow: "var(--shadow-md)" }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <IconChart width={16} height={16} className="text-accent" />
        7 kun
      </div>

      <div className="mt-5 flex h-28 items-end gap-2">
        {bars.map((height, index) => (
          <div
            key={index}
            className="flex-1 rounded-t bg-accent-soft"
            style={{ height: `${height}%` }}
          >
            <div
              className="h-full w-full rounded-t bg-accent/70"
              style={{ opacity: 0.35 + index * 0.09 }}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
        <div>
          <p className="text-xs text-ink-subtle">Foydalanuvchi</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">1 248</p>
        </div>
        <div>
          <p className="text-xs text-ink-subtle">Xabar</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">9 613</p>
        </div>
        <div>
          <p className="text-xs text-ink-subtle">Bosish</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">3 402</p>
        </div>
      </div>
    </div>
  );
}
