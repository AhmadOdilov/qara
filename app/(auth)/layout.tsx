import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";
import { LangSwitcher } from "@/components/lang-switcher";
import { IconCheck } from "@/components/icons";

/**
 * Kirish/ro'yxatdan o'tish maketi: chapda forma, o'ngda qisqa qiymat
 * taklifi (katta ekranlarda). Landing sarlavhasi bu yerda ko'rsatilmaydi —
 * diqqat formadan chalg'imasin.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = await getDictionary();

  // Uchta ustun — AI reja, konstruktor, savdo. Landing bilan bir xil matn.
  const points = [
    t.landing.aiTitle,
    t.landing.builderTitle,
    t.landing.commerceTitle,
  ];

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative flex flex-col">
        <div className="absolute right-4 top-4">
          <LangSwitcher compact />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-16">
          {children}
        </div>
      </div>

      <aside className="relative hidden flex-col justify-center border-l border-line bg-surface-sunken px-12 lg:flex">
        <div
          className="grid-backdrop pointer-events-none absolute inset-0"
          aria-hidden="true"
        />
        <div className="relative max-w-md">
          <h2 className="text-2xl font-semibold leading-snug tracking-tight text-ink">
            {t.landing.heroTitle}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            {t.landing.heroSubtitle}
          </p>
          <ul className="mt-8 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <IconCheck
                  width={18}
                  height={18}
                  className="mt-0.5 shrink-0 text-accent"
                />
                <span className="text-sm text-ink">{point}</span>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-xs text-ink-subtle">
            {t.landing.trustLine}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm text-ink-muted hover:text-ink"
          >
            ← {t.common.appName}
          </Link>
        </div>
      </aside>
    </div>
  );
}
