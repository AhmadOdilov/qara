import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { googleOAuthEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Ro'yxatdan o'tish" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <AuthForm mode="signup" googleEnabled={googleOAuthEnabled} />;
}
