"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MiniAppSchema } from "@/lib/mini-app/schema";
import {
  applyTheme,
  waitForWebApp,
  type TelegramWebApp,
} from "@/lib/mini-app/telegram-sdk";
import { validateForm } from "@/lib/mini-app/validate-form";
import { RenderTree, type ActionPayload } from "@/components/mini-app/render";

/**
 * Telegram ichida ishlaydigan Mini App.
 *
 * Vazifalari:
 *  · Telegram SDK bilan bog'lanish (mavzu, viewport, BackButton, MainButton);
 *  · `initData` ni serverga yuborib foydalanuvchini TASDIQLATISH;
 *  · sahifalar orasida yurish va amallarni bajarish.
 *
 * Foydalanuvchi ma'lumoti klientda hech qachon «tanilgan» deb hisoblanmaydi:
 * u faqat server `/session` javobidan keladi. Telegram bo'lmagan brauzerda
 * ilova ko'rinadi, lekin tanilmagan holatda qoladi va buni ochiq aytadi.
 */

type SessionUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  languageCode: string | null;
  photoUrl: string | null;
};

type SessionState =
  | { kind: "loading" }
  | { kind: "ready"; user: SessionUser }
  /// Telegramsiz ochilgan — ilova ko'rinadi, lekin shaxs tasdiqlanmagan
  | { kind: "anonymous" }
  | { kind: "error"; message: string };

export function MiniAppRuntime({ schema }: { schema: MiniAppSchema }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sdkRef = useRef<TelegramWebApp | null>(null);

  const homeSlug = useMemo(
    () => schema.pages.find((page) => page.isHome)?.slug ?? schema.pages[0]?.slug ?? "",
    [schema.pages],
  );

  const [session, setSession] = useState<SessionState>({ kind: "loading" });
  /**
   * SDK ulanib bo'ldimi.
   *
   * Ref render paytida o'qilmaydi (React uni taqiqlaydi va qiymat o'zgarganda
   * qayta chizilmaydi ham) — shuning uchun «Telegram ichidamizmi» degan savol
   * alohida holatda turadi. BackButton/MainButton effektlari ham shu bayroqqa
   * bog'lanadi: aks holda ular SDK yuklanishidan oldin bir marta ishlab,
   * hech narsa ulamay qolardi.
   */
  const [insideTelegram, setInsideTelegram] = useState(false);
  const [stack, setStack] = useState<string[]>([homeSlug]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /// Maydon ostida ko'rinadigan xatolar — umumiy banner o'rniga aniq joyda
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  /// API javobidan qaytgan qiymatlar — sahifada ko'rsatish uchun
  const [apiResult, setApiResult] = useState<Record<string, unknown> | null>(null);

  const currentSlug = stack[stack.length - 1] ?? homeSlug;
  const page = useMemo(
    () => schema.pages.find((candidate) => candidate.slug === currentSlug) ?? schema.pages[0],
    [schema.pages, currentSlug],
  );

  /* ── Telegram bilan bog'lanish ─────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const sdk = await waitForWebApp();
      if (cancelled) return;
      sdkRef.current = sdk;

      const root = rootRef.current ?? document.documentElement;
      applyTheme(root, sdk?.themeParams, sdk?.colorScheme ?? "light");
      if (schema.theme.radius !== undefined) {
        root.style.setProperty("--app-radius", `${schema.theme.radius}px`);
      }
      if (schema.theme.accent) {
        root.style.setProperty("--tg-button", schema.theme.accent);
      }

      if (!sdk) {
        // Oddiy brauzerda ochilgan: imzo yo'q, demak hech kimni tanib
        // bo'lmaydi. Bu xato emas — ilova ko'rinadi, holat ochiq aytiladi.
        setSession({ kind: "anonymous" });
        return;
      }

      sdk.ready();
      sdk.expand();
      setInsideTelegram(true);

      // Mavzu almashsa (foydalanuvchi dark rejimga o'tsa) darhol yangilanadi.
      const onTheme = () => applyTheme(root, sdk.themeParams, sdk.colorScheme);
      sdk.onEvent("themeChanged", onTheme);

      try {
        const response = await fetch(`/api/mini-app/${schema.id}/session`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData: sdk.initData }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          user?: SessionUser;
          error?: string;
        };
        if (cancelled) return;

        if (!response.ok || !body.user) {
          setSession({
            kind: "error",
            message: body.error ?? "Telegram ulanishi tasdiqlanmadi",
          });
          return;
        }
        setSession({ kind: "ready", user: body.user });
      } catch {
        if (!cancelled) {
          setSession({ kind: "error", message: "Tarmoq bilan bog'lanib bo'lmadi" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schema.id, schema.theme.accent, schema.theme.radius]);

  /* ── Amallar ───────────────────────────────────────────────────────────── */

  const goTo = useCallback(
    (slug: string) => {
      if (!schema.pages.some((candidate) => candidate.slug === slug)) return;
      setStack((current) =>
        current[current.length - 1] === slug ? current : [...current, slug],
      );
      setNotice(null);
    },
    [schema.pages],
  );

  const goBack = useCallback(() => {
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
    setNotice(null);
  }, []);

  /** Botga xabar yuborish — server tomonda bot tokeni bilan bajariladi. */
  const sendToBot = useCallback(
    async (text: string, payload?: Record<string, string>) => {
      const sdk = sdkRef.current;
      if (!sdk) {
        setNotice("Bu amal faqat Telegram ichida ishlaydi");
        return;
      }
      setBusy(true);
      try {
        const response = await fetch(`/api/mini-app/${schema.id}/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData: sdk.initData, text, payload }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setNotice(body.error ?? "Xabar yuborilmadi");
          return;
        }
        setNotice(null);
        sdk.close();
      } catch {
        setNotice("Tarmoq bilan bog'lanib bo'lmadi");
      } finally {
        setBusy(false);
      }
    },
    [schema.id],
  );

  /** Sozlangan API endpointini chaqiradi — manzil serverda turadi. */
  const callApi = useCallback(
    async (endpointId: string, formValues: Record<string, string>, thenPage?: string) => {
      const sdk = sdkRef.current;
      if (!sdk) {
        setNotice("Bu amal faqat Telegram ichida ishlaydi");
        return;
      }
      setBusy(true);
      setNotice(null);
      setFieldErrors({});
      try {
        const response = await fetch(`/api/mini-app/${schema.id}/action`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            initData: sdk.initData,
            endpointId,
            pageSlug: currentSlug,
            values: formValues,
          }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          data?: Record<string, unknown>;
          error?: string;
          details?: { name: string; message: string }[];
        };

        if (!response.ok) {
          // Server maydon bo'yicha xato qaytargan bo'lsa — uni maydon ostida
          // ko'rsatamiz, umumiy banner emas.
          if (body.details?.length) {
            setFieldErrors(
              Object.fromEntries(body.details.map((item) => [item.name, item.message])),
            );
          }
          setNotice(body.error ?? "So'rov bajarilmadi");
          return;
        }

        setApiResult(body.data ?? {});
        if (thenPage) goTo(thenPage);
      } catch {
        setNotice("Tarmoq bilan bog'lanib bo'lmadi");
      } finally {
        setBusy(false);
      }
    },
    [schema.id, currentSlug, goTo],
  );

  const runAction = useCallback(
    ({ action, values: formValues }: ActionPayload) => {
      const sdk = sdkRef.current;
      const values = formValues ?? {};

      /** Yuborishdan oldingi tekshiruv — server ham xuddi shu qoidani takrorlaydi. */
      const formIsValid = () => {
        const errors = validateForm(page?.components ?? [], values);
        if (errors.length === 0) {
          setFieldErrors({});
          return true;
        }
        setFieldErrors(Object.fromEntries(errors.map((item) => [item.name, item.message])));
        setNotice(errors[0].message);
        return false;
      };

      switch (action.kind) {
        case "open_page":
          if (action.page) goTo(action.page);
          return;

        case "open_url":
          if (!action.url) return;
          // Telegram havolani o'zi ochadi; brauzerda oddiy yo'l ishlatiladi.
          if (sdk) sdk.openLink(action.url);
          else window.open(action.url, "_blank", "noopener,noreferrer");
          return;

        case "send_message":
          void sendToBot(action.text?.trim() || "Mini App'dan xabar");
          return;

        case "submit_form":
          if (!formIsValid()) return;
          void sendToBot(action.text?.trim() || "Forma yuborildi", values);
          return;

        case "api_request":
          if (!action.endpointId) {
            setNotice("Bu tugmaga API amali ulanmagan");
            return;
          }
          if (!formIsValid()) return;
          void callApi(action.endpointId, values, action.thenPage);
          return;

        case "close_app":
          if (sdk) sdk.close();
          else setNotice("Bu amal faqat Telegram ichida ishlaydi");
          return;

        case "none":
        default:
          return;
      }
    },
    [goTo, page?.components, sendToBot, callApi],
  );

  /**
   * Sahifa ko'rish hodisasi.
   *
   * Faqat sessiya tasdiqlangandan keyin yoziladi — tanilmagan ochilish
   * ko'rsatkichlarni buzmasligi kerak. Yozib bo'lmasa jimgina o'tib
   * ketamiz: analitika asosiy oqimni to'xtatmaydi.
   */
  useEffect(() => {
    const sdk = sdkRef.current;
    if (session.kind !== "ready" || !sdk || !currentSlug) return;

    const controller = new AbortController();
    void fetch(`/api/mini-app/${schema.id}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        initData: sdk.initData,
        eventType: "page_view",
        pageSlug: currentSlug,
      }),
      signal: controller.signal,
    }).catch(() => undefined);

    return () => controller.abort();
  }, [schema.id, currentSlug, session.kind]);

  /* ── Telegram tugmalari ────────────────────────────────────────────────── */

  useEffect(() => {
    const sdk = sdkRef.current;
    if (!sdk) return;

    // «Orqaga» — Telegram'ning o'z tugmasi, ilova ichida ortiqcha tugma kerak emas.
    if (stack.length > 1) {
      sdk.BackButton.show();
      sdk.BackButton.onClick(goBack);
      return () => {
        sdk.BackButton.offClick(goBack);
        sdk.BackButton.hide();
      };
    }
    sdk.BackButton.hide();
  }, [stack.length, goBack, insideTelegram]);

  useEffect(() => {
    const sdk = sdkRef.current;
    const text = schema.settings.mainButtonText?.trim();
    if (!sdk || !text) return;

    const handler = () =>
      runAction({ action: schema.settings.mainButtonAction, values });

    sdk.MainButton.setText(text).show().onClick(handler);
    return () => {
      sdk.MainButton.offClick(handler);
      sdk.MainButton.hide();
    };
  }, [
    schema.settings.mainButtonText,
    schema.settings.mainButtonAction,
    runAction,
    values,
    insideTelegram,
  ]);

  /* ── Ko'rinish ─────────────────────────────────────────────────────────── */

  const ctx = {
    onAction: runAction,
    values,
    onChange: (name: string, value: string) => {
      setValues((current) => ({ ...current, [name]: value }));
      // Foydalanuvchi tuzatishni boshlagach eski xato yo'qoladi.
      setFieldErrors((current) =>
        current[name] ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== name)) : current,
      );
    },
    errors: fieldErrors,
    busy,
    interactive: true,
  };

  return (
    <div
      ref={rootRef}
      style={{
        minHeight: "100dvh",
        background: "var(--tg-bg)",
        color: "var(--tg-text)",
        // Telegram'da tepada/pastda tizim paneli bo'lishi mumkin
        padding: "env(safe-area-inset-top) 0 env(safe-area-inset-bottom)",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 32px" }}>
        {schema.settings.headerTitle?.trim() ? (
          <p
            style={{
              margin: "0 0 12px",
              fontSize: "1.15rem",
              fontWeight: 600,
              color: "var(--tg-text)",
            }}
          >
            {schema.settings.headerTitle}
          </p>
        ) : null}

        {session.kind === "error" ? (
          <Banner tone="error">{session.message}</Banner>
        ) : null}
        {session.kind === "anonymous" ? (
          <Banner tone="hint">
            Telegram tashqarisida ochildi — ba&apos;zi amallar ishlamaydi.
          </Banner>
        ) : null}
        {notice ? <Banner tone="hint">{notice}</Banner> : null}
        {apiResult ? (
          <ApiResult data={apiResult} onDismiss={() => setApiResult(null)} />
        ) : null}

        {page ? (
          <RenderTree nodes={page.components} ctx={ctx} />
        ) : (
          <Banner tone="hint">Sahifa topilmadi.</Banner>
        )}

        {page && page.components.length === 0 ? (
          <p style={{ color: "var(--tg-hint)", fontSize: "0.9rem", textAlign: "center" }}>
            Bu sahifa hali bo&apos;sh.
          </p>
        ) : null}

        {/* Telegramsiz ochilganda ilova ichida ham «orqaga» bo'lishi kerak */}
        {!insideTelegram && stack.length > 1 ? (
          <button
            type="button"
            onClick={goBack}
            style={{
              marginTop: 16,
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid var(--tg-section-separator)",
              background: "var(--tg-secondary-bg)",
              color: "var(--tg-text)",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            ← Orqaga
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * API javobi.
 *
 * Faqat oddiy qiymatlar (matn/son/mantiqiy) ko'rsatiladi — ichma-ich obyekt
 * foydalanuvchiga JSON bo'lib chiqib ketmasligi kerak. Egasi kerakli
 * maydonlarni endpoint sozlamasidagi «response mapping» bilan tanlaydi.
 */
function ApiResult({
  data,
  onDismiss,
}: {
  data: Record<string, unknown>;
  onDismiss: () => void;
}) {
  const rows = Object.entries(data).filter(
    ([, value]) =>
      typeof value === "string" || typeof value === "number" || typeof value === "boolean",
  );

  return (
    <div
      style={{
        margin: "0 0 12px",
        padding: "10px 12px",
        borderRadius: 10,
        background: "var(--tg-secondary-bg)",
        fontSize: "0.85rem",
        lineHeight: 1.5,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#16a34a", fontWeight: 500 }}>✓ Bajarildi</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Yopish"
          style={{
            marginLeft: "auto",
            border: "none",
            background: "transparent",
            color: "var(--tg-hint)",
            cursor: "pointer",
            fontSize: "1rem",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      {rows.length > 0 ? (
        <dl style={{ margin: "6px 0 0", display: "grid", gap: 2 }}>
          {rows.map(([key, value]) => (
            <div key={key} style={{ display: "flex", gap: 6 }}>
              <dt style={{ color: "var(--tg-hint)" }}>{key}:</dt>
              <dd style={{ margin: 0, color: "var(--tg-text)" }}>{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "error" | "hint";
  children: React.ReactNode;
}) {
  return (
    <p
      style={{
        margin: "0 0 12px",
        padding: "9px 12px",
        borderRadius: 10,
        fontSize: "0.85rem",
        lineHeight: 1.45,
        background: tone === "error" ? "#f43f5e1a" : "var(--tg-secondary-bg)",
        color: tone === "error" ? "#e11d48" : "var(--tg-hint)",
      }}
    >
      {children}
    </p>
  );
}

