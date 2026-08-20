import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { IconShield } from "@/components/icons";

/** Admin bo'limlari uchun rol tekshiruvi. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const { t } = await getDictionary();

  if (user?.role !== "admin") {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-danger-soft text-danger">
            <IconShield width={22} height={22} />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-ink">
            {t.errors.forbidden}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{t.admin.noAccess}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
