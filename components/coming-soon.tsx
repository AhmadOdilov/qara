import Link from "next/link";
import { Badge, Card, PageHeading } from "@/components/ui";
import { IconArrowRight } from "@/components/icons";

/**
 * Hali qurilmagan bo'lim uchun ochiq holat sahifasi (§70).
 *
 * Sidebar'da bo'lim ko'rinadi, lekin bosilganda soxta interfeys emas —
 * nima rejalashtirilgani va hozir nima ishlashi yozilgan halol sahifa chiqadi.
 */
export function ComingSoon({
  title,
  subtitle,
  body,
  plannedLabel,
  planned,
  cta,
}: {
  title: string;
  subtitle: string;
  body: string;
  /** Ro'yxat sarlavhasi — tarjima chaqiruvchi sahifadan keladi. */
  plannedLabel: string;
  /** Shu bo'limda nimalar bo'lishi — foydalanuvchi nimani kutishini bilsin. */
  planned: string[];
  cta?: { href: string; label: string };
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Belgi sarlavha yonida: odam sahifaga kirishi bilan holatni ko'radi
            va ishlamayotgan tugma qidirib vaqt sarflamaydi (§19). */}
        <PageHeading
          title={title}
          subtitle={body}
          action={<Badge tone="warning">{subtitle}</Badge>}
        />
        <Card>
          <div className="px-5 py-4">
            {planned.length > 0 ? (
              <p className="mb-2.5 text-xs font-medium text-ink-subtle">
                {plannedLabel}
              </p>
            ) : null}
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {planned.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-ink-muted">
                  <span className="size-1.5 shrink-0 rounded-full bg-line-strong" />
                  {item}
                </li>
              ))}
            </ul>
            {cta ? (
              <Link
                href={cta.href}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                {cta.label}
                <IconArrowRight width={15} height={15} />
              </Link>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
