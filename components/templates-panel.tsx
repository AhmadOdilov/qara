"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";
import { featureLabel } from "@/lib/ai/blueprint";
import {
  filterByCategory,
  usedCategories,
  type TemplateCard,
  type TemplateCategory,
} from "@/lib/ai/template-catalog";
import { Button, Card, EmptyState, PageHeading } from "@/components/ui";
import { IconArrowRight, IconSparkle } from "@/components/icons";

/** Kartada ko'rsatiladigan funksiyalar soni — qolgani "+N yana". */
const FEATURES_SHOWN = 4;

/**
 * Shablonlar katalogi (§21).
 *
 * "Use Template" bosilganda foydalanuvchi `/build?template=<id>` ga o'tadi —
 * bu mavjud yaratish oqimining o'zi, shablon oldindan tanlangan holda. Ya'ni
 * bu sahifa yangi mexanizm yaratmaydi, bor oqimga ikkinchi kirish nuqtasi
 * beradi: kimdir botni so'z bilan tasvirlashni afzal ko'radi, kimdir tayyor
 * ro'yxatdan tanlashni.
 */
export function TemplatesPanel({ templates }: { templates: TemplateCard[] }) {
  const { t } = useI18n();
  const [category, setCategory] = useState<TemplateCategory | null>(null);

  const categories = useMemo(() => usedCategories(templates), [templates]);
  const visible = useMemo(
    () => filterByCategory(templates, category),
    [templates, category],
  );

  const categoryLabel: Record<TemplateCategory, string> = {
    sales: t.templatesPage.categorySales,
    food: t.templatesPage.categoryFood,
    services: t.templatesPage.categoryServices,
    education: t.templatesPage.categoryEducation,
    support: t.templatesPage.categorySupport,
    other: t.templatesPage.categoryOther,
  };

  return (
    <>
      <PageHeading title={t.templatesPage.title} subtitle={t.templatesPage.subtitle} />

      <div
        role="group"
        aria-label={t.templatesPage.allCategories}
        className="mb-5 flex flex-wrap gap-1.5"
      >
        <CategoryChip
          label={t.templatesPage.allCategories}
          active={category === null}
          onClick={() => setCategory(null)}
        />
        {categories.map((value) => (
          <CategoryChip
            key={value}
            label={categoryLabel[value]}
            active={category === value}
            onClick={() => setCategory(value)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconSparkle width={28} height={28} />}
            title={t.templatesPage.empty}
            body={t.templatesPage.emptyBody}
            action={
              <Button variant="secondary" onClick={() => setCategory(null)}>
                {t.templatesPage.allCategories}
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((template) => (
            <li key={template.id}>
              <TemplateTile template={template} />
            </li>
          ))}
        </ul>
      )}

      {/* Mos shablon topilmasa — o'z g'oyasidan boshlash yo'li ochiq qolsin. */}
      <Card className="mt-6 p-5">
        <h2 className="text-sm font-semibold text-ink">
          {t.templatesPage.customTitle}
        </h2>
        <p className="mt-1 text-xs text-ink-muted">{t.templatesPage.customBody}</p>
        <Link
          href="/build"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <IconSparkle width={16} height={16} />
          {t.templatesPage.customCta}
        </Link>
      </Card>
    </>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent-soft font-medium text-accent"
          : "text-ink-muted hover:bg-surface-inset hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function TemplateTile({ template }: { template: TemplateCard }) {
  const { t } = useI18n();
  const shown = template.features.slice(0, FEATURES_SHOWN);
  const rest = template.features.length - shown.length;

  return (
    <Link
      href={`/build?template=${encodeURIComponent(template.id)}`}
      className={cn(
        "flex h-full flex-col rounded-card border border-line bg-surface-raised p-4",
        "transition-colors hover:border-line-strong hover:bg-surface-inset",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xl"
        >
          {template.emoji}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{template.title}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{template.tagline}</p>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-medium text-ink-subtle">
          {t.templatesPage.featuresLabel}
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {shown.map((id) => {
            const feature = featureLabel(id);
            return (
              <li
                key={id}
                className="rounded-md bg-surface-inset px-1.5 py-0.5 text-[11px] text-ink-muted"
              >
                <span aria-hidden="true">{feature.emoji}</span> {feature.label}
              </li>
            );
          })}
          {rest > 0 ? (
            <li className="rounded-md bg-surface-inset px-1.5 py-0.5 text-[11px] text-ink-subtle">
              +{rest} {t.templatesPage.moreFeatures}
            </li>
          ) : null}
        </ul>
      </div>

      <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-medium text-accent">
        {t.templatesPage.use}
        <IconArrowRight width={14} height={14} />
      </span>
    </Link>
  );
}
