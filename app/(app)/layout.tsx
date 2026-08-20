import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

/** Barcha kirgan-foydalanuvchi sahifalari uchun himoya va umumiy karkas. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      }}
    >
      {children}
    </AppShell>
  );
}
