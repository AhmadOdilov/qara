"use client";

import type { CSSProperties } from "react";
import {
  isHttpsUrl,
  type ComponentProps,
  type MiniAppComponent,
} from "@/lib/mini-app/schema";

/**
 * Komponent daraxtini chizadi.
 *
 * SOF ko'rinish: bu yerda tarmoq ham, holat ham yo'q — amallar `onAction`
 * orqali tepaga uzatiladi. Shu sababli AYNAN shu renderer ikki joyda
 * ishlatiladi: konstruktordagi jonli preview va Telegram ochadigan haqiqiy
 * Mini App. Ikkalasi bitta koddan chiqqani uchun preview yolg'on gapirmaydi.
 *
 * Ranglar Telegram mavzusidan keladi (`--tg-*` CSS o'zgaruvchilari), shuning
 * uchun ilova foydalanuvchining light/dark rejimiga o'zi moslashadi.
 */

export type ActionPayload = {
  action: ComponentProps["button"]["action"];
  /// Forma yuborilganda — sahifadagi input qiymatlari
  values?: Record<string, string>;
};

export type RenderContext = {
  onAction: (payload: ActionPayload) => void;
  /// Input qiymatlari yuqorida saqlanadi: `submit_form` ularni yig'ib yuboradi
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  /// Maydon nomi → xato matni. Xato aynan maydon ostida ko'rinadi.
  errors?: Record<string, string>;
  /// So'rov ketayotganda tugmada holat ko'rsatiladi
  busy?: boolean;
  /// Konstruktor rejimida tanlangan element ajratib ko'rsatiladi
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /// Konstruktorda amallar bajarilmaydi — faqat ko'rinish
  interactive: boolean;
};

export function RenderTree({
  nodes,
  ctx,
  depth = 0,
}: {
  nodes: MiniAppComponent[];
  ctx: RenderContext;
  depth?: number;
}) {
  return (
    <>
      {nodes.map((node) => (
        <RenderNode key={node.id} node={node} ctx={ctx} depth={depth} />
      ))}
    </>
  );
}

function RenderNode({
  node,
  ctx,
  depth,
}: {
  node: MiniAppComponent;
  ctx: RenderContext;
  depth: number;
}) {
  const selected = ctx.selectedId === node.id;

  // Konstruktorda element bosilsa tanlanadi; jonli ilovada bu qatlam yo'q.
  const wrapper = ctx.onSelect
    ? {
        onClick: (event: React.MouseEvent) => {
          event.stopPropagation();
          ctx.onSelect?.(node.id);
        },
        style: selected
          ? { outline: "2px solid var(--tg-link)", outlineOffset: 2, borderRadius: 8 }
          : undefined,
        role: "presentation" as const,
      }
    : {};

  return (
    <div {...wrapper}>
      <NodeBody node={node} ctx={ctx} depth={depth} />
    </div>
  );
}

function NodeBody({
  node,
  ctx,
  depth,
}: {
  node: MiniAppComponent;
  ctx: RenderContext;
  depth: number;
}) {
  switch (node.type) {
    case "heading": {
      const { text, level, align } = node.props;
      const size = level === 1 ? "1.5rem" : level === 2 ? "1.25rem" : "1.05rem";
      return (
        <p
          style={{
            fontSize: size,
            fontWeight: 600,
            textAlign: align,
            color: "var(--tg-text)",
            margin: "0 0 8px",
            lineHeight: 1.3,
          }}
        >
          {text}
        </p>
      );
    }

    case "text": {
      const { text, size, align, muted } = node.props;
      return (
        <p
          style={{
            fontSize: size === "sm" ? "0.85rem" : size === "lg" ? "1.05rem" : "0.95rem",
            textAlign: align,
            color: muted ? "var(--tg-hint)" : "var(--tg-text)",
            margin: "0 0 8px",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </p>
      );
    }

    case "image": {
      const { url, alt, height, radius } = node.props;
      // Yaroqsiz manzil bilan buzilgan rasm belgisi chiqmasin — o'rniga
      // tushunarli joy egallovchi turadi.
      if (!isHttpsUrl(url)) {
        return (
          <div
            style={{
              height,
              borderRadius: radius,
              background: "var(--tg-secondary-bg)",
              display: "grid",
              placeItems: "center",
              color: "var(--tg-hint)",
              fontSize: "0.8rem",
              marginBottom: 8,
            }}
          >
            Rasm manzili ko&apos;rsatilmagan
          </div>
        );
      }
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          style={{
            width: "100%",
            height,
            objectFit: "cover",
            borderRadius: radius,
            display: "block",
            marginBottom: 8,
          }}
        />
      );
    }

    case "button": {
      const { text, variant, size, fullWidth, action } = node.props;
      // Uzoq amallarda tugma o'zi holatini ko'rsatadi — foydalanuvchi
      // «bosildimi?» deb ikkinchi marta bosmasin.
      const waiting = Boolean(ctx.busy) && isAsyncAction(action.kind);
      return (
        <button
          type="button"
          disabled={!ctx.interactive || Boolean(ctx.busy)}
          onClick={() => ctx.interactive && ctx.onAction({ action, values: ctx.values })}
          style={{
            ...buttonStyle(variant, size),
            width: fullWidth ? "100%" : "auto",
            marginBottom: 8,
            opacity: ctx.busy ? 0.6 : 1,
          }}
        >
          {waiting ? "Yuborilmoqda…" : text}
        </button>
      );
    }

    case "input": {
      const { name, label, placeholder, type, required } = node.props;
      const value = ctx.values[name] ?? "";
      const error = ctx.errors?.[name];
      const shared: CSSProperties = {
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${error ? "#e11d48" : "var(--tg-section-separator)"}`,
        background: "var(--tg-bg)",
        color: "var(--tg-text)",
        fontSize: "0.95rem",
        fontFamily: "inherit",
        outline: "none",
      };
      return (
        <div style={{ marginBottom: 10 }}>
          {label ? (
            <label
              htmlFor={`f_${node.id}`}
              style={{
                display: "block",
                fontSize: "0.8rem",
                color: "var(--tg-hint)",
                marginBottom: 4,
              }}
            >
              {label}
              {required ? " *" : ""}
            </label>
          ) : null}
          {type === "textarea" ? (
            <textarea
              id={`f_${node.id}`}
              value={value}
              placeholder={placeholder}
              rows={3}
              onChange={(event) => ctx.onChange(name, event.target.value)}
              style={{ ...shared, resize: "vertical" }}
            />
          ) : (
            <input
              id={`f_${node.id}`}
              type={type}
              value={value}
              placeholder={placeholder}
              aria-invalid={error ? true : undefined}
              onChange={(event) => ctx.onChange(name, event.target.value)}
              style={shared}
            />
          )}
          {error ? (
            <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#e11d48" }}>
              {error}
            </p>
          ) : null}
        </div>
      );
    }

    case "product": {
      const { title, description, price, currency, image, buttonText, action } = node.props;
      return (
        <div
          style={{
            border: "1px solid var(--tg-section-separator)",
            borderRadius: 14,
            overflow: "hidden",
            background: "var(--tg-section-bg)",
            marginBottom: 10,
          }}
        >
          {isHttpsUrl(image) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={title}
              style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }}
            />
          ) : null}
          <div style={{ padding: 12 }}>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--tg-text)" }}>{title}</p>
            {description ? (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "0.85rem",
                  color: "var(--tg-hint)",
                  lineHeight: 1.45,
                }}
              >
                {description}
              </p>
            ) : null}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginTop: 10,
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--tg-text)" }}>
                {formatPrice(price, currency)}
              </span>
              <button
                type="button"
                disabled={!ctx.interactive}
                onClick={() => ctx.interactive && ctx.onAction({ action, values: ctx.values })}
                style={buttonStyle("primary", "sm")}
              >
                {buttonText}
              </button>
            </div>
          </div>
        </div>
      );
    }

    case "divider":
      return (
        <hr
          style={{
            border: "none",
            borderTop: "1px solid var(--tg-section-separator)",
            margin: `${node.props.spacing}px 0`,
          }}
        />
      );

    case "spacer":
      return <div style={{ height: node.props.height }} />;

    case "container": {
      const { direction, gap, padding } = node.props;
      return (
        <div
          style={{
            display: "flex",
            flexDirection: direction,
            gap,
            padding,
            marginBottom: 8,
            // Qator rejimida elementlar mobil ekranda siqilib ketmasin
            flexWrap: direction === "row" ? "wrap" : "nowrap",
          }}
        >
          {node.children?.length ? (
            <RenderTree nodes={node.children} ctx={ctx} depth={depth + 1} />
          ) : null}
        </div>
      );
    }
  }
}

/** Tarmoqqa chiqadigan amallar — tugma «yuborilmoqda» holatini ko'rsatadi. */
function isAsyncAction(kind: string): boolean {
  return kind === "api_request" || kind === "submit_form" || kind === "send_message";
}

/* ── Uslub ───────────────────────────────────────────────────────────────── */

function buttonStyle(
  variant: "primary" | "secondary" | "ghost",
  size: "sm" | "md" | "lg",
): CSSProperties {
  const padding = size === "sm" ? "7px 12px" : size === "lg" ? "13px 18px" : "10px 16px";
  const fontSize = size === "sm" ? "0.85rem" : size === "lg" ? "1rem" : "0.95rem";

  const palette: Record<typeof variant, CSSProperties> = {
    primary: { background: "var(--tg-button)", color: "var(--tg-button-text)" },
    secondary: {
      background: "var(--tg-secondary-bg)",
      color: "var(--tg-text)",
      border: "1px solid var(--tg-section-separator)",
    },
    ghost: { background: "transparent", color: "var(--tg-link)" },
  };

  return {
    padding,
    fontSize,
    fontWeight: 500,
    borderRadius: "var(--app-radius, 12px)",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    lineHeight: 1.2,
    ...palette[variant],
  };
}

/** `12500 UZS` → `12 500 so'm` — botdagi `formatMoney` bilan bir xil ko'rinish. */
function formatPrice(amount: number, currency: string): string {
  const rounded = Math.round(Number.isFinite(amount) ? amount : 0);
  const grouped = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const unit = currency.toUpperCase() === "UZS" ? "so'm" : currency.toUpperCase();
  return `${rounded < 0 ? "-" : ""}${grouped} ${unit}`;
}
