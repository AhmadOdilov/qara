"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Alert, Button, Card, EmptyState } from "@/components/ui";

/**
 * Mini App hali yo'q holati (§19).
 *
 * Bo'sh ekran nima qilish kerakligini aytadi va bitta tugma beradi — soxta
 * interfeys ko'rsatilmaydi.
 */
export function MiniAppCreatePanel({
  botId,
  hostingAvailable,
}: {
  botId: string;
  hostingAvailable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    const result = await api(`/api/bots/${botId}/mini-app`, { json: {} });
    if (!result.ok) {
      setBusy(false);
      setError(result.error === "network" ? "Tarmoq xatosi" : result.error);
      return;
    }
    // Sahifa server tomonda qaytadan yig'iladi — konstruktor darhol ochiladi.
    router.refresh();
  }

  return (
    <Card>
      <EmptyState
        title="Mini App"
        body="Telegram ichida ochiladigan to'liq veb-sahifa yarating: katalog, forma yoki buyurtma oynasi. Kod yozilmaydi."
        action={
          <Button onClick={create} disabled={busy}>
            {busy ? "Yaratilmoqda…" : "Mini App yaratish"}
          </Button>
        }
      />
      {!hostingAvailable ? (
        <div className="border-t border-line px-5 py-3">
          <Alert tone="accent">
            APP_URL hozir HTTPS emas. Mini App&apos;ni yaratib, konstruktorda
            ishlatish mumkin, lekin Telegram uni ochishi uchun HTTPS manzil kerak.
          </Alert>
        </div>
      ) : null}
      {error ? (
        <div className="border-t border-line px-5 py-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}
    </Card>
  );
}
