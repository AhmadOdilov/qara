"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { LangSwitcher } from "@/components/lang-switcher";
import { Logo, IconMenu, IconX } from "@/components/icons";
import { cn } from "@/lib/cn";

/** Landing sahifa sarlavhasi. Kirgan foydalanuvchiga «Panel» ko'rsatiladi. */
export function SiteHeader({ authed }: { authed: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/#features", label: t.nav.features },
    { href: "/#security", label: t.nav.security },
    { href: "/pricing", label: t.nav.pricing },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Qara">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-inset hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <div className="hidden sm:block">
            <LangSwitcher compact />
          </div>
          {authed ? (
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            >
              {t.nav.dashboard}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden h-9 items-center rounded-lg px-3 text-sm text-ink-muted transition-colors hover:bg-surface-inset hover:text-ink sm:inline-flex"
              >
                {t.nav.login}
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
              >
                {t.nav.signup}
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
            className="ml-1 inline-flex size-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-inset md:hidden"
          >
            {open ? <IconX /> : <IconMenu />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-line bg-surface px-4 py-3 md:hidden">
          <nav className="flex flex-col">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-ink-muted hover:bg-surface-inset hover:text-ink"
              >
                {link.label}
              </a>
            ))}
            {!authed ? (
              <Link
                href="/login"
                className="rounded-lg px-3 py-2.5 text-sm text-ink-muted hover:bg-surface-inset hover:text-ink sm:hidden"
              >
                {t.nav.login}
              </Link>
            ) : null}
          </nav>
          <div className="mt-2 border-t border-line pt-2 sm:hidden">
            <LangSwitcher />
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-surface-sunken">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <Logo />
            <p className="mt-2 max-w-xs text-sm text-ink-subtle">
              {t.common.tagline}
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/privacy" className="text-ink-muted hover:text-ink">
              {t.landing.footerPrivacy}
            </Link>
            <Link href="/terms" className="text-ink-muted hover:text-ink">
              {t.landing.footerTerms}
            </Link>
            <a
              href="mailto:hello@qara.uz"
              className="text-ink-muted hover:text-ink"
            >
              {t.landing.footerContact}
            </a>
          </nav>
        </div>
        <p className="mt-8 text-xs text-ink-subtle">
          © {year} Qara. {t.landing.footerRights}.
        </p>
      </div>
    </footer>
  );
}

/** Bo'lim sarlavhasi — landing bo'limlarida takrorlanadi. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-base text-ink-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}
