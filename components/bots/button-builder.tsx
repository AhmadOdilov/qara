"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/client";
import { fill } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import type { TemplateOutline } from "@/lib/bots/buttons/templates";
import { childrenOf, isMenuButton, menuPath, subtreeIds } from "@/lib/bots/buttons/menu";
import type { Issue, ValidationResult } from "@/lib/bots/buttons/validate";
import {
  ACTION_TYPES,
  AUDIENCES,
  buttonLabel,
  isPendingAction,
  KEYBOARD_KINDS,
  menuConfig,
  opensMenu,
  productConfig,
  typesForKeyboard,
  type ActionType,
  type Audience,
  type ButtonRecord,
  type ButtonType,
  type KeyboardKind,
} from "@/lib/bots/buttons/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Textarea,
  Toggle,
} from "@/components/ui";
import { IconArrowRight, IconCopy, IconPlus, IconTrash } from "@/components/icons";
import { MenuTree, type DropPosition } from "@/components/bots/menu-tree";
import {
  TelegramPreview,
  type PreviewTarget,
} from "@/components/bots/telegram-preview";

/**
 * Vizual menyu konstruktori (§4).
 *
 * Chapda — butun menyu daraxti (sudrab ko'chirish bilan), o'ngda — tanlangan
 * tugmaning sozlamalari va jonli Telegram preview'i. Preview botning o'zi
 * ishlatadigan kompilyatordan chiqadi, shuning uchun ko'rilgan narsa
 * yuborilgan narsa bilan bir xil bo'ladi.
 *
 * Boshlang'ich holat serverdan prop sifatida keladi, keyingi holat esa har bir
 * o'zgarishdan so'ng `GET /buttons` orqali qayta o'qiladi. Ikkalasi ham bitta
 * `loadBuilderState` funksiyasidan chiqadi — shuning uchun interfeys serverdagi
 * holatdan ajralib qolmaydi (masalan `sortOrder` ni server o'zi belgilaydi).
 */

export type ButtonStats = Record<string, { shown: number; clicks: number }>;

export type PublishDiff = {
  added: number;
  updated: number;
  removed: number;
  hasChanges: boolean;
};

export type BuilderState = {
  buttons: ButtonRecord[];
  diff: PublishDiff;
  publishedVersion: number;
  stats: ButtonStats;
  validation: ValidationResult;
};

type VersionRow = {
  id: string;
  version: number;
  publishedAt: string;
};

type Draft = {
  text: string;
  emoji: string;
  keyboardKind: KeyboardKind;
  buttonType: ButtonType;
  actionType: ActionType;
  replyText: string;
  url: string;
  rowIndex: number;
  audience: Audience;
  enabled: boolean;
  adminOnly: boolean;
  /// Menyu tuguni sozlamalari
  title: string;
  description: string;
  emptyText: string;
  targetId: string;
  /// 0 — qo'lda (rowIndex bo'yicha)
  layout: number;
  showHome: boolean;
  /// Mahsulot
  price: string;
  currency: string;
  stock: string;
  buyNow: boolean;
  photoUrl: string;
  productId: string;
};

const EMPTY_DRAFT: Draft = {
  text: "",
  emoji: "",
  keyboardKind: "inline",
  buttonType: "callback",
  actionType: "send_message",
  replyText: "",
  url: "",
  rowIndex: 0,
  audience: "everyone",
  enabled: true,
  adminOnly: false,
  title: "",
  description: "",
  emptyText: "",
  targetId: "",
  layout: 0,
  showHome: false,
  price: "",
  currency: "UZS",
  stock: "",
  buyNow: true,
  photoUrl: "",
  productId: "",
};

/** Tugmalar joyini bitta so'rovda o'zgartirish uchun payload. */
type MoveItem = { id: string; parentId: string | null; rowIndex: number; sortOrder: number };

export function ButtonBuilder({
  botId,
  botName,
  initial,
  templates,
  suggestedTemplateId,
}: {
  botId: string;
  botName?: string;
  initial: BuilderState;
  templates: TemplateOutline[];
  suggestedTemplateId: string | null;
}) {
  const { t, lang } = useI18n();

  const [state, setState] = useState<BuilderState>(initial);
  /// Tanlangan tugma
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /// Yangi tugma qaysi menyuga qo'shiladi (`undefined` — forma yopiq)
  const [adding, setAdding] = useState<{ parentId: string | null } | null>(null);
  const [asAdmin, setAsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const { buttons } = state;

  const selected = useMemo(
    () => buttons.find((button) => button.id === selectedId) ?? null,
    [buttons, selectedId],
  );

  /** Preview tanlangan tugmadan kelib chiqadi — kontekstda ko'rinadi. */
  const previewTarget = useMemo<PreviewTarget>(() => {
    if (adding) return { kind: "menu", menuId: adding.parentId };
    if (!selected) return { kind: "menu", menuId: null };
    if (selected.actionType === "product") {
      return { kind: "product", buttonId: selected.id };
    }
    if (selected.actionType === "view_cart" || selected.actionType === "checkout") {
      return { kind: "cart", menuId: selected.parentId };
    }
    if (selected.actionType === "my_orders") return { kind: "orders", menuId: selected.parentId };
    if (selected.actionType === "favorites") {
      return { kind: "favorites", menuId: selected.parentId };
    }
    if (selected.actionType === "profile") return { kind: "profile", menuId: selected.parentId };
    if (selected.actionType === "help") {
      const text = (selected.actionConfig as { text?: string }).text ?? null;
      return { kind: "help", menuId: selected.parentId, text };
    }
    if (isMenuButton(buttons, selected)) return { kind: "menu", menuId: selected.id };
    return { kind: "menu", menuId: selected.parentId };
  }, [adding, buttons, selected]);

  async function refresh(): Promise<boolean> {
    const result = await api<BuilderState>(`/api/bots/${botId}/buttons`);
    if (!result.ok) {
      setError(result.error === "network" ? t.errors.network : result.error);
      return false;
    }
    setState(result.data);
    return true;
  }

  /** Har bir mutatsiya uchun bir xil qobiq: xato, band holati, qayta o'qish. */
  async function run(
    call: () => Promise<{ ok: true } | { ok: false; error: string }>,
    message?: string,
  ): Promise<boolean> {
    setBusy(true);
    setError("");
    setNotice("");

    const result = await call();
    if (!result.ok) {
      setBusy(false);
      setError(result.error === "network" ? t.errors.network : result.error);
      return false;
    }

    const reloaded = await refresh();
    setBusy(false);
    if (reloaded && message) setNotice(message);
    return reloaded;
  }

  /* ── Amallar ───────────────────────────────────────────────────────────── */

  async function save(draft: Draft, id: string | null, parentId: string | null) {
    const payload = {
      text: draft.text.trim(),
      emoji: draft.emoji.trim() || null,
      parentId,
      keyboardKind: draft.keyboardKind,
      buttonType: draft.buttonType,
      actionType: draft.actionType,
      actionConfig: buildConfig(draft),
      rowIndex: draft.rowIndex,
      visibility: { audience: draft.audience, tags: [] },
      conditions: [],
      enabled: draft.enabled,
      adminOnly: draft.adminOnly,
    };

    const done = await run(() =>
      id
        ? api(`/api/bots/${botId}/buttons/${id}`, { method: "PATCH", json: payload })
        : api(`/api/bots/${botId}/buttons`, { json: payload }),
    );
    if (done) setAdding(null);
  }

  async function remove(id: string) {
    if (!window.confirm(t.builder.removeConfirm)) return;
    const gone = new Set(subtreeIds(buttons, id));
    const done = await run(() =>
      api(`/api/bots/${botId}/buttons/${id}`, { method: "DELETE" }),
    );
    if (done && selectedId && gone.has(selectedId)) setSelectedId(null);
  }

  async function duplicate(id: string) {
    await run(() =>
      api(`/api/bots/${botId}/buttons/${id}?action=duplicate`, { method: "POST" }),
    );
  }

  async function applyMove(items: MoveItem[]) {
    if (items.length === 0) return;
    await run(() =>
      api(`/api/bots/${botId}/buttons/reorder`, { method: "PATCH", json: { items } }),
    );
  }

  function move(dragId: string, targetId: string | null, position: DropPosition) {
    void applyMove(planMove(buttons, dragId, targetId, position));
  }

  /* ── Ko'rinish ─────────────────────────────────────────────────────────── */

  const trail = selected ? menuPath(buttons, selected.parentId) : [];
  const errors = state.validation?.errors ?? [];
  const warnings = state.validation?.warnings ?? [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={t.builder.title}
          subtitle={t.builder.subtitle}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setAdding({ parentId: null });
                setSelectedId(null);
              }}
              disabled={busy}
            >
              <IconPlus width={15} height={15} />
              {t.builder.addRoot}
            </Button>
          }
        />

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t.builder.treeTitle}
            </h3>
            <MenuTree
              buttons={buttons}
              selectedId={selectedId}
              busy={busy}
              onSelect={(id) => {
                setSelectedId(id);
                setAdding(null);
              }}
              onMove={move}
              onAddInto={(menuId) => {
                setAdding({ parentId: menuId });
                setSelectedId(null);
              }}
            />
          </section>

          <section className="space-y-4">
            <div className="space-y-2">
              <h3 className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {t.builder.previewTitle}
                <label className="flex items-center gap-1.5 text-[11px] font-normal normal-case tracking-normal text-ink-muted">
                  <input
                    type="checkbox"
                    checked={asAdmin}
                    onChange={(event) => setAsAdmin(event.target.checked)}
                    className="size-3.5 accent-[var(--accent)]"
                  />
                  {t.builder.previewAsAdmin}
                </label>
              </h3>
              <TelegramPreview
                buttons={buttons}
                target={previewTarget}
                asAdmin={asAdmin}
                lang={lang}
                botName={botName ?? t.builder.previewRoot}
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {t.builder.configTitle}
              </h3>

              {trail.length > 0 ? (
                <nav className="flex flex-wrap items-center gap-1 text-[11px] text-ink-subtle">
                  <span>{t.builder.root}</span>
                  {trail.map((button) => (
                    <span key={button.id} className="flex items-center gap-1">
                      <IconArrowRight width={11} height={11} />
                      <span>{buttonLabel(button)}</span>
                    </span>
                  ))}
                </nav>
              ) : null}

              {adding ? (
                <ButtonForm
                  key="new"
                  initial={{
                    ...EMPTY_DRAFT,
                    ...inheritedKind(buttons, adding.parentId),
                    rowIndex: childrenOf(buttons, adding.parentId).length,
                  }}
                  buttons={buttons}
                  editingId={null}
                  busy={busy}
                  onCancel={() => setAdding(null)}
                  onSave={(draft) => save(draft, null, adding.parentId)}
                />
              ) : selected ? (
                <div className="space-y-3">
                  <ButtonForm
                    key={selected.id}
                    initial={toDraft(selected)}
                    buttons={buttons}
                    editingId={selected.id}
                    busy={busy}
                    stats={state.stats[selected.id]}
                    onCancel={() => setSelectedId(null)}
                    onSave={(draft) => save(draft, selected.id, selected.parentId)}
                  />
                  <PlacementControls
                    buttons={buttons}
                    button={selected}
                    busy={busy}
                    onMove={applyMove}
                    onDuplicate={() => duplicate(selected.id)}
                    onRemove={() => remove(selected.id)}
                  />
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
                  {t.builder.configEmpty}
                </p>
              )}
            </div>
          </section>
        </div>

        {error || notice ? (
          <div className="space-y-2 px-5 pb-5">
            {error ? <Alert>{error}</Alert> : null}
            {notice ? <Alert tone="success">{notice}</Alert> : null}
          </div>
        ) : null}
      </Card>

      <ValidationCard errors={errors} warnings={warnings} buttons={buttons} />

      <PublishCard
        botId={botId}
        diff={state.diff}
        publishedVersion={state.publishedVersion}
        blocked={errors.length > 0}
        busy={busy}
        onDone={async (message) => {
          if (await refresh()) setNotice(message);
        }}
      />

      <TemplatesCard
        botId={botId}
        templates={templates}
        suggestedTemplateId={suggestedTemplateId}
        startOpen={buttons.length === 0}
        busy={busy}
        onApplied={async (message) => {
          if (await refresh()) setNotice(message);
        }}
      />
    </div>
  );
}

/* ── Joylashuvni tugmalar bilan o'zgartirish (§13) ───────────────────────── */

/**
 * Sensorli ekranda sudrab ko'chirish qulay emas, shuning uchun joyni
 * o'zgartirishning tugmali yo'li ham bor: yuqoriga/pastga va ichkariga/tashqariga.
 */
function PlacementControls({
  buttons,
  button,
  busy,
  onMove,
  onDuplicate,
  onRemove,
}: {
  buttons: ButtonRecord[];
  button: ButtonRecord;
  busy: boolean;
  onMove: (items: MoveItem[]) => Promise<void>;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const siblings = childrenOf(buttons, button.parentId);
  const index = siblings.findIndex((candidate) => candidate.id === button.id);
  const previous = index > 0 ? siblings[index - 1] : null;
  const parent = buttons.find((candidate) => candidate.id === button.parentId) ?? null;

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface p-2">
      <Button
        size="sm"
        variant="ghost"
        disabled={busy || index <= 0}
        aria-label={t.builder.moveUp}
        onClick={() => onMove(planMove(buttons, button.id, previous!.id, "before"))}
      >
        <IconArrowRight width={14} height={14} className="-rotate-90" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy || index < 0 || index >= siblings.length - 1}
        aria-label={t.builder.moveDown}
        onClick={() =>
          onMove(planMove(buttons, button.id, siblings[index + 1].id, "after"))
        }
      >
        <IconArrowRight width={14} height={14} className="rotate-90" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy || !previous}
        title={t.builder.addInto}
        onClick={() => onMove(planMove(buttons, button.id, previous!.id, "into"))}
      >
        ↳
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy || !parent}
        title={t.builder.root}
        onClick={() => onMove(planMove(buttons, button.id, parent!.id, "after"))}
      >
        ↰
      </Button>

      <span className="flex-1" />

      <Button
        size="sm"
        variant="ghost"
        onClick={onDuplicate}
        disabled={busy}
        aria-label={t.builder.duplicate}
      >
        <IconCopy width={14} height={14} />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onRemove}
        disabled={busy}
        aria-label={t.builder.remove}
      >
        <IconTrash width={14} height={14} />
      </Button>
    </div>
  );
}

/* ── Tugma formasi ───────────────────────────────────────────────────────── */

function ButtonForm({
  initial,
  buttons,
  editingId,
  busy,
  stats,
  onCancel,
  onSave,
}: {
  initial: Draft;
  buttons: ButtonRecord[];
  editingId: string | null;
  busy: boolean;
  stats?: { shown: number; clicks: number };
  onCancel: () => void;
  onSave: (draft: Draft) => void;
}) {
  const { t } = useI18n();
  const labels = t.builder as unknown as Record<string, string>;
  const [draft, setDraft] = useState<Draft>(initial);

  function patch(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  /** Klaviatura almashsa tur ham unga mos bo'lishi kerak. */
  function changeKeyboard(kind: KeyboardKind) {
    const allowed = typesForKeyboard(kind);
    patch({
      keyboardKind: kind,
      buttonType: allowed.includes(draft.buttonType) ? draft.buttonType : allowed[0],
    });
  }

  /** Ichki menyu amali tugma turini ham belgilaydi — ikkisi ajralmaydi. */
  function changeAction(action: ActionType) {
    patch({
      actionType: action,
      ...(opensMenu(action) ? { buttonType: "submenu" as ButtonType } : {}),
    });
  }

  const types = typesForKeyboard(draft.keyboardKind);
  const isMenu = opensMenu(draft.actionType);
  const products = buttons.filter((button) => button.actionType === "product");
  /// Ulash uchun mumkin bo'lgan menyular — o'zi va avlodlari chiqarib tashlanadi
  const targets = buttons.filter(
    (button) =>
      isMenuButton(buttons, button) &&
      (!editingId || !subtreeIds(buttons, editingId).includes(button.id)),
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
      className="space-y-3 rounded-lg border border-accent/40 bg-surface p-3"
    >
      <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
        <Field label={t.builder.fieldEmoji} htmlFor="btn-emoji">
          <Input
            id="btn-emoji"
            value={draft.emoji}
            onChange={(e) => patch({ emoji: e.target.value })}
            maxLength={8}
            placeholder="🍔"
          />
        </Field>
        <Field label={t.builder.fieldText} htmlFor="btn-text">
          <Input
            id="btn-text"
            value={draft.text}
            onChange={(e) => patch({ text: e.target.value })}
            maxLength={64}
            required
          />
        </Field>
      </div>

      <Field label={t.builder.fieldAction} htmlFor="btn-action">
        <Select
          id="btn-action"
          value={draft.actionType}
          onChange={(e) => changeAction(e.target.value as ActionType)}
        >
          {ACTION_TYPES.map((action) => (
            <option key={action} value={action}>
              {labels[`action_${action}`] ?? action}
              {isPendingAction(action) ? " …" : ""}
            </option>
          ))}
        </Select>
      </Field>

      {isPendingAction(draft.actionType) ? (
        <Alert tone="accent">{t.builder.pendingAction}</Alert>
      ) : null}

      {/* ── Menyu tuguni ── */}
      {isMenu ? (
        <div className="space-y-3 rounded-lg bg-surface-inset p-3">
          <Field
            label={t.builder.fieldTitle}
            hint={t.builder.fieldTitleHint}
            htmlFor="btn-title"
          >
            <Input
              id="btn-title"
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              maxLength={256}
            />
          </Field>
          <Field label={t.builder.fieldDescription} htmlFor="btn-desc">
            <Textarea
              id="btn-desc"
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={2}
              maxLength={1024}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.builder.fieldTarget} htmlFor="btn-target">
              <Select
                id="btn-target"
                value={draft.targetId}
                onChange={(e) => patch({ targetId: e.target.value })}
              >
                <option value="">{t.builder.targetOwn}</option>
                {targets.map((button) => (
                  <option key={button.id} value={button.id}>
                    {buttonLabel(button)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.builder.fieldLayout} htmlFor="btn-layout">
              <Select
                id="btn-layout"
                value={String(draft.layout)}
                onChange={(e) => patch({ layout: Number(e.target.value) })}
              >
                <option value="0">{t.builder.layoutManual}</option>
                {[1, 2, 3, 4].map((count) => (
                  <option key={count} value={String(count)}>
                    {fill(t.builder.layoutPerRow, { count: String(count) })}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label={t.builder.fieldEmptyText} htmlFor="btn-empty">
            <Input
              id="btn-empty"
              value={draft.emptyText}
              onChange={(e) => patch({ emptyText: e.target.value })}
              maxLength={256}
            />
          </Field>

          <div className="border-t border-line">
            <Toggle
              checked={draft.showHome}
              onChange={(next) => patch({ showHome: next })}
              label={t.builder.fieldShowHome}
              hint={t.builder.fieldShowHomeHint}
            />
          </div>
        </div>
      ) : null}

      {/* ── Mahsulot ── */}
      {draft.actionType === "product" ? (
        <div className="space-y-3 rounded-lg bg-surface-inset p-3">
          <Field label={t.builder.fieldTitle} htmlFor="btn-p-title">
            <Input
              id="btn-p-title"
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              maxLength={256}
            />
          </Field>
          <Field label={t.builder.fieldDescription} htmlFor="btn-p-desc">
            <Textarea
              id="btn-p-desc"
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={2}
              maxLength={1024}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.builder.fieldPrice} htmlFor="btn-price">
              <Input
                id="btn-price"
                type="number"
                min={0}
                step={1000}
                value={draft.price}
                onChange={(e) => patch({ price: e.target.value })}
              />
            </Field>
            <Field label={t.builder.fieldCurrency} htmlFor="btn-currency">
              <Input
                id="btn-currency"
                value={draft.currency}
                onChange={(e) => patch({ currency: e.target.value.toUpperCase() })}
                maxLength={3}
              />
            </Field>
            <Field
              label={t.builder.fieldStock}
              hint={t.builder.fieldStockHint}
              htmlFor="btn-stock"
            >
              <Input
                id="btn-stock"
                type="number"
                min={0}
                value={draft.stock}
                onChange={(e) => patch({ stock: e.target.value })}
              />
            </Field>
          </div>
          <Field
            label={t.builder.fieldPhoto}
            hint={t.builder.fieldPhotoHint}
            htmlFor="btn-photo"
          >
            <Input
              id="btn-photo"
              value={draft.photoUrl}
              onChange={(e) => patch({ photoUrl: e.target.value })}
              placeholder="https://"
              spellCheck={false}
            />
          </Field>
          <div className="border-t border-line">
            <Toggle
              checked={draft.buyNow}
              onChange={(next) => patch({ buyNow: next })}
              label={t.builder.fieldBuyNow}
            />
          </div>
        </div>
      ) : null}

      {/* ── Savatga qo'shish ── */}
      {draft.actionType === "add_to_cart" ? (
        <Field label={t.builder.fieldProduct} htmlFor="btn-product">
          <Select
            id="btn-product"
            value={draft.productId}
            onChange={(e) => patch({ productId: e.target.value })}
            required
          >
            <option value="">{t.builder.productNone}</option>
            {products.map((button) => (
              <option key={button.id} value={button.id}>
                {buttonLabel(button)}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {draft.actionType === "send_message" ||
      draft.actionType === "custom" ||
      draft.actionType === "help" ? (
        <Field
          label={draft.actionType === "help" ? t.builder.fieldHelpText : t.builder.fieldReply}
          hint={draft.actionType === "help" ? t.builder.fieldHelpTextHint : undefined}
          htmlFor="btn-reply"
        >
          <Textarea
            id="btn-reply"
            value={draft.replyText}
            onChange={(e) => patch({ replyText: e.target.value })}
            rows={3}
            maxLength={4096}
            required={draft.actionType === "send_message"}
          />
        </Field>
      ) : null}

      {needsUrl(draft) ? (
        <Field label={t.builder.fieldUrl} hint={t.builder.fieldUrlHint} htmlFor="btn-url">
          <Input
            id="btn-url"
            value={draft.url}
            onChange={(e) => patch({ url: e.target.value })}
            placeholder="https://"
            spellCheck={false}
            required
          />
        </Field>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.builder.fieldKeyboard} htmlFor="btn-keyboard">
          <Select
            id="btn-keyboard"
            value={draft.keyboardKind}
            onChange={(e) => changeKeyboard(e.target.value as KeyboardKind)}
          >
            {KEYBOARD_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {labels[`keyboard_${kind}`] ?? kind}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.builder.fieldType} htmlFor="btn-type">
          <Select
            id="btn-type"
            value={draft.buttonType}
            onChange={(e) => patch({ buttonType: e.target.value as ButtonType })}
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {labels[`type_${type}`] ?? type}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.builder.fieldRow} hint={t.builder.fieldRowHint} htmlFor="btn-row">
          <Input
            id="btn-row"
            type="number"
            min={1}
            max={100}
            value={draft.rowIndex + 1}
            onChange={(e) =>
              patch({ rowIndex: Math.max(0, (Number(e.target.value) || 1) - 1) })
            }
          />
        </Field>
        <Field label={t.builder.fieldAudience} htmlFor="btn-audience">
          <Select
            id="btn-audience"
            value={draft.audience}
            onChange={(e) => patch({ audience: e.target.value as Audience })}
          >
            {AUDIENCES.map((audience) => (
              <option key={audience} value={audience}>
                {labels[`audience_${audience}`] ?? audience}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="divide-y divide-line border-y border-line">
        <Toggle
          checked={draft.enabled}
          onChange={(next) => patch({ enabled: next })}
          label={t.builder.fieldEnabled}
          hint={t.builder.fieldEnabledHint}
        />
        <Toggle
          checked={draft.adminOnly}
          onChange={(next) => patch({ adminOnly: next })}
          label={t.builder.fieldAdminOnly}
        />
      </div>

      {stats && stats.shown + stats.clicks > 0 ? (
        <p className="text-[11px] tabular-nums text-ink-subtle">
          {stats.shown} {t.builder.statsShown} · {stats.clicks} {t.builder.statsClicks}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={busy || !draft.text.trim()}>
          {t.common.save}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}

/* ── Tekshiruv (§12) ─────────────────────────────────────────────────────── */

function ValidationCard({
  errors,
  warnings,
  buttons,
}: {
  errors: Issue[];
  warnings: Issue[];
  buttons: ButtonRecord[];
}) {
  const { t } = useI18n();
  if (errors.length === 0 && warnings.length === 0) return null;

  function where(issue: Issue): string {
    const id = issue.buttonId ?? issue.menuId;
    const button = buttons.find((candidate) => candidate.id === id);
    return button ? buttonLabel(button) : t.builder.root;
  }

  return (
    <Card>
      <CardHeader
        title={t.builder.validationTitle}
        subtitle={errors.length > 0 ? t.builder.validationBlocked : t.builder.previewHint}
        action={
          <Badge tone={errors.length > 0 ? "danger" : "accent"}>
            {errors.length > 0
              ? `${errors.length} ${t.builder.validationErrors}`
              : `${warnings.length} ${t.builder.validationWarnings}`}
          </Badge>
        }
      />
      <ul className="divide-y divide-line">
        {[...errors, ...warnings].slice(0, 20).map((issue, index) => (
          <li key={`${issue.code}-${index}`} className="flex gap-2 px-5 py-2.5">
            <Badge tone={errors.includes(issue) ? "danger" : "neutral"}>{issue.code}</Badge>
            <span className="min-w-0 text-sm text-ink-muted">
              <span className="text-ink">{where(issue)}</span> — {issue.message}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ── Nashr ───────────────────────────────────────────────────────────────── */

function PublishCard({
  botId,
  diff,
  publishedVersion,
  blocked,
  busy,
  onDone,
}: {
  botId: string;
  diff: PublishDiff;
  publishedVersion: number;
  blocked: boolean;
  busy: boolean;
  onDone: (message: string) => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const changes = diff.added + diff.updated + diff.removed;

  async function toggleHistory() {
    if (versions) {
      setVersions(null);
      return;
    }
    setWorking(true);
    setError("");
    const result = await api<{ versions: VersionRow[] }>(
      `/api/bots/${botId}/buttons/publish`,
    );
    setWorking(false);

    if (!result.ok) {
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }
    setVersions(result.data.versions);
  }

  async function publish() {
    setWorking(true);
    setError("");
    const result = await api<{ published: boolean; version: number }>(
      `/api/bots/${botId}/buttons/publish`,
      { method: "POST" },
    );
    setWorking(false);

    if (!result.ok) {
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }
    // Tarix ochiq bo'lsa u ham yangi versiyani ko'rsatishi kerak.
    if (versions) setVersions(null);
    await onDone(fill(t.builder.publishDone, { version: String(result.data.version) }));
  }

  async function restore(versionId: string) {
    setWorking(true);
    setError("");
    const result = await api(`/api/bots/${botId}/buttons/versions/${versionId}`, {
      method: "POST",
    });
    setWorking(false);

    if (!result.ok) {
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }
    await onDone(t.builder.restoreDone);
  }

  return (
    <Card>
      <CardHeader
        title={t.builder.publishTitle}
        subtitle={t.builder.publishSubtitle}
        action={
          <Badge tone={changes > 0 ? "accent" : "neutral"}>
            {changes > 0
              ? fill(t.builder.publishChanges, { count: String(changes) })
              : t.builder.publishNoChanges}
          </Badge>
        }
      />
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            {publishedVersion > 0
              ? fill(t.builder.versionLabel, { version: String(publishedVersion) })
              : t.builder.notPublished}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleHistory}
              disabled={busy || working}
            >
              {t.builder.historyTitle}
            </Button>
            <Button
              size="sm"
              onClick={publish}
              disabled={busy || working || changes === 0 || blocked}
            >
              {t.builder.publish}
            </Button>
          </div>
        </div>

        {blocked ? <Alert>{t.builder.validationBlocked}</Alert> : null}

        {changes > 0 ? (
          <p className="text-[11px] text-ink-subtle">
            {diff.added} {t.builder.diffAdded} · {diff.updated} {t.builder.diffUpdated} ·{" "}
            {diff.removed} {t.builder.diffRemoved}
          </p>
        ) : null}

        {versions ? (
          versions.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.builder.historyEmpty}</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      {fill(t.builder.versionLabel, { version: String(version.version) })}
                    </p>
                    <p className="text-[11px] text-ink-subtle">
                      {formatPublishedAt(version.publishedAt, lang)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => restore(version.id)}
                    disabled={busy || working}
                  >
                    {t.builder.restore}
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {error ? <Alert>{error}</Alert> : null}
      </div>
    </Card>
  );
}

/* ── Shablonlar ──────────────────────────────────────────────────────────── */

function TemplatesCard({
  botId,
  templates,
  suggestedTemplateId,
  startOpen,
  busy,
  onApplied,
}: {
  botId: string;
  templates: TemplateOutline[];
  suggestedTemplateId: string | null;
  startOpen: boolean;
  busy: boolean;
  onApplied: (message: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(startOpen);
  const [prompt, setPrompt] = useState("");
  const [suggested, setSuggested] = useState(suggestedTemplateId);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  /** Erkin tavsifdan mos shablonni topadi — hech narsa yozilmaydi. */
  async function suggest() {
    setWorking(true);
    setError("");
    setHint("");
    const result = await api<{ matched: string | null; template: TemplateOutline }>(
      `/api/bots/${botId}/buttons/templates?action=suggest`,
      { json: { prompt: prompt.trim() } },
    );
    setWorking(false);

    if (!result.ok) {
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }
    setSuggested(result.data.matched ?? result.data.template.id);
    if (!result.data.matched) setHint(t.builder.templateNoMatch);
  }

  async function apply(templateId: string) {
    setWorking(true);
    setError("");
    const result = await api<{ created: number }>(
      `/api/bots/${botId}/buttons/templates?action=apply`,
      { json: { templateId } },
    );
    setWorking(false);

    if (!result.ok) {
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }
    await onApplied(
      fill(t.builder.templateApplied, { count: String(result.data.created) }),
    );
  }

  return (
    <Card>
      <CardHeader
        title={t.builder.templatesTitle}
        subtitle={t.builder.templatesSubtitle}
        action={
          <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>
            {open ? t.common.close : t.builder.templatesShow}
          </Button>
        }
      />

      {open ? (
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1">
              <Field label={t.builder.templatePrompt} htmlFor="tpl-prompt">
                <Input
                  id="tpl-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={500}
                  placeholder={t.builder.templatePrompt}
                />
              </Field>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={suggest}
              disabled={busy || working}
            >
              {t.builder.templateSuggest}
            </Button>
          </div>

          {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}

          <ul className="space-y-2">
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-surface p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">{template.name}</p>
                    <Badge>
                      {fill(t.builder.templateCount, { count: String(template.count) })}
                    </Badge>
                    {suggested === template.id ? (
                      <Badge tone="accent">{t.builder.templateSuggested}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">{template.description}</p>
                  <p className="mt-1 text-[11px] text-ink-subtle">
                    {template.preview.join(" · ")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => apply(template.id)}
                  disabled={busy || working}
                >
                  <IconPlus width={14} height={14} />
                  {t.builder.templateApply}
                </Button>
              </li>
            ))}
          </ul>

          {error ? <Alert>{error}</Alert> : null}
        </div>
      ) : null}
    </Card>
  );
}

/* ── Yordamchilar ────────────────────────────────────────────────────────── */

/**
 * Sudrab ko'chirish yoki tugma bilan siljitishning bazaga yoziladigan shakli.
 *
 * Tartib ketma-ket `rowIndex` bilan yoziladi (har tugma o'z qatorida), qatordagi
 * tugma soni esa menyuning `layout` sozlamasi bilan boshqariladi — shu sababli
 * ko'chirish natijasi har doim oldindan aytib bo'ladigan bo'lib qoladi.
 */
function planMove(
  buttons: ButtonRecord[],
  dragId: string,
  targetId: string | null,
  position: DropPosition,
): MoveItem[] {
  const dragged = buttons.find((button) => button.id === dragId);
  if (!dragged) return [];

  const target = targetId ? buttons.find((button) => button.id === targetId) : null;
  if (targetId && !target) return [];

  const destination = position === "into" ? targetId : (target?.parentId ?? null);
  // O'z avlodiga ko'chirish daraxtni halqaga aylantirardi.
  if (destination && subtreeIds(buttons, dragId).includes(destination)) return [];

  const siblings = childrenOf(buttons, destination).filter(
    (button) => button.id !== dragId,
  );

  let index = siblings.length;
  if (position !== "into" && target) {
    const at = siblings.findIndex((button) => button.id === target.id);
    if (at >= 0) index = position === "before" ? at : at + 1;
  }

  const ordered = [
    ...siblings.slice(0, index),
    dragged,
    ...siblings.slice(index),
  ];

  const items: MoveItem[] = ordered.map((button, order) => ({
    id: button.id,
    parentId: destination,
    rowIndex: Math.min(99, order),
    sortOrder: 0,
  }));

  // Manba menyusi ham qayta raqamlanadi, aks holda o'rtada bo'shliq qolardi.
  if (dragged.parentId !== destination) {
    childrenOf(buttons, dragged.parentId)
      .filter((button) => button.id !== dragId)
      .forEach((button, order) => {
        items.push({
          id: button.id,
          parentId: dragged.parentId,
          rowIndex: Math.min(99, order),
          sortOrder: 0,
        });
      });
  }

  return items.slice(0, 200);
}

/** Yangi tugma ota menyusining klaviatura turini oladi. */
function inheritedKind(
  buttons: ButtonRecord[],
  parentId: string | null,
): Pick<Draft, "keyboardKind" | "buttonType"> {
  const siblings = childrenOf(buttons, parentId);
  const parent = buttons.find((button) => button.id === parentId);
  const kind = siblings[0]?.keyboardKind ?? parent?.keyboardKind ?? "inline";
  return {
    keyboardKind: kind,
    buttonType: kind === "reply" ? "text" : "callback",
  };
}

function needsUrl(draft: Draft): boolean {
  return (
    draft.buttonType === "url" ||
    draft.buttonType === "mini_app" ||
    draft.actionType === "open_url" ||
    draft.actionType === "open_mini_app"
  );
}

/** Forma maydonlarini `actionConfig` ga yig'adi — amalga tegishli bo'lganlarini. */
function buildConfig(draft: Draft): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  if (draft.actionType === "send_message" || draft.actionType === "custom") {
    config.text = draft.replyText;
  }
  // Yordam ekranida egasi yozgan matn ko'rsatiladi; bo'sh bo'lsa tizim
  // matni ishlaydi — ekran hech qachon bo'sh chiqmaydi.
  if (draft.actionType === "help" && draft.replyText.trim()) {
    config.text = draft.replyText.trim();
  }
  if (needsUrl(draft)) config.url = draft.url.trim();

  if (opensMenu(draft.actionType)) {
    if (draft.title.trim()) config.title = draft.title.trim();
    if (draft.description.trim()) config.description = draft.description.trim();
    if (draft.emptyText.trim()) config.emptyText = draft.emptyText.trim();
    if (draft.targetId) config.targetId = draft.targetId;
    if (draft.layout > 0) config.layout = draft.layout;
    if (draft.showHome) config.showHome = true;
  }

  if (draft.actionType === "product") {
    if (draft.title.trim()) config.title = draft.title.trim();
    if (draft.description.trim()) config.description = draft.description.trim();
    if (draft.price.trim()) config.price = Number(draft.price);
    if (draft.currency.trim()) config.currency = draft.currency.trim().toUpperCase();
    if (draft.stock.trim()) config.stock = Number(draft.stock);
    if (draft.photoUrl.trim()) config.photoUrl = draft.photoUrl.trim();
    config.buyNow = draft.buyNow;
  }

  if (draft.actionType === "add_to_cart") config.productId = draft.productId;

  return config;
}

function toDraft(button: ButtonRecord): Draft {
  const config = button.actionConfig as { text?: string; url?: string };
  const menu = menuConfig(button);
  const product = productConfig(button);

  return {
    text: button.text,
    emoji: button.emoji ?? "",
    keyboardKind: button.keyboardKind,
    buttonType: button.buttonType,
    actionType: button.actionType,
    replyText: config.text ?? "",
    url: config.url ?? "",
    rowIndex: button.rowIndex,
    audience: button.visibility.audience ?? "everyone",
    enabled: button.enabled,
    adminOnly: button.adminOnly,
    title: (button.actionType === "product" ? product.title : menu.title) ?? "",
    description:
      (button.actionType === "product" ? product.description : menu.description) ?? "",
    emptyText: menu.emptyText ?? "",
    targetId: menu.targetId ?? "",
    layout: menu.layout ?? 0,
    showHome: menu.showHome === true,
    price: product.price === undefined ? "" : String(product.price),
    currency: product.currency ?? "UZS",
    stock: product.stock === undefined || product.stock === null ? "" : String(product.stock),
    buyNow: product.buyNow !== false,
    photoUrl: product.photoUrl ?? "",
    productId: (button.actionConfig as { productId?: string }).productId ?? "",
  };
}

function formatPublishedAt(value: string, lang: string): string {
  const date = new Date(value);
  const time = date.toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} ${time}`;
}
