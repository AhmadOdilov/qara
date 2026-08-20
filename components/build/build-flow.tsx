"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { friendly, type FriendlyError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/provider";
import {
  countMenu,
  featureLabel,
  type Blueprint,
  type BlueprintSource,
} from "@/lib/ai/blueprint";
import { Alert, Badge, Button, Card, Stepper, Textarea } from "@/components/ui";
import { ErrorAlert } from "@/components/error-alert";
import {
  BotFatherSteps,
  TokenField,
  looksLikeToken,
} from "@/components/bots/botfather-guide";
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconSparkle,
} from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Bot yaratish sehrgari (§3).
 *
 *   1. Bot g'oyasi  →  2. Tekshirish  →  3. Telegram ulash
 *
 * Uchta qoida:
 *   · Foydalanuvchi har doim nechanchi qadamda ekanini va oldinda nima
 *     turganini ko'radi — `Stepper` sahifaning tepasida qotib turadi.
 *   · Har bir qadam bitta ishni so'raydi. O'ttizta maydonli forma yo'q:
 *     nozik sozlamalar bot yaratilgandan keyin, o'z sahifasida ochiladi.
 *   · Orqaga qaytish har doim mumkin va hech narsa yo'qolmaydi — qadamlar
 *     holati shu komponentda turadi.
 */

export type TemplateCard = {
  id: string;
  title: string;
  emoji: string;
  tagline: string;
  features: string[];
};

export type PlanResponse = {
  id: string;
  blueprint: Blueprint;
  source: BlueprintSource;
  fallbackReason: string | null;
  pendingActions: string[];
};

type Step = "describe" | "review" | "connect";

const ORDER: Step[] = ["describe", "review", "connect"];

export function BuildFlow({
  templates,
  initialTemplate,
  aiEnabled,
  initialPlan,
}: {
  templates: TemplateCard[];
  initialTemplate: string | null;
  aiEnabled: boolean;
  /** Telegramda tuzilgan reja — shu bo'lsa darhol ko'rib chiqishdan boshlanadi. */
  initialPlan?: PlanResponse;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [step, setStep] = useState<Step>(initialPlan ? "review" : "describe");
  const [prompt, setPrompt] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(initialTemplate);
  const [plan, setPlan] = useState<PlanResponse | null>(initialPlan ?? null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  const stepLabels = [t.build.stepDescribe, t.build.stepReview, t.build.stepConnect];
  const stepHelp = [
    t.build.stepHelpDescribe,
    t.build.stepHelpReview,
    t.build.stepHelpConnect,
  ];
  const stepIndex = ORDER.indexOf(step);

  async function generate(useTemplate?: string) {
    const chosen = useTemplate ?? templateId;
    if (!prompt.trim() && !chosen) {
      setError({ title: t.build.promptRequired, action: null });
      return;
    }
    setBusy(true);
    setError(null);

    const result = await api<PlanResponse>("/api/ai/plan", {
      json: { prompt: prompt.trim(), templateId: chosen ?? null },
    });

    setBusy(false);
    if (!result.ok) {
      setError(friendly(result, t));
      return;
    }
    setPlan(result.data);
    setStep("review");
  }

  async function createBot() {
    if (!plan) return;
    setBusy(true);
    setError(null);

    const result = await api<{ bot: { id: string } }>(
      `/api/ai/plan/${plan.id}/apply`,
      { json: { token: token.trim() } },
    );

    setBusy(false);
    if (!result.ok) {
      setError(friendly(result, t));
      return;
    }
    // Yangi bot sahifasi tekshiruv ro'yxati bilan ochiladi (§8).
    router.push(`/bots/${result.data.bot.id}?created=1`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Qadamlar ko'rsatkichi — har uch qadamda bir joyda turadi (§3). */}
      <div className="mb-6">
        <Stepper steps={stepLabels} current={stepIndex} ofLabel={t.common.of} />
        <p className="mt-3 hidden text-sm text-ink-muted sm:block">
          {stepHelp[stepIndex]}
        </p>
      </div>

      {step === "describe" ? (
        <DescribeStep
          prompt={prompt}
          onPrompt={setPrompt}
          templates={templates}
          templateId={templateId}
          aiEnabled={aiEnabled}
          busy={busy}
          error={error}
          onGenerate={generate}
          onPickTemplate={(id) => {
            setTemplateId(id);
            void generate(id);
          }}
        />
      ) : null}

      {step === "review" && plan ? (
        <ReviewStep
          plan={plan}
          busy={busy}
          error={error}
          onBack={() => {
            setPlan(null);
            setError(null);
            setStep("describe");
          }}
          onNext={() => {
            setError(null);
            setStep("connect");
          }}
        />
      ) : null}

      {step === "connect" ? (
        <ConnectStep
          token={token}
          onToken={setToken}
          busy={busy}
          error={error}
          onBack={() => {
            setError(null);
            setStep("review");
          }}
          onCreate={createBot}
        />
      ) : null}
    </div>
  );
}

/* ── 1. Bot g'oyasi ──────────────────────────────────────────────────────── */

function DescribeStep({
  prompt,
  onPrompt,
  templates,
  templateId,
  aiEnabled,
  busy,
  error,
  onGenerate,
  onPickTemplate,
}: {
  prompt: string;
  onPrompt: (next: string) => void;
  templates: TemplateCard[];
  templateId: string | null;
  aiEnabled: boolean;
  busy: boolean;
  error: FriendlyError | null;
  onGenerate: () => void;
  onPickTemplate: (id: string) => void;
}) {
  const { t } = useI18n();

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t.build.heading}
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">{t.build.subheading}</p>
      </div>

      <Card className="p-4">
        <Textarea
          value={prompt}
          onChange={(event) => onPrompt(event.target.value)}
          placeholder={t.build.placeholder}
          rows={5}
          maxLength={2000}
          aria-label={t.build.heading}
          disabled={busy}
          className="border-0 bg-transparent px-0 text-base focus:border-0"
        />
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-xs text-ink-subtle">
            {aiEnabled ? null : t.build.sourceRules}
          </span>
          <Button onClick={onGenerate} loading={busy} size="lg">
            {busy ? null : <IconSparkle width={16} height={16} />}
            {busy ? t.build.thinking : t.build.submit}
          </Button>
        </div>
      </Card>

      {error ? (
        <div className="mt-3">
          <ErrorAlert error={error} onRetry={onGenerate} />
        </div>
      ) : null}

      <p className="mt-8 mb-3 text-center text-xs text-ink-subtle">
        {t.build.orTemplate}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            disabled={busy}
            onClick={() => onPickTemplate(template.id)}
            className={cn(
              "rounded-card border p-4 text-left transition-colors disabled:opacity-60",
              templateId === template.id
                ? "border-accent bg-accent-soft"
                : "border-line bg-surface-raised hover:border-line-strong hover:bg-surface-inset",
            )}
          >
            <span className="text-xl" aria-hidden="true">
              {template.emoji}
            </span>
            <p className="mt-2 text-sm font-medium text-ink">{template.title}</p>
            <p className="mt-0.5 text-xs text-ink-subtle">{template.tagline}</p>
          </button>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-ink-subtle">
        <Link href="/templates" className="underline underline-offset-2 hover:text-ink">
          {t.home.templatesLink}
        </Link>
      </p>
    </>
  );
}

/* ── 2. Tekshirish ───────────────────────────────────────────────────────── */

function ReviewStep({
  plan,
  busy,
  error,
  onBack,
  onNext,
}: {
  plan: PlanResponse;
  busy: boolean;
  error: FriendlyError | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const bp = plan.blueprint;

  return (
    <>
      <div className="mb-5">
        <div className="mb-2">
          <Badge tone={plan.source === "claude" ? "accent" : "neutral"}>
            <IconSparkle width={12} height={12} />
            {plan.source === "claude" ? t.build.sourceClaude : t.build.sourceRules}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t.build.understood}
        </h1>
        <p className="mt-1 text-lg text-ink">{bp.name}</p>
        {bp.description ? (
          <p className="mt-1 text-sm text-ink-muted">{bp.description}</p>
        ) : null}
      </div>

      {plan.fallbackReason ? (
        <div className="mb-4">
          <Alert tone="accent">{plan.fallbackReason}</Alert>
        </div>
      ) : null}

      <Card className="mb-4 p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">{t.build.recommended}</h2>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {bp.features.map((id) => {
            const feature = featureLabel(id);
            return (
              <li key={id} className="flex items-center gap-2 text-sm text-ink">
                <IconCheck width={15} height={15} className="shrink-0 text-success" />
                <span>
                  {feature.emoji} {feature.label}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Telegram ko'rinishi — «bot qanday ko'rinadi?» savoliga javob (§7). */}
      <Card className="mb-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{t.build.menuPreview}</h2>
          <span className="text-xs text-ink-subtle">{countMenu(bp.menu)}</span>
        </div>

        <div className="rounded-lg bg-surface-inset p-3">
          <p className="mb-3 whitespace-pre-wrap rounded-lg bg-surface-raised px-3 py-2 text-sm text-ink">
            {bp.welcomeMessage}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {bp.menu.map((item, index) => (
              <span
                key={`${item.text}-${index}`}
                className="truncate rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-center text-xs text-ink"
              >
                {item.emoji} {item.text}
              </span>
            ))}
          </div>
        </div>

        {bp.menu.some((item) => item.children.length > 0) ? (
          <div className="mt-3 space-y-1.5">
            {bp.menu
              .filter((item) => item.children.length > 0)
              .map((item, index) => (
                <p key={index} className="text-xs text-ink-subtle">
                  <span className="text-ink-muted">
                    {item.emoji} {item.text}
                  </span>
                  {" → "}
                  {item.children.map((child) => child.text).join(", ")}
                </p>
              ))}
          </div>
        ) : null}
      </Card>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-ink">{t.build.commands}</h2>
          <ul className="space-y-1">
            {bp.commands.map((command) => (
              <li key={command.command} className="text-sm text-ink-muted">
                <code className="text-ink">/{command.command}</code> —{" "}
                {command.description}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-ink">{t.build.aiAssistant}</h2>
          {bp.ai.enabled ? (
            <p className="line-clamp-4 text-sm text-ink-muted">{bp.ai.systemPrompt}</p>
          ) : (
            <p className="text-sm text-ink-subtle">—</p>
          )}
        </Card>
      </div>

      {bp.automations.length > 0 || bp.integrations.length > 0 ? (
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          {bp.automations.length > 0 ? (
            <Card className="p-5">
              <h2 className="mb-2 text-sm font-semibold text-ink">
                {t.build.automations}
              </h2>
              <ul className="space-y-1.5">
                {bp.automations.map((automation) => (
                  <li key={automation.name} className="text-sm text-ink-muted">
                    <span className="text-ink">{automation.name}</span>
                    <br />
                    <span className="text-xs">{automation.description}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {bp.integrations.length > 0 ? (
            <Card className="p-5">
              <h2 className="mb-2 text-sm font-semibold text-ink">
                {t.build.integrations}
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {bp.integrations.map((id) => (
                  <Badge key={id}>{id}</Badge>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* Halol ogohlantirish: qaysi tugmalar hali ishlamaydi (§70). */}
      {plan.pendingActions.length > 0 ? (
        <Card className="mb-4 p-5">
          <div className="flex items-start gap-2.5">
            <IconAlert width={17} height={17} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-medium text-ink">{t.build.needsSetup}</p>
              <p className="mt-1 text-xs text-ink-muted">{t.build.needsSetupBody}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {plan.pendingActions.map((action) => (
                  <Badge key={action} tone="accent">
                    {action}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {error ? (
        <div className="mb-3">
          <ErrorAlert error={error} />
        </div>
      ) : null}

      <StepActions
        backLabel={t.build.startOver}
        onBack={onBack}
        nextLabel={t.build.buildThis}
        onNext={onNext}
        busy={busy}
      />
    </>
  );
}

/* ── 3. Telegram ulash ───────────────────────────────────────────────────── */

function ConnectStep({
  token,
  onToken,
  busy,
  error,
  onBack,
  onCreate,
}: {
  token: string;
  onToken: (next: string) => void;
  busy: boolean;
  error: FriendlyError | null;
  onBack: () => void;
  onCreate: () => void;
}) {
  const { t } = useI18n();
  const ready = looksLikeToken(token);

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t.build.connectTitle}
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">{t.build.connectBody}</p>
      </div>

      {/* Uch qadamli qisqa yo'riqnoma — token so'ralishidan OLDIN (§4). */}
      <div className="mb-4">
        <BotFatherSteps />
      </div>

      <Card className="p-5">
        <TokenField value={token} onChange={onToken} disabled={busy} id="wizard-token" />

        {error ? (
          <div className="mt-4">
            <ErrorAlert error={error} onRetry={onCreate} />
          </div>
        ) : null}
      </Card>

      <StepActions
        backLabel={t.common.back}
        onBack={onBack}
        nextLabel={busy ? t.build.creating : t.build.create}
        onNext={onCreate}
        busy={busy}
        nextDisabled={!ready}
      />
    </>
  );
}

/* ── Qadam tugmalari ─────────────────────────────────────────────────────── */

/**
 * Har bir qadam pastida bir xil juftlik: chapda qaytish, o'ngda davom etish.
 * Joyi o'zgarmagani uchun ko'z uni qidirmaydi, asosiy amal esa doim bitta.
 */
function StepActions({
  backLabel,
  onBack,
  nextLabel,
  onNext,
  busy,
  nextDisabled,
}: {
  backLabel: string;
  onBack: () => void;
  nextLabel: string;
  onNext: () => void;
  busy: boolean;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" size="lg" onClick={onBack} disabled={busy}>
        <IconArrowRight width={16} height={16} className="rotate-180" />
        {backLabel}
      </Button>
      <Button size="lg" onClick={onNext} loading={busy} disabled={nextDisabled}>
        {nextLabel}
        {busy ? null : <IconArrowRight width={16} height={16} />}
      </Button>
    </div>
  );
}
