"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Alert, Card, Input, Toggle } from "@/components/ui";

/**
 * «Mini App qayerdan ochiladi» paneli (§8, §20).
 *
 * Uch nuqta mustaqil yoqiladi. Menyu tugmasi Telegram'da DARHOL o'rnatiladi
 * (`setChatMenuButton`), inline va klaviatura tugmalari esa qoralamaga
 * tushadi — shuning uchun ular uchun «nashr eting» eslatmasi chiqadi.
 */

type LaunchState = {
  menu: boolean;
  menuText: string;
  inline: boolean;
  keyboard: boolean;
  url: string;
  available: boolean;
};

export function LaunchPanel({
  botId,
  published,
}: {
  botId: string;
  published: boolean;
}) {
  const [state, setState] = useState<LaunchState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await api<LaunchState>(`/api/bots/${botId}/mini-app/launch`);
      if (cancelled) return;
      if (result.ok) {
        setState(result.data);
        setText(result.data.menuText);
      } else {
        setError(result.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [botId]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    const result = await api<LaunchState & { needsPublish: boolean }>(
      `/api/bots/${botId}/mini-app/launch`,
      { method: "PATCH", json: body },
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "network" ? "Tarmoq xatosi" : result.error);
      return;
    }
    setState(result.data);
    setText(result.data.menuText);
    setNotice(
      result.data.needsPublish
        ? "Saqlandi — tugmalar jonli botga chiqishi uchun «Nashr etish» bosing"
        : "Saqlandi",
    );
  }

  return (
    <Card>
      <p className="border-b border-line px-5 py-3 text-sm font-medium text-ink">
        Botga ulash
      </p>

      <div className="space-y-4 px-5 py-4">
        {!published ? (
          <Alert tone="accent">
            Mini App nashr etilmagan. Ulashdan oldin uni nashr eting.
          </Alert>
        ) : null}
        {state && !state.available ? (
          <Alert tone="accent">
            APP_URL HTTPS emas — Telegram bunday manzilni ochmaydi.
          </Alert>
        ) : null}
        {error ? <Alert>{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        {!state ? (
          <p className="text-sm text-ink-subtle">Yuklanmoqda…</p>
        ) : (
          <>
            <Toggle
              checked={state.menu}
              onChange={(value) => patch({ menu: value, menuText: text })}
              disabled={busy || !published || !state.available}
              label="Menyu tugmasi"
              hint="Chatdagi «≡» tugmasi — Telegram'da darhol o'rnatiladi"
            />

            {state.menu ? (
              <div className="pl-1">
                <Input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onBlur={() => text.trim() && text !== state.menuText && patch({ menuText: text })}
                  maxLength={64}
                  aria-label="Menyu tugmasi matni"
                  className="max-w-xs"
                />
              </div>
            ) : null}

            <Toggle
              checked={state.inline}
              onChange={(value) => patch({ inline: value })}
              disabled={busy || !published || !state.available}
              label="Inline tugma"
              hint="Xabar ostidagi tugma — qoralamaga tushadi"
            />

            <Toggle
              checked={state.keyboard}
              onChange={(value) => patch({ keyboard: value })}
              disabled={busy || !published || !state.available}
              label="Klaviatura tugmasi"
              hint="Pastdagi klaviaturada — qoralamaga tushadi"
            />
          </>
        )}
      </div>
    </Card>
  );
}
