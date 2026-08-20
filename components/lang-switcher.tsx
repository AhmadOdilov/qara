"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LANGS, LANG_LABELS, type Lang } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { IconGlobe } from "@/components/icons";
import { cn } from "@/lib/cn";

export function LangSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  async function choose(next: Lang) {
    setOpen(false);
    if (next === lang) return;
    await fetch("/api/lang", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: next }),
    });
    // Server komponentlar yangi lug'at bilan qayta render bo'ladi.
    startTransition(() => router.refresh());
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.common.language}
        disabled={pending}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-ink-muted",
          "transition-colors hover:bg-surface-inset hover:text-ink disabled:opacity-60",
        )}
      >
        <IconGlobe width={16} height={16} />
        {compact ? (
          <span className="uppercase">{lang}</span>
        ) : (
          <span>{LANG_LABELS[lang]}</span>
        )}
      </button>

      {open ? (
        <>
          {/* Tashqariga bosilganda yopish uchun ko'rinmas qatlam */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            className="absolute right-0 z-20 mt-1 min-w-36 overflow-hidden rounded-lg border border-line bg-surface-raised py-1"
            style={{ boxShadow: "var(--shadow-md)" }}
          >
            {LANGS.map((code) => (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={code === lang}
                  onClick={() => choose(code)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-surface-inset",
                    code === lang ? "font-medium text-accent" : "text-ink",
                  )}
                >
                  {LANG_LABELS[code]}
                  <span className="text-xs uppercase text-ink-subtle">{code}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
