"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button, Card } from "@/components/ui";
import { IconBot, IconSettings, IconSparkle, IconX } from "@/components/icons";

const DISMISS_KEY = "qara.onboarding.dismissed";

/*
  Yopilgan holat brauzerda saqlanadi, ya'ni React uchun TASHQI manba.
  Shuning uchun `useEffect` + `setState` emas, `useSyncExternalStore`:
  effektda setState chaqirish kaskadli render beradi va React uni ataylab
  tavsiya qilmaydi.

  Server suratida har doim «yopiq» qaytadi — shu sababli qaytgan
  foydalanuvchi kartaning bir zumga chaqnab o'chishini ko'rmaydi.
*/

const listeners = new Set<() => void>();

/** localStorage yopiq bo'lsa ham yopilgani shu sessiya davomida esda qoladi. */
let sessionDismissed = false;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Boshqa yorliqda yopilsa bu yerda ham yo'qolsin.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isDismissed(): boolean {
  if (sessionDismissed) return true;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // Shaxsiy rejimda localStorage yopiq bo'lishi mumkin — shunda ko'rsatamiz.
    return false;
  }
}

function isDismissedOnServer(): boolean {
  return true;
}

function persistDismiss(): void {
  sessionDismissed = true;
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Saqlay olmasak ham sessiya davomida yopiq qoladi.
  }
  for (const listener of listeners) listener();
}

/**
 * Birinchi kirishdagi kutib olish (§12).
 *
 * Nima uchun karta, modal emas: modal ishni to'sadi va odam uni o'qimasdan
 * yopadi. Karta esa bosh sahifada turadi, kerak bo'lsa o'qiladi, kerak
 * bo'lmasa yopiladi — va yopilgani `localStorage` da qoladi.
 *
 * Server render paytida ko'rsatilmaydi: aks holda qaytgan foydalanuvchi
 * kartaning bir zumga chaqnab o'chishini ko'radi.
 */
export function OnboardingCard({ hasBots }: { hasBots: boolean }) {
  const { t } = useI18n();
  const dismissed = useSyncExternalStore(
    subscribe,
    isDismissed,
    isDismissedOnServer,
  );

  // Boti bor foydalanuvchiga kirish darsligi kerak emas.
  if (hasBots || dismissed) return null;

  const dismiss = persistDismiss;

  const steps = [
    {
      icon: <IconBot width={18} height={18} />,
      title: t.onboarding.step1Title,
      body: t.onboarding.step1Body,
    },
    {
      icon: <IconSettings width={18} height={18} />,
      title: t.onboarding.step2Title,
      body: t.onboarding.step2Body,
    },
    {
      icon: <IconSparkle width={18} height={18} />,
      title: t.onboarding.step3Title,
      body: t.onboarding.step3Body,
    },
  ];

  return (
    <Card className="mb-8 animate-rise p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {t.onboarding.title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{t.onboarding.body}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.common.dismiss}
          className="-mr-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-inset hover:text-ink"
        >
          <IconX width={16} height={16} />
        </button>
      </div>

      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-lg bg-surface-inset p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-surface-raised text-accent">
              {step.icon}
            </span>
            <p className="mt-3 text-sm font-medium text-ink">
              <span className="text-ink-subtle">{index + 1}. </span>
              {step.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link
          href="/build"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
        >
          <IconSparkle width={16} height={16} />
          {t.onboarding.start}
        </Link>
        <Button variant="ghost" onClick={dismiss}>
          {t.onboarding.later}
        </Button>
      </div>
    </Card>
  );
}
