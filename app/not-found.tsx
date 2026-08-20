import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";
import { Logo } from "@/components/icons";

export default async function NotFound() {
  const { t } = await getDictionary();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-8 text-5xl font-semibold tracking-tight text-ink">404</p>
      <h1 className="mt-3 text-lg font-semibold text-ink">
        {t.errors.notFound}
      </h1>
      <p className="mt-1.5 max-w-sm text-sm text-ink-muted">
        {t.errors.notFoundBody}
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 items-center rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
      >
        {t.errors.goHome}
      </Link>
    </div>
  );
}
