"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Alert, Button, Field, Input } from "@/components/ui";
import { IconGoogle, Logo } from "@/components/icons";

type Mode = "login" | "signup";

export function AuthForm({
  mode,
  googleEnabled,
  initialError,
}: {
  mode: Mode;
  googleEnabled: boolean;
  initialError?: string;
}) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const payload =
      mode === "signup"
        ? {
            name: String(form.get("name") ?? ""),
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
            lang,
          }
        : {
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          };

    try {
      const response = await fetch(`/api/auth/${mode === "signup" ? "register" : "login"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        error?: string;
        details?: { message: string }[];
      };

      if (!response.ok) {
        setError(data.details?.[0]?.message ?? data.error ?? t.errors.generic);
        setPending(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t.errors.network);
      setPending(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="w-full max-w-sm">
      <Link href="/" className="inline-block">
        <Logo />
      </Link>

      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">
        {isSignup ? t.auth.signupTitle : t.auth.loginTitle}
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {isSignup ? t.auth.signupSubtitle : t.auth.loginSubtitle}
      </p>

      {error ? (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {googleEnabled ? (
        <>
          <a
            href="/api/auth/google"
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface-raised text-sm font-medium text-ink transition-colors hover:bg-surface-inset"
          >
            <IconGoogle />
            {t.auth.google}
          </a>
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs text-ink-subtle">{t.auth.orEmail}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : (
        <div className="mt-6" />
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {isSignup ? (
          <Field label={t.auth.name} htmlFor="name">
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              placeholder={t.auth.namePlaceholder}
            />
          </Field>
        ) : null}

        <Field label={t.auth.email} htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="siz@example.com"
          />
        </Field>

        <Field
          label={t.auth.password}
          htmlFor="password"
          hint={isSignup ? t.auth.passwordHint : undefined}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 8 : 1}
            maxLength={128}
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending
            ? t.common.loading
            : isSignup
              ? t.auth.submitSignup
              : t.auth.submitLogin}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        {isSignup ? t.auth.haveAccount : t.auth.noAccount}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-accent hover:underline"
        >
          {isSignup ? t.auth.submitLogin : t.auth.submitSignup}
        </Link>
      </p>

      {!googleEnabled ? (
        <p className="mt-6 rounded-lg bg-surface-inset px-3 py-2 text-xs text-ink-subtle">
          {t.auth.googleDisabled}
        </p>
      ) : null}
    </div>
  );
}
