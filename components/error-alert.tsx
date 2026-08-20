"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Alert, Button } from "@/components/ui";
import type { FriendlyError } from "@/lib/errors";

/**
 * Xatoni ko'rsatishning yagona shakli (§10).
 *
 * Ekranda uch qatlam: nima bo'ldi, nega, va tugatish uchun bitta tugma.
 * Server bergan asl matn yashirin qoladi va faqat so'ralganda ochiladi —
 * shunda oddiy foydalanuvchi qo'rqmaydi, texnik odam esa ma'lumotdan
 * ayrilmaydi.
 */
export function ErrorAlert({
  error,
  onRetry,
  onFixToken,
}: {
  error: FriendlyError | null;
  onRetry?: () => void;
  onFixToken?: () => void;
}) {
  const { t } = useI18n();
  const [showRaw, setShowRaw] = useState(false);

  if (!error) return null;

  let action: React.ReactNode = null;
  if (error.action === "retry" && onRetry) {
    action = (
      <Button size="sm" variant="secondary" onClick={onRetry}>
        {t.common.retry}
      </Button>
    );
  } else if (error.action === "token" && onFixToken) {
    action = (
      <Button size="sm" variant="secondary" onClick={onFixToken}>
        {t.errors.checkToken}
      </Button>
    );
  } else if (error.action === "signIn") {
    action = (
      <Link
        href="/login"
        className="inline-flex h-8 items-center rounded-lg border border-line-strong bg-surface-raised px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-inset"
      >
        {t.errors.signIn}
      </Link>
    );
  }

  return (
    <Alert tone="danger" title={error.title} action={action}>
      {error.body ? <p>{error.body}</p> : null}
      {error.raw ? (
        showRaw ? (
          <p className="mt-1.5 break-words font-mono text-xs opacity-80">{error.raw}</p>
        ) : (
          <button
            type="button"
            onClick={() => setShowRaw(true)}
            className="mt-1 rounded text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
          >
            {t.common.details}
          </button>
        )
      ) : null}
    </Alert>
  );
}
