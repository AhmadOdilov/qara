import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { googleOAuthEnabled } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Kirish" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");

  const { t } = await getDictionary();
  const { error } = await searchParams;

  // Google callback'i xato kodini query'da qaytaradi — uni tarjima qilamiz.
  const message =
    error && error in t.errors
      ? t.errors[error as keyof typeof t.errors]
      : error
        ? t.errors.generic
        : undefined;

  return (
    <AuthForm
      mode="login"
      googleEnabled={googleOAuthEnabled}
      initialError={message}
    />
  );
}
