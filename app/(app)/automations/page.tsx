import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Avtomatlar" };

export default async function AutomationsPage() {
  const { t } = await getDictionary();
  return (
    <ComingSoon
      title={t.nav.automations}
      subtitle={t.home.comingSoon}
      body={t.home.comingSoonBody}
      plannedLabel={t.home.comingSoonPlanned}
      planned={[
        "Trigger: yangi foydalanuvchi, /start, kalit so'z",
        "Trigger: buyurtma, to'lov, jadval",
        "Amal: xabar, AI javobi, teg, API",
        "AI avtomatlashtirish quruvchi",
        "Broadcast kampaniyalari",
      ]}
    />
  );
}
