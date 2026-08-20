import Link from "next/link";
import { Logo } from "@/components/icons";
import { getDictionary } from "@/lib/i18n/server";

export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = await getDictionary();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <Logo />
          </Link>
          <Link href="/" className="text-sm text-ink-muted hover:text-ink">
            ← {t.common.back}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="mb-8 rounded-lg bg-surface-inset px-4 py-3 text-xs text-ink-muted">
          Ushbu hujjat <strong>namuna</strong> sifatida berilgan. Ishga
          tushirishdan oldin huquqshunos bilan ko&apos;rib chiqing va
          kompaniyangiz ma&apos;lumotlariga moslang.
        </div>
        <article className="space-y-6 text-sm leading-relaxed text-ink-muted [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1.5">
          {children}
        </article>
      </main>
    </div>
  );
}
