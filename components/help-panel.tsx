"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";
import { Card, CardHeader, PageHeading } from "@/components/ui";
import { BotFatherSteps } from "@/components/bots/botfather-guide";
import {
  IconArrowRight,
  IconBot,
  IconChart,
  IconKey,
  IconPlug,
  IconSparkle,
  IconTelegram,
} from "@/components/icons";

/**
 * Yordam markazi (§20).
 *
 * Tuzilishi ataylab shunday: eng ko'p to'xtatib qo'yadigan savol — "tokenni
 * qayerdan olaman?" — sahifaning ENG TEPASIDA, ochiq holda turadi. Qolgan
 * savollar pastda, yig'ilgan ro'yxatda: kerak bo'lganda ochiladi.
 *
 * Matnlar lug'atdan olinadi, ya'ni uch tilda ham bir xil to'liq.
 */
export function HelpPanel({ botUsername }: { botUsername: string }) {
  const { t } = useI18n();

  const faq = [
    { q: t.help.q1, a: t.help.a1 },
    { q: t.help.q2, a: t.help.a2 },
    { q: t.help.q3, a: t.help.a3 },
    { q: t.help.q4, a: t.help.a4 },
    { q: t.help.q5, a: t.help.a5 },
    { q: t.help.q6, a: t.help.a6 },
  ];

  const sections = [
    {
      href: "/build",
      icon: <IconSparkle width={18} height={18} />,
      title: t.nav.build,
      body: t.templatesPage.customBody,
    },
    {
      href: "/templates",
      icon: <IconBot width={18} height={18} />,
      title: t.nav.templates,
      body: t.templatesPage.subtitle,
    },
    {
      href: "/bots",
      icon: <IconPlug width={18} height={18} />,
      title: t.nav.bots,
      body: t.bots.subtitle,
    },
    {
      href: "/analytics",
      icon: <IconChart width={18} height={18} />,
      title: t.nav.analytics,
      body: t.analytics.subtitle,
    },
    {
      href: "/api-keys",
      icon: <IconKey width={18} height={18} />,
      title: t.nav.apiKeys,
      body: t.apiKeys.subtitle,
    },
  ];

  return (
    <>
      <PageHeading title={t.help.title} subtitle={t.help.subtitle} />

      {/* Eng ko'p so'raladigan savol — ochiq holda, tepada. */}
      <Card className="mb-6">
        <CardHeader title={t.build.botFatherTitle} subtitle={t.help.a2} />
        <div className="p-5 pt-0">
          <BotFatherSteps />
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-inset"
          >
            <IconTelegram width={16} height={16} />
            {t.build.openBotFather}
          </a>
        </div>
      </Card>

      {/* Bo'limlar bo'yicha yo'l — "qayerdan boshlayman?" savoliga javob. */}
      <h2 className="mb-2 text-sm font-semibold text-ink">{t.help.stepsTitle}</h2>
      <ul className="mb-6 grid gap-2 sm:grid-cols-2">
        {sections.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className={cn(
                "flex h-full items-start gap-3 rounded-card border border-line bg-surface-raised p-4",
                "transition-colors hover:border-line-strong hover:bg-surface-inset",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                {section.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">
                  {section.title}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  {section.body}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Savol-javob — `details` bilan: JS'siz ham ochiladi va klaviaturadan
          yuriladi, alohida holat boshqaruvi kerak emas. */}
      <h2 className="mb-2 text-sm font-semibold text-ink">{t.help.subtitle}</h2>
      <Card>
        <ul className="divide-y divide-line">
          {faq.map((item, index) => (
            <li key={index}>
              <FaqRow question={item.q} answer={item.a} />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="text-sm font-semibold text-ink">{t.help.contactTitle}</h2>
        <p className="mt-1 text-xs text-ink-muted">{t.help.contactBody}</p>
        <a
          href={`https://t.me/${botUsername}`}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <IconTelegram width={16} height={16} />
          {t.help.contactCta}
          <IconArrowRight width={14} height={14} />
        </a>
      </Card>
    </>
  );
}

function FaqRow({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="group"
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4",
          "text-sm font-medium text-ink transition-colors hover:bg-surface-inset",
          "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
        )}
      >
        {question}
        <span
          aria-hidden="true"
          className="shrink-0 text-ink-subtle transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="px-5 pb-4 text-sm leading-relaxed text-ink-muted">{answer}</p>
    </details>
  );
}
