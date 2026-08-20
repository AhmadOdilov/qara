import Link from "next/link";

/**
 * Sahifalash boshqaruvi (§P6 PHASE 14).
 *
 * Server komponenti: holat URL'da yashaydi, shuning uchun sahifa havolasi
 * ulashiladi va orqaga tugmasi kutilganidek ishlaydi. Klient holati kerak
 * emas.
 */
export function Pager({
  page,
  pages,
  from,
  to,
  total,
  basePath,
  params = {},
  labels,
}: {
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
  basePath: string;
  /** URL'da saqlanadigan qo'shimcha parametrlar (qidiruv va h.k.). */
  params?: Record<string, string | undefined>;
  labels: { prev: string; next: string; of: string };
}) {
  // Bitta sahifa bo'lsa boshqaruv ko'rsatilmaydi — foydasiz shovqin.
  if (pages <= 1) return null;

  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    search.set("page", String(target));
    return `${basePath}?${search.toString()}`;
  };

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3"
      aria-label={labels.of}
    >
      <p className="text-xs tabular-nums text-ink-subtle">
        {from}–{to} {labels.of} {total}
      </p>

      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link
            href={href(page - 1)}
            className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-xs text-ink transition-colors hover:bg-surface-inset"
          >
            ← {labels.prev}
          </Link>
        ) : (
          <span className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-xs text-ink-subtle opacity-50">
            ← {labels.prev}
          </span>
        )}

        <span className="px-1 text-xs tabular-nums text-ink-muted">
          {page} / {pages}
        </span>

        {page < pages ? (
          <Link
            href={href(page + 1)}
            className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-xs text-ink transition-colors hover:bg-surface-inset"
          >
            {labels.next} →
          </Link>
        ) : (
          <span className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-xs text-ink-subtle opacity-50">
            {labels.next} →
          </span>
        )}
      </div>
    </nav>
  );
}
