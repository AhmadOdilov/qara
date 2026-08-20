"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui";
import { IconAlert } from "@/components/icons";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    // Produksiyada bu yerdan Sentry kabi xizmatga yuborish mumkin.
    // ATAYLAB `console.error`: bu KLIENT komponenti, `lib/log.ts` esa
    // `server-only`. Next.js bu yerga faqat `digest` beradi, xato matni
    // produksiyada klientga uzatilmaydi.
    // Sentry qo'shilsa integratsiya nuqtasi aynan shu yer.
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-danger-soft text-danger">
        <IconAlert width={22} height={22} />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-ink">
        {t.errors.generic}
      </h1>
      {error.digest ? (
        <p className="mt-1 font-mono text-xs text-ink-subtle">{error.digest}</p>
      ) : null}
      <Button onClick={reset} className="mt-6">
        {t.common.retry}
      </Button>
    </div>
  );
}
