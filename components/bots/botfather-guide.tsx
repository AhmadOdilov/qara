"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Modal, Tooltip } from "@/components/overlays";
import { Alert, Button, Field, Input } from "@/components/ui";
import { IconTelegram } from "@/components/icons";

/**
 * Telegram ulash bosqichi (§4, §11).
 *
 * Bu ekranning butun mazmuni bitta muammoda: yangi foydalanuvchi «bot token»
 * nima ekanini bilmaydi. Shuning uchun bu yerda quruq maydon emas, uch narsa
 * bor: qisqa vizual yo'riqnoma, «qayerdan olaman?» darsligi va maydonning
 * o'zida jonli tekshiruv.
 */

/** BotFather tokenining shakli: `<raqamlar>:<35+ belgi>`. */
const TOKEN_SHAPE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;

export function looksLikeToken(value: string): boolean {
  return TOKEN_SHAPE.test(value.trim());
}

/* ── Uch qadamli qisqa yo'riqnoma ────────────────────────────────────────── */

/**
 * Ekrandan ketmasdan o'qiladigan qisqa versiya. To'liq dars — modalda,
 * chunki hamma ham unga muhtoj emas: ba'zilar tokenni allaqachon bilishadi.
 */
export function BotFatherSteps() {
  const { t } = useI18n();
  const steps = [t.build.bf1, t.build.bf2, t.build.bf3];

  return (
    <ol className="grid gap-2.5 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={index}
          className="rounded-lg border border-line bg-surface p-3"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
            {index + 1}
          </span>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">{step}</p>
        </li>
      ))}
    </ol>
  );
}

/* ── To'liq darslik ──────────────────────────────────────────────────────── */

export function BotFatherGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const steps = [t.build.bf1, t.build.bf2, t.build.bf3, t.build.bf4, t.build.bf5];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.build.botFatherTitle}
      description={t.build.botFatherIntro}
      closeLabel={t.common.close}
      footer={
        <>
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-inset"
          >
            <IconTelegram width={16} height={16} />
            {t.build.openBotFather}
          </a>
          <Button onClick={onClose}>{t.build.bfDone}</Button>
        </>
      }
    >
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-3">
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
            >
              {index + 1}
            </span>
            <p className="pt-1 text-sm leading-relaxed text-ink">
              <span className="sr-only">
                {t.common.step} {index + 1}:{" "}
              </span>
              {step}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-4">
        <Alert tone="warning">{t.build.tokenTooltip}</Alert>
      </div>
    </Modal>
  );
}

/* ── Token maydoni ───────────────────────────────────────────────────────── */

/**
 * Tokenni so'raydigan yagona joy — sehrgar ham, «tayyor tokenni ulash» oqimi
 * ham shu komponentni ishlatadi, ya'ni izoh va tekshiruv ikki xil bo'lib
 * ketmaydi.
 *
 * Tekshiruv yozilayotganda emas, maydondan chiqqanda ko'rsatiladi: har bir
 * harfda qizil xato chiqishi bezovta qiladi (§3).
 */
export function TokenField({
  value,
  onChange,
  disabled,
  id = "bot-token",
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const { t } = useI18n();
  const [guideOpen, setGuideOpen] = useState(false);
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const valid = looksLikeToken(trimmed);
  const showError = touched && trimmed.length > 0 && !valid;

  return (
    <>
      <Field
        label={t.build.tokenLabel}
        htmlFor={id}
        required
        hint={t.build.tokenHint}
        error={showError ? t.build.tokenInvalid : undefined}
        success={valid ? t.build.tokenLooksOk : undefined}
        tooltip={
          <Tooltip label={t.build.tokenTooltipLabel}>{t.build.tokenTooltip}</Tooltip>
        }
      >
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="123456789:AAE..."
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          // Token — sir, lekin nusxalab qo'yganini ko'ra olishi kerak.
          // Shuning uchun `password` emas: yashirish xatoni topishni qiyinlashtiradi.
          inputMode="text"
        />
      </Field>

      <button
        type="button"
        onClick={() => setGuideOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 rounded text-sm font-medium text-accent transition-colors hover:underline"
      >
        {t.build.botFatherOpen}
      </button>

      <BotFatherGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
