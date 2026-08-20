"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { api, formatDate } from "@/lib/client";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Toggle,
} from "@/components/ui";
import { LANGS, LANG_LABELS } from "@/lib/i18n/dictionaries";

export type ProfileData = {
  name: string;
  email: string;
  lang: "uz" | "ru" | "en";
  hasPassword: boolean;
  notifyTelegram: boolean;
  notifyEmail: boolean;
  quietHours: boolean;
  createdAt: string;
};

export function ProfileForm({ profile }: { profile: ProfileData }) {
  const { lang, t } = useI18n();
  const router = useRouter();

  const [name, setName] = useState(profile.name);
  const [uiLang, setUiLang] = useState(profile.lang);
  const [notifyTelegram, setNotifyTelegram] = useState(profile.notifyTelegram);
  const [notifyEmail, setNotifyEmail] = useState(profile.notifyEmail);
  const [quietHours, setQuietHours] = useState(profile.quietHours);

  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwStatus, setPwStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [pwError, setPwError] = useState<string | null>(null);

  async function saveAccount(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);

    const result = await api("/api/profile", {
      method: "PATCH",
      json: { name, lang: uiLang, notifyTelegram, notifyEmail, quietHours },
    });

    if (!result.ok) {
      setStatus("idle");
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }

    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
    router.refresh();
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setPwStatus("saving");
    setPwError(null);

    const result = await api("/api/profile", {
      method: "PATCH",
      json: {
        newPassword,
        ...(profile.hasPassword ? { currentPassword } : {}),
      },
    });

    if (!result.ok) {
      setPwStatus("idle");
      setPwError(result.error === "network" ? t.errors.network : result.error);
      return;
    }

    setPwStatus("saved");
    setCurrentPassword("");
    setNewPassword("");
    setTimeout(() => setPwStatus("idle"), 2000);
    router.refresh();
  }

  async function deleteAccount() {
    if (!confirm(t.profile.deleteConfirm)) return;
    const result = await api("/api/profile", { method: "DELETE" });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Hisob */}
      <Card>
        <CardHeader title={t.profile.accountSection} />
        <form onSubmit={saveAccount} className="space-y-4 p-5">
          {error ? <Alert>{error}</Alert> : null}

          <Field label={t.profile.displayName} htmlFor="name">
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={80}
              required
            />
          </Field>

          <Field
            label={t.auth.email}
            htmlFor="email"
            hint={t.profile.emailReadonly}
          >
            <Input id="email" value={profile.email} disabled readOnly />
          </Field>

          <Field label={t.profile.interfaceLang} htmlFor="lang">
            <Select
              id="lang"
              value={uiLang}
              onChange={(event) =>
                setUiLang(event.target.value as ProfileData["lang"])
              }
            >
              {LANGS.map((code) => (
                <option key={code} value={code}>
                  {LANG_LABELS[code]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="divide-y divide-line border-t border-line pt-2">
            <Toggle
              checked={notifyTelegram}
              onChange={setNotifyTelegram}
              label={t.profile.notifTelegram}
              hint={t.profile.notifTelegramHint}
            />
            <Toggle
              checked={notifyEmail}
              onChange={setNotifyEmail}
              label={t.profile.notifEmail}
              hint={t.profile.notifEmailHint}
            />
            <Toggle
              checked={quietHours}
              onChange={setQuietHours}
              label={t.profile.quietHours}
              hint={t.profile.quietHoursHint}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={status === "saving"}>
              {status === "saving" ? t.common.loading : t.common.save}
            </Button>
            {status === "saved" ? (
              <span className="text-sm text-success">{t.common.saved}</span>
            ) : null}
          </div>
        </form>
      </Card>

      {/* Parol */}
      <Card>
        <CardHeader title={t.profile.passwordSection} />
        <form onSubmit={savePassword} className="space-y-4 p-5">
          {pwError ? <Alert>{pwError}</Alert> : null}
          {!profile.hasPassword ? (
            <Alert tone="accent">{t.profile.noPasswordSet}</Alert>
          ) : null}

          {profile.hasPassword ? (
            <Field label={t.profile.currentPassword} htmlFor="currentPassword">
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </Field>
          ) : null}

          <Field
            label={t.profile.newPassword}
            htmlFor="newPassword"
            hint={t.auth.passwordHint}
          >
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              maxLength={128}
              required
            />
          </Field>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="secondary"
              disabled={pwStatus === "saving" || newPassword.length < 8}
            >
              {pwStatus === "saving" ? t.common.loading : t.common.save}
            </Button>
            {pwStatus === "saved" ? (
              <span className="text-sm text-success">{t.common.saved}</span>
            ) : null}
          </div>
        </form>
      </Card>

      {/* Xavfli hudud */}
      <Card>
        <CardHeader title={t.profile.dangerSection} />
        <div className="divide-y divide-line">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-sm font-medium text-ink">
                {t.profile.exportData}
              </p>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {t.profile.exportHint}
              </p>
            </div>
            <a
              href="/api/profile/export"
              className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-surface-raised px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-inset"
            >
              JSON
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-sm font-medium text-ink">
                {t.profile.deleteAccount}
              </p>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {t.profile.deleteHint}
              </p>
            </div>
            <Button variant="danger" onClick={deleteAccount}>
              {t.common.delete}
            </Button>
          </div>
        </div>
      </Card>

      <p className="px-1 text-xs text-ink-subtle">
        {t.profile.memberSince}: {formatDate(profile.createdAt, lang)}
      </p>
    </div>
  );
}
