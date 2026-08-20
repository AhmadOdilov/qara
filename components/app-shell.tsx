"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { LangSwitcher } from "@/components/lang-switcher";
import {
  IconBolt,
  IconBot,
  IconChart,
  IconChat,
  IconHelp,
  IconKey,
  IconLogout,
  IconMenu,
  IconPlug,
  IconSparkle,
  IconStore,
  IconUser,
  IconUsers,
  IconX,
  Logo,
} from "@/components/icons";
import { cn } from "@/lib/cn";

type NavUser = {
  name: string;
  email: string;
  role: "user" | "admin";
  avatarUrl: string | null;
};

/** Kirgan foydalanuvchi bo'limlarining umumiy karkasi. */
export function AppShell({
  user,
  children,
}: {
  user: NavUser;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sidebar ataylab qisqa (§2). Qurilmagan bo'limlar ham ko'rinadi, lekin
  // "tez orada" belgisi bilan — bosilganda ochiq holat sahifasi chiqadi,
  // jim ishlamaydigan havola qolmaydi (§70).
  const nav: {
    href: string;
    label: string;
    icon: React.ReactNode;
    soon?: boolean;
  }[] = [
    { href: "/chat", label: t.nav.chat, icon: <IconChat width={18} height={18} /> },
    { href: "/bots", label: t.nav.bots, icon: <IconBot width={18} height={18} /> },
    {
      href: "/templates",
      label: t.nav.templates,
      icon: <IconSparkle width={18} height={18} />,
    },
    { href: "/stores", label: t.nav.stores, icon: <IconStore width={18} height={18} /> },
    {
      href: "/automations",
      label: t.nav.automations,
      icon: <IconBolt width={18} height={18} />,
      soon: true,
    },
    {
      href: "/analytics",
      label: t.nav.analytics,
      icon: <IconChart width={18} height={18} />,
    },
    {
      href: "/integrations",
      label: t.nav.integrations,
      icon: <IconPlug width={18} height={18} />,
      soon: true,
    },
    {
      href: "/api-keys",
      label: t.nav.apiKeys,
      icon: <IconKey width={18} height={18} />,
    },
    {
      href: "/workspace",
      label: t.nav.workspace,
      icon: <IconUsers width={18} height={18} />,
    },
    { href: "/profile", label: t.nav.profile, icon: <IconUser width={18} height={18} /> },
    { href: "/help", label: t.nav.help, icon: <IconHelp width={18} height={18} /> },
    ...(user.role === "admin"
      ? [
          { href: "/admin", label: t.nav.admin, icon: <IconUsers width={18} height={18} /> },
        ]
      : []),
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const navList = (
    <>
      {/* Asosiy amal — yaratish. Har doim ro'yxatning tepasida turadi (§5). */}
      <Link
        href="/build"
        onClick={() => setMobileOpen(false)}
        className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
      >
        <IconSparkle width={16} height={16} />
        {t.nav.build}
      </Link>

      <nav className="flex flex-col gap-0.5">
        {nav.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname.startsWith("/admin")
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-ink-muted hover:bg-surface-inset hover:text-ink",
              )}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.soon ? (
                <span className="rounded-full bg-surface-inset px-1.5 py-0.5 text-[10px] font-medium text-ink-subtle">
                  {t.home.comingSoon}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const account = (
    <div className="border-t border-line pt-3">
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initials
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="truncate text-xs text-ink-subtle">{user.email}</p>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between gap-1 px-1">
        <LangSwitcher compact />
        <button
          type="button"
          onClick={logout}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-ink-muted transition-colors hover:bg-surface-inset hover:text-ink"
        >
          <IconLogout width={16} height={16} />
          {t.common.logout}
        </button>
      </div>
    </div>
  );

  return (
    // h-dvh + overflow-hidden: chat o'z ichida scroll qiladi, sahifa emas.
    // Uzun sahifalar (profil, admin) main ichida o'z scroll'ini oladi.
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      {/* Mobil sarlavha */}
      <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3 lg:hidden">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={mobileOpen}
          className="inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-inset"
        >
          {mobileOpen ? <IconX /> : <IconMenu />}
        </button>
      </header>

      {mobileOpen ? (
        <div className="shrink-0 overflow-y-auto border-b border-line px-3 py-3 lg:hidden">
          {navList}
          <div className="mt-3">{account}</div>
        </div>
      ) : null}

      {/* Ish stoli yon paneli */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface-sunken px-3 py-4 lg:flex">
        <Link href="/dashboard" className="px-3 pb-5">
          <Logo />
        </Link>
        {navList}
        <div className="mt-auto">{account}</div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
