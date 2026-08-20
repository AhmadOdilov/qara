"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/provider";
import {
  backTargetFor,
  cartView,
  favoritesView,
  helpView,
  menuView,
  ordersView,
  productView,
  profileView,
} from "@/lib/bots/buttons/navigation";
import type { ButtonRecord, ReplyMarkup } from "@/lib/bots/buttons/types";
import { EMPTY_CART } from "@/lib/bots/buttons/cart";
import type { ViewerContext } from "@/lib/bots/buttons/visibility";

/**
 * Telegram preview (§10).
 *
 * Klaviatura bu yerda QO'LDA yasalmaydi: aynan botning o'zi ishlatadigan
 * `navigation`/`compiler` modullari chaqiriladi. Shu sababli preview jonli
 * botdan ajralib qolishi mumkin emas — qator bo'linishi, «orqaga»/«bosh
 * menyu» tugmalari va ko'rinish qoidalari bir xil kodda hisoblanadi.
 */

export type PreviewTarget =
  | { kind: "menu"; menuId: string | null }
  | { kind: "product"; buttonId: string }
  | { kind: "cart"; menuId: string | null }
  | { kind: "orders"; menuId: string | null }
  | { kind: "favorites"; menuId: string | null }
  | { kind: "profile"; menuId: string | null }
  | { kind: "help"; menuId: string | null; text: string | null };

export function TelegramPreview({
  buttons,
  target,
  asAdmin,
  lang,
  botName,
}: {
  buttons: ButtonRecord[];
  target: PreviewTarget;
  asAdmin: boolean;
  lang: string;
  botName: string;
}) {
  const { t } = useI18n();

  const view = useMemo(() => {
    const viewer: ViewerContext = {
      telegramUserId: "preview",
      username: "preview",
      languageCode: lang,
      phone: null,
      email: null,
      tags: asAdmin ? ["admin"] : [],
      messageCount: 10,
      isAdmin: asAdmin,
    };
    const request = { viewer, rootText: t.builder.previewRoot };

    if (target.kind === "product") {
      const button = buttons.find((candidate) => candidate.id === target.buttonId);
      if (button) return productView(buttons, button, request);
    }
    // Tizim ekranlari sof funksiyalar: preview'da bo'sh ma'lumot bilan
    // chaqiriladi va egasi ekranning bo'sh holatini aynan foydalanuvchi
    // ko'radigan shaklda ko'radi (§14).
    if (target.kind === "cart") {
      return cartView(buttons, EMPTY_CART, target.menuId, request);
    }
    if (target.kind === "orders") {
      return ordersView(buttons, [], target.menuId, request);
    }
    if (target.kind === "favorites") {
      return favoritesView(buttons, [], target.menuId, request);
    }
    if (target.kind === "profile") {
      return profileView(null, target.menuId, request);
    }
    if (target.kind === "help") {
      return helpView(target.text, target.menuId, request);
    }

    const menuId = target.kind === "menu" ? target.menuId : null;
    return menuView(buttons, menuId, backTargetFor(buttons, menuId), request);
  }, [buttons, target, asAdmin, lang, t.builder.previewRoot]);

  const rows = keyboardRows(view.markup);

  return (
    <div className="rounded-xl bg-surface-inset p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
          {botName.slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate text-xs font-medium text-ink-muted">{botName}</span>
      </div>

      <div className="max-w-[19rem] space-y-1.5">
        <div className="rounded-2xl rounded-tl-sm border border-line bg-surface px-3 py-2">
          <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-ink">
            {view.text}
          </p>
        </div>

        {rows.length > 0 ? (
          <div className={cn("space-y-1", isReply(view.markup) && "pt-1")}>
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1">
                {row.map((label, index) => (
                  <span
                    key={`${rowIndex}-${index}`}
                    className={cn(
                      "flex min-w-0 flex-1 items-center justify-center rounded-lg px-2 py-1.5 text-center text-[12px] font-medium",
                      isReply(view.markup)
                        ? "bg-surface-inset text-ink ring-1 ring-line-strong"
                        : "bg-accent-soft text-accent",
                    )}
                  >
                    <span className="truncate">{label}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="px-1 text-[11px] text-ink-subtle">{t.builder.empty}</p>
        )}
      </div>

      <p className="mt-3 text-[11px] text-ink-subtle">
        {isReply(view.markup) ? t.builder.keyboard_reply : t.builder.keyboard_inline}
      </p>
    </div>
  );
}

/* ── Yordamchilar ────────────────────────────────────────────────────────── */

function isReply(markup: ReplyMarkup): boolean {
  return "keyboard" in markup;
}

/** Kompilyator natijasidan yorliqlar jadvalini oladi. */
function keyboardRows(markup: ReplyMarkup): string[][] {
  if ("inline_keyboard" in markup) {
    return markup.inline_keyboard.map((row) => row.map((button) => button.text));
  }
  if ("keyboard" in markup) {
    return markup.keyboard.map((row) => row.map((button) => button.text));
  }
  return [];
}
