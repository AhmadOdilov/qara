"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import type { BuilderEndpoint } from "@/components/mini-app/builder";

/**
 * API amallari — Mini App chaqira oladigan tashqi manzillar.
 *
 * XAVFSIZLIK: manzil, metod va sarlavhalar SHU YERDA, server tomonda
 * saqlanadi. Mini App faqat amalning id'sini biladi — shuning uchun
 * foydalanuvchi ixtiyoriy manzilga so'rov yubora olmaydi.
 *
 * Sarlavha qiymatlari (API kalitlari) hech qachon qaytarilmaydi: ro'yxatda
 * faqat kalit NOMLARI ko'rinadi.
 */

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

type Draft = {
  id: string | null;
  name: string;
  method: string;
  url: string;
  headers: string;
  bodyTemplate: string;
  responseMap: string;
};

const EMPTY: Draft = {
  id: null,
  name: "",
  method: "GET",
  url: "https://",
  headers: "",
  bodyTemplate: "",
  responseMap: "",
};

export function EndpointsPanel({
  botId,
  endpoints,
  allowlist,
  onChanged,
}: {
  botId: string;
  endpoints: BuilderEndpoint[];
  allowlist: string[];
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [domains, setDomains] = useState(allowlist.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save() {
    if (!draft) return;

    const headers = parseJson(draft.headers, "Sarlavhalar");
    if ("error" in headers) return setError(headers.error);
    const body = parseJson(draft.bodyTemplate, "So'rov tanasi");
    if ("error" in body) return setError(body.error);
    const map = parseJson(draft.responseMap, "Javob xaritasi");
    if ("error" in map) return setError(map.error);

    setBusy(true);
    setError("");
    setNotice("");

    const payload = {
      name: draft.name.trim(),
      method: draft.method,
      url: draft.url.trim(),
      ...(headers.value ? { headers: headers.value } : {}),
      ...(body.value ? { bodyTemplate: body.value } : {}),
      ...(map.value ? { responseMap: map.value } : {}),
    };

    const result = draft.id
      ? await api(`/api/bots/${botId}/mini-app/endpoints/${draft.id}`, {
          method: "PATCH",
          json: payload,
        })
      : await api(`/api/bots/${botId}/mini-app/endpoints`, { json: payload });

    setBusy(false);
    if (!result.ok) {
      setError(result.error === "network" ? "Tarmoq xatosi" : result.error);
      return;
    }
    setDraft(null);
    setNotice("Saqlandi");
    onChanged();
  }

  async function remove(id: string) {
    if (!window.confirm("Bu API amali o'chirilsinmi?")) return;
    setBusy(true);
    setError("");
    const result = await api(`/api/bots/${botId}/mini-app/endpoints/${id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice("O'chirildi");
    onChanged();
  }

  async function saveAllowlist() {
    setBusy(true);
    setError("");
    const result = await api(`/api/bots/${botId}/mini-app/endpoints`, {
      method: "PATCH",
      json: { allowlist: domains.split(",").map((item) => item.trim()).filter(Boolean) },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice("Domenlar ro'yxati saqlandi");
    onChanged();
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <p className="text-sm font-medium text-ink">API amallari</p>
        {!draft ? (
          <Button size="sm" variant="secondary" onClick={() => setDraft(EMPTY)} disabled={busy}>
            + Amal qo&apos;shish
          </Button>
        ) : null}
      </div>

      <div className="space-y-4 px-5 py-4">
        {error ? <Alert>{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        {/* Ruxsat etilgan domenlar */}
        <Field
          label="Ruxsat etilgan domenlar"
          hint="Vergul bilan ajrating. Bo'sh qoldirilsa — ichki tarmoq baribir yopiq, lekin ro'yxat bilan xavfsizroq."
        >
          <div className="flex gap-2">
            <Input
              value={domains}
              placeholder="api.example.com, shop.example.com"
              onChange={(event) => setDomains(event.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={saveAllowlist} disabled={busy}>
              Saqlash
            </Button>
          </div>
        </Field>

        {/* Ro'yxat */}
        {endpoints.length === 0 && !draft ? (
          <p className="text-sm text-ink-subtle">
            Hali amal yo&apos;q. Mini App tugmasi tashqi API&apos;ga so&apos;rov
            yuborishi uchun shu yerdan qo&apos;shing.
          </p>
        ) : null}

        {endpoints.map((endpoint) => (
          <div
            key={endpoint.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2.5"
          >
            <Badge>{endpoint.method}</Badge>
            <span className="text-sm font-medium text-ink">{endpoint.name}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-ink-subtle">
              {endpoint.url}
            </span>
            {endpoint.headerKeys.length > 0 ? (
              <span className="text-[11px] text-ink-subtle">
                {endpoint.headerKeys.length} sarlavha
              </span>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                setDraft({
                  id: endpoint.id,
                  name: endpoint.name,
                  method: endpoint.method,
                  url: endpoint.url,
                  // Qiymatlar serverda qoladi — qayta kiritilmasa o'zgarmaydi.
                  headers: "",
                  bodyTemplate: "",
                  responseMap: "",
                })
              }
            >
              Tahrirlash
            </Button>
            <Button size="sm" variant="ghost" onClick={() => remove(endpoint.id)} disabled={busy}>
              🗑
            </Button>
          </div>
        ))}

        {/* Forma */}
        {draft ? (
          <div className="space-y-3 rounded-lg border border-line-strong bg-surface-sunken p-4">
            <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
              <Field label="Metod">
                <Select
                  value={draft.method}
                  onChange={(e) => setDraft({ ...draft, method: e.target.value })}
                >
                  {METHODS.map((method) => (
                    <option key={method}>{method}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Nomi">
                <Input
                  value={draft.name}
                  placeholder="Buyurtma yuborish"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Manzil" hint="HTTPS majburiy. {{maydon}} forma qiymati bilan almashadi.">
              <Input
                value={draft.url}
                placeholder="https://api.example.com/orders"
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              />
            </Field>

            <Field
              label="Sarlavhalar (JSON)"
              hint={
                draft.id
                  ? "Bo'sh qoldirilsa avvalgi qiymatlar saqlanadi. Kalitlar serverda qoladi."
                  : 'Masalan: {"Authorization": "Bearer …"}'
              }
            >
              <Textarea
                rows={2}
                value={draft.headers}
                placeholder='{"Authorization": "Bearer …"}'
                onChange={(e) => setDraft({ ...draft, headers: e.target.value })}
              />
            </Field>

            <Field
              label="So'rov tanasi (JSON)"
              hint='Masalan: {"email": "{{email}}", "izoh": "{{izoh}}"}'
            >
              <Textarea
                rows={3}
                value={draft.bodyTemplate}
                placeholder='{"email": "{{email}}"}'
                onChange={(e) => setDraft({ ...draft, bodyTemplate: e.target.value })}
              />
            </Field>

            <Field
              label="Javob xaritasi (JSON)"
              hint='Javobdan nima olinadi. Masalan: {"raqam": "data.orderId"}'
            >
              <Textarea
                rows={2}
                value={draft.responseMap}
                placeholder='{"raqam": "data.orderId"}'
                onChange={(e) => setDraft({ ...draft, responseMap: e.target.value })}
              />
            </Field>

            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={busy || !draft.name.trim()}>
                {busy ? "Saqlanmoqda…" : "Saqlash"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(null);
                  setError("");
                }}
                disabled={busy}
              >
                Bekor qilish
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** Bo'sh matn — «o'zgartirmaslik» degani, buzilgan JSON esa aniq xato. */
function parseJson(
  raw: string,
  label: string,
): { value: Record<string, unknown> | null } | { error: string } {
  const text = raw.trim();
  if (!text) return { value: null };
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: `${label}: obyekt bo'lishi kerak` };
    }
    return { value: parsed as Record<string, unknown> };
  } catch {
    return { error: `${label}: JSON noto'g'ri` };
  }
}
