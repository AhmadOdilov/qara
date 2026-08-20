import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Integratsiyalar" };

export default async function IntegrationsPage() {
  const { t } = await getDictionary();
  return (
    <ComingSoon
      title={t.nav.integrations}
      subtitle={t.home.comingSoon}
      body={t.home.comingSoonBody}
      plannedLabel={t.home.comingSoonPlanned}
      planned={[
        "Payme va Click",
        "Google Sheets",
        "REST API konnektori",
        "Webhook'lar",
        "Billz / MoySklad",
        "SMS provayderlari",
      ]}
    />
  );
}
