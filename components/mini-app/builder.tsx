"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  Toggle,
} from "@/components/ui";
import { RenderTree } from "@/components/mini-app/render";
import { EndpointsPanel } from "@/components/mini-app/endpoints-panel";
import {
  ACTION_KINDS,
  COMPONENT_TYPES,
  defaultProps,
  MAX_DEPTH,
  newComponentId,
  type ComponentAction,
  type ComponentType,
  type MiniAppComponent,
} from "@/lib/mini-app/schema";

/**
 * Mini App konstruktori.
 *
 * Uch ustun: chapda komponentlar, o'rtada JONLI preview, o'ngda tanlangan
 * elementning sozlamalari. Preview aynan `RenderTree` bilan chiziladi — ya'ni
 * Telegram ochadigan kod bilan BITTA. Shuning uchun bu yerda ko'ringan narsa
 * jonli ilovada ham xuddi shunday chiqadi.
 *
 * Saqlash aniq: har o'zgarish avtomatik ketmaydi, foydalanuvchi «Saqlash»
 * bosadi. Nashr esa alohida qadam — qoralama va jonli ilova ajratilgan.
 */

export type BuilderPage = {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  isHome: boolean;
  sortOrder: number;
  components: MiniAppComponent[];
};

/** Sozlangan API amali. Sarlavha QIYMATLARI klientga hech qachon kelmaydi. */
export type BuilderEndpoint = {
  id: string;
  name: string;
  method: string;
  url: string;
  headerKeys: string[];
  timeoutMs: number;
};

export type BuilderData = {
  app: {
    id: string;
    name: string;
    status: "draft" | "published" | "unpublished";
    publishedAt: string | null;
    url: string;
    apiAllowlist: string[];
  };
  endpoints: BuilderEndpoint[];
  pages: BuilderPage[];
  publishedVersion: number;
  hasUnpublishedChanges: boolean;
  hostingAvailable: boolean;
};

const TYPE_LABELS: Record<ComponentType, string> = {
  heading: "Sarlavha",
  text: "Matn",
  image: "Rasm",
  button: "Tugma",
  input: "Kiritish maydoni",
  product: "Mahsulot",
  divider: "Ajratgich",
  spacer: "Bo'shliq",
  container: "Konteyner",
};

const ACTION_LABELS: Record<(typeof ACTION_KINDS)[number], string> = {
  none: "Hech narsa",
  open_page: "Sahifani ochish",
  open_url: "Havolani ochish",
  send_message: "Botga xabar yuborish",
  submit_form: "Formani yuborish",
  api_request: "API so'rovi",
  close_app: "Mini App'ni yopish",
};

export function MiniAppBuilder({
  botId,
  initial,
}: {
  botId: string;
  initial: BuilderData;
}) {
  const [data, setData] = useState<BuilderData>(initial);
  const [pageId, setPageId] = useState(
    initial.pages.find((page) => page.isHome)?.id ?? initial.pages[0]?.id ?? "",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);

  const page = useMemo(
    () => data.pages.find((candidate) => candidate.id === pageId) ?? data.pages[0],
    [data.pages, pageId],
  );

  const selected = useMemo(
    () => (page && selectedId ? findNode(page.components, selectedId) : null),
    [page, selectedId],
  );

  const reload = useCallback(async () => {
    const result = await api<BuilderData>(`/api/bots/${botId}/mini-app`);
    if (result.ok) {
      setData(result.data);
      setDirty(false);
      return true;
    }
    setError(result.error);
    return false;
  }, [botId]);

  /** Har bir mutatsiya uchun bir xil qobiq — band holati va xato bir joyda. */
  const run = useCallback(
    async (
      call: () => Promise<{ ok: true } | { ok: false; error: string }>,
      message?: string,
    ) => {
      setBusy(true);
      setError("");
      setNotice("");
      const result = await call();
      if (!result.ok) {
        setBusy(false);
        setError(result.error);
        return false;
      }
      const reloaded = await reload();
      setBusy(false);
      if (reloaded && message) setNotice(message);
      return reloaded;
    },
    [reload],
  );

  /* ── Komponentlar ────────────────────────────────────────────────────── */

  function patchComponents(next: MiniAppComponent[]) {
    if (!page) return;
    setData((current) => ({
      ...current,
      pages: current.pages.map((candidate) =>
        candidate.id === page.id ? { ...candidate, components: next } : candidate,
      ),
    }));
    setDirty(true);
  }

  /**
   * Yangi element qayerga tushadi.
   *
   * Konteyner tanlangan bo'lsa — uning ICHIGA, aks holda sahifa oxiriga.
   * Shu sababli ichma-ich tuzilma qo'shimcha rejimni yoqmasdan yig'iladi:
   * konteynerni bosasiz va keyingi elementlar unga tushadi.
   */
  const target = useMemo(() => {
    if (!selected) return null;
    if (selected.type === "container") return selected;
    // Konteyner ichidagi element tanlangan bo'lsa — qo'shni bo'lib tushsin.
    return page ? parentContainer(page.components, selected.id) : null;
  }, [page, selected]);

  function addComponent(type: ComponentType) {
    if (!page) return;

    const node = {
      id: newComponentId(type),
      type,
      props: defaultProps(type),
      ...(type === "container" ? { children: [] } : {}),
    } as MiniAppComponent;

    if (target) {
      const depth = depthOf(page.components, target.id);
      // Cheksiz ichma-ichlik konstruktorni ham, renderni ham chalkashtiradi.
      if (depth + 1 >= MAX_DEPTH) {
        setError(`Ichma-ichlik chegarasi — ${MAX_DEPTH} qavatdan chuqur bo'lmaydi`);
        return;
      }
      patchComponents(
        mapNode(page.components, target.id, (parent) => ({
          ...parent,
          children: [...(parent.children ?? []), node],
        })),
      );
    } else {
      patchComponents([...page.components, node]);
    }

    setError("");
    setSelectedId(node.id);
  }

  function updateProps(id: string, patch: Record<string, unknown>) {
    if (!page) return;
    patchComponents(
      mapNode(
        page.components,
        id,
        (node) =>
          // Tur bo'yicha ajratilgan birlashma spread'dan keyin torayishni
          // yo'qotadi. Shakl baribir SERVERDA `componentTreeSchema` bilan
          // qaytadan tekshiriladi, shuning uchun bu yerdagi cast xavfsiz.
          ({ ...node, props: { ...node.props, ...patch } }) as MiniAppComponent,
      ),
    );
  }

  function removeComponent(id: string) {
    if (!page) return;
    patchComponents(removeNode(page.components, id));
    if (selectedId === id) setSelectedId(null);
  }

  function moveComponent(id: string, direction: -1 | 1) {
    if (!page) return;
    patchComponents(moveNode(page.components, id, direction));
  }

  async function save() {
    if (!page) return;
    await run(
      () =>
        api(`/api/bots/${botId}/mini-app/pages/${page.id}`, {
          method: "PATCH",
          json: { components: page.components },
        }),
      "Saqlandi",
    );
  }

  /* ── Sahifalar ───────────────────────────────────────────────────────── */

  async function addPage() {
    const name = window.prompt("Sahifa nomi", "Yangi sahifa");
    if (!name?.trim()) return;
    const slug = slugify(name);
    await run(
      () =>
        api(`/api/bots/${botId}/mini-app/pages`, {
          json: { name: name.trim(), slug },
        }),
      "Sahifa qo'shildi",
    );
  }

  async function deleteCurrentPage() {
    if (!page) return;
    if (!window.confirm(`«${page.name}» sahifasi o'chirilsinmi?`)) return;
    const ok = await run(
      () =>
        api(`/api/bots/${botId}/mini-app/pages/${page.id}`, { method: "DELETE" }),
      "Sahifa o'chirildi",
    );
    if (ok) setPageId("");
  }

  async function makeHome() {
    if (!page) return;
    await run(
      () =>
        api(`/api/bots/${botId}/mini-app/pages/${page.id}`, {
          method: "PATCH",
          json: { isHome: true },
        }),
      "Bosh sahifa belgilandi",
    );
  }

  /* ── Nashr ───────────────────────────────────────────────────────────── */

  async function publish() {
    if (dirty) {
      setError("Avval o'zgarishlarni saqlang");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const result = await api<{ version: number }>(
      `/api/bots/${botId}/mini-app/publish`,
      { method: "POST" },
    );
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    await reload();
    setBusy(false);
    setNotice(`Nashr etildi — versiya ${result.data.version}`);
  }

  async function unpublish() {
    await run(
      () => api(`/api/bots/${botId}/mini-app/publish`, { method: "DELETE" }),
      "Nashrdan olindi",
    );
  }

  /* ── Ko'rinish ───────────────────────────────────────────────────────── */

  const previewCtx = {
    onAction: () => {},
    values: {},
    onChange: () => {},
    selectedId,
    onSelect: setSelectedId,
    interactive: false,
  };

  return (
    <div className="space-y-4">
      {/* Yuqori panel */}
      <Card>
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold text-ink">{data.app.name}</p>
              <Badge tone={data.app.status === "published" ? "success" : "neutral"}>
                {data.app.status === "published"
                  ? "Nashr etilgan"
                  : data.app.status === "unpublished"
                    ? "Nashrdan olingan"
                    : "Qoralama"}
              </Badge>
              {data.hasUnpublishedChanges && data.publishedVersion > 0 ? (
                <Badge tone="accent">Saqlanmagan o&apos;zgarish</Badge>
              ) : null}
            </div>
            {data.app.status === "published" ? (
              <Link
                href={data.app.url}
                target="_blank"
                className="mt-0.5 block truncate text-xs text-accent hover:underline"
              >
                {data.app.url}
              </Link>
            ) : (
              <p className="mt-0.5 text-xs text-ink-subtle">
                Nashr etilgandan keyin manzil ochiladi
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={save} disabled={busy || !dirty}>
              {dirty ? "Saqlash" : "Saqlandi"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => window.open(data.app.url, "_blank")}
              disabled={busy || data.app.status !== "published"}
            >
              Preview
            </Button>
            {data.app.status === "published" ? (
              <Button size="sm" variant="ghost" onClick={unpublish} disabled={busy}>
                Nashrdan olish
              </Button>
            ) : null}
            <Button size="sm" onClick={publish} disabled={busy}>
              Nashr etish
            </Button>
          </div>
        </div>

        {!data.hostingAvailable ? (
          <div className="border-t border-line px-5 py-3">
            <Alert tone="accent">
              APP_URL hozir HTTPS emas. Mini App yaratiladi va preview ishlaydi, lekin
              Telegram uni ochishi uchun HTTPS manzil kerak (ngrok/localtunnel).
            </Alert>
          </div>
        ) : null}

        {error ? (
          <div className="border-t border-line px-5 py-3">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        {notice ? (
          <div className="border-t border-line px-5 py-3">
            <Alert tone="success">{notice}</Alert>
          </div>
        ) : null}
      </Card>

      {/* Sahifalar */}
      <Card>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          {data.pages.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => {
                setPageId(candidate.id);
                setSelectedId(null);
              }}
              className={
                candidate.id === page?.id
                  ? "rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
                  : "rounded-lg border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-inset"
              }
            >
              {candidate.isHome ? "🏠 " : ""}
              {candidate.name}
            </button>
          ))}
          <Button size="sm" variant="ghost" onClick={addPage} disabled={busy}>
            + Sahifa
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {page && !page.isHome ? (
              <Button size="sm" variant="ghost" onClick={makeHome} disabled={busy}>
                Bosh sahifa qilish
              </Button>
            ) : null}
            {data.pages.length > 1 ? (
              <Button size="sm" variant="ghost" onClick={deleteCurrentPage} disabled={busy}>
                O&apos;chirish
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <EndpointsPanel
        botId={botId}
        endpoints={data.endpoints}
        allowlist={data.app.apiAllowlist}
        onChanged={() => void reload()}
      />

      {/* Uch ustun */}
      <div className="grid gap-4 lg:grid-cols-[190px_1fr_290px]">
        {/* Komponentlar */}
        <div className="space-y-4">
          <Card>
            <div className="border-b border-line px-4 py-3">
              <p className="text-xs font-medium text-ink-subtle">Komponentlar</p>
              <p className="mt-0.5 text-[11px] text-ink-subtle">
                {target ? (
                  <>
                    →{" "}
                    <span className="font-medium text-accent">
                      {TYPE_LABELS[target.type]}
                    </span>{" "}
                    ichiga
                  </>
                ) : (
                  "→ sahifa oxiriga"
                )}
              </p>
            </div>
            <div className="grid gap-1.5 p-3">
              {COMPONENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addComponent(type)}
                  disabled={busy || !page}
                  className="rounded-lg border border-line px-3 py-2 text-left text-sm text-ink transition-colors hover:border-line-strong hover:bg-surface-inset disabled:opacity-50"
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </Card>

          {/* Tuzilma — ichma-ich joylashuv shu yerda ko'rinadi */}
          <Card>
            <p className="border-b border-line px-4 py-3 text-xs font-medium text-ink-subtle">
              Tuzilma
            </p>
            <div className="p-2">
              {page && page.components.length > 0 ? (
                <Outline
                  nodes={page.components}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ) : (
                <p className="px-2 py-3 text-xs text-ink-subtle">Element yo&apos;q</p>
              )}
            </div>
          </Card>
        </div>

        {/* Jonli preview */}
        <Card>
          <p className="border-b border-line px-4 py-3 text-xs font-medium text-ink-subtle">
            Ko&apos;rinish — Telegram bilan bir xil kod
          </p>
          <div className="flex justify-center bg-surface-sunken p-5">
            <div
              className="w-full max-w-[380px] overflow-hidden rounded-2xl border border-line"
              style={
                {
                  // Preview'da Telegram mavzusi bo'lmagani uchun mantiqiy
                  // standart ranglar qo'yiladi — jonli ilovada ular
                  // Telegram'nikiga almashadi.
                  "--tg-bg": "#ffffff",
                  "--tg-text": "#000000",
                  "--tg-hint": "#707579",
                  "--tg-link": "#2481cc",
                  "--tg-button": "#2481cc",
                  "--tg-button-text": "#ffffff",
                  "--tg-secondary-bg": "#f4f4f5",
                  "--tg-section-bg": "#ffffff",
                  "--tg-section-separator": "#e5e5e7",
                  background: "var(--tg-bg)",
                } as React.CSSProperties
              }
            >
              <div className="min-h-[420px] p-4">
                {page && page.components.length > 0 ? (
                  <RenderTree nodes={page.components} ctx={previewCtx} />
                ) : (
                  <EmptyState
                    title="Sahifa bo'sh"
                    body="Chapdagi ro'yxatdan komponent qo'shing."
                  />
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Sozlamalar */}
        <Card>
          <p className="border-b border-line px-4 py-3 text-xs font-medium text-ink-subtle">
            Sozlamalar
          </p>
          <div className="space-y-3 p-4">
            {!selected ? (
              <p className="text-sm text-ink-subtle">
                Ko&apos;rinishdan elementni tanlang.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <Badge>{TYPE_LABELS[selected.type]}</Badge>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveComponent(selected.id, -1)}
                      aria-label="Yuqoriga"
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveComponent(selected.id, 1)}
                      aria-label="Pastga"
                    >
                      ↓
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeComponent(selected.id)}
                      aria-label="O'chirish"
                    >
                      🗑
                    </Button>
                  </div>
                </div>

                <PropsEditor
                  node={selected}
                  pages={data.pages}
                  endpoints={data.endpoints}
                  onChange={(patch) => updateProps(selected.id, patch)}
                />
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * Tuzilma daraxti.
 *
 * Preview'da ichma-ich element ko'rinadi, lekin bosib tanlash chalkash bo'lishi
 * mumkin (bola otasining ustida turadi). Bu ro'yxat esa ierarxiyani ochiq
 * ko'rsatadi va istalgan qavatdagi elementni aniq tanlashga imkon beradi.
 */
function Outline({
  nodes,
  selectedId,
  onSelect,
  depth = 0,
}: {
  nodes: MiniAppComponent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            style={{ paddingLeft: 8 + depth * 12 }}
            className={
              node.id === selectedId
                ? "flex w-full items-center gap-1.5 rounded-md bg-accent-soft py-1.5 pr-2 text-left text-xs font-medium text-accent"
                : "flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-xs text-ink-muted hover:bg-surface-inset"
            }
          >
            <span className="truncate">{TYPE_LABELS[node.type]}</span>
            <span className="ml-auto shrink-0 text-[10px] text-ink-subtle">
              {outlineHint(node)}
            </span>
          </button>
          {node.children?.length ? (
            <Outline
              nodes={node.children}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Ro'yxatda elementni ajratib turadigan qisqa belgi. */
function outlineHint(node: MiniAppComponent): string {
  switch (node.type) {
    case "heading":
    case "text":
    case "button":
      return truncate(node.props.text);
    case "product":
      return truncate(node.props.title);
    case "input":
      return truncate(node.props.label || node.props.name);
    case "container":
      return `${node.children?.length ?? 0} ta`;
    default:
      return "";
  }
}

function truncate(value: string): string {
  const clean = value.trim();
  return clean.length > 14 ? `${clean.slice(0, 14)}…` : clean;
}

/* ── Sozlamalar formasi ──────────────────────────────────────────────────── */

function PropsEditor({
  node,
  pages,
  endpoints,
  onChange,
}: {
  node: MiniAppComponent;
  pages: BuilderPage[];
  endpoints: BuilderEndpoint[];
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const props = node.props as Record<string, unknown>;
  const text = (key: string) => String(props[key] ?? "");
  const num = (key: string) => Number(props[key] ?? 0);

  switch (node.type) {
    case "heading":
      return (
        <>
          <Field label="Matn">
            <Input value={text("text")} onChange={(e) => onChange({ text: e.target.value })} />
          </Field>
          <Field label="Daraja">
            <Select
              value={String(props.level)}
              onChange={(e) => onChange({ level: Number(e.target.value) })}
            >
              <option value="1">Katta</option>
              <option value="2">O&apos;rta</option>
              <option value="3">Kichik</option>
            </Select>
          </Field>
          <AlignField value={text("align")} onChange={onChange} />
        </>
      );

    case "text":
      return (
        <>
          <Field label="Matn">
            <Textarea
              rows={4}
              value={text("text")}
              onChange={(e) => onChange({ text: e.target.value })}
            />
          </Field>
          <Field label="O'lcham">
            <Select value={text("size")} onChange={(e) => onChange({ size: e.target.value })}>
              <option value="sm">Kichik</option>
              <option value="md">O&apos;rta</option>
              <option value="lg">Katta</option>
            </Select>
          </Field>
          <AlignField value={text("align")} onChange={onChange} />
          <Toggle
            checked={Boolean(props.muted)}
            onChange={(v) => onChange({ muted: v })}
            label="Xira rang"
          />
        </>
      );

    case "image":
      return (
        <>
          <Field label="Rasm manzili" hint="HTTPS bo'lishi shart">
            <Input
              value={text("url")}
              placeholder="https://…"
              onChange={(e) => onChange({ url: e.target.value })}
            />
          </Field>
          <Field label="Balandligi">
            <Input
              type="number"
              value={num("height")}
              onChange={(e) => onChange({ height: Number(e.target.value) })}
            />
          </Field>
        </>
      );

    case "button":
      return (
        <>
          <Field label="Matn">
            <Input value={text("text")} onChange={(e) => onChange({ text: e.target.value })} />
          </Field>
          <Field label="Ko'rinishi">
            <Select
              value={text("variant")}
              onChange={(e) => onChange({ variant: e.target.value })}
            >
              <option value="primary">Asosiy</option>
              <option value="secondary">Ikkilamchi</option>
              <option value="ghost">Shaffof</option>
            </Select>
          </Field>
          <ActionField
            action={props.action as ComponentAction}
            pages={pages}
            endpoints={endpoints}
            onChange={(action) => onChange({ action })}
          />
        </>
      );

    case "input":
      return (
        <>
          <Field label="Nomi" hint="Forma yuborilganda shu nom bilan ketadi">
            <Input value={text("name")} onChange={(e) => onChange({ name: e.target.value })} />
          </Field>
          <Field label="Yorlig'i">
            <Input value={text("label")} onChange={(e) => onChange({ label: e.target.value })} />
          </Field>
          <Field label="Ko'rsatma matni">
            <Input
              value={text("placeholder")}
              onChange={(e) => onChange({ placeholder: e.target.value })}
            />
          </Field>
          <Field label="Turi">
            <Select value={text("type")} onChange={(e) => onChange({ type: e.target.value })}>
              <option value="text">Matn</option>
              <option value="number">Raqam</option>
              <option value="tel">Telefon</option>
              <option value="email">Email</option>
              <option value="textarea">Uzun matn</option>
            </Select>
          </Field>
          <Toggle
            checked={Boolean(props.required)}
            onChange={(v) => onChange({ required: v })}
            label="Majburiy"
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Eng kam belgi">
              <Input
                type="number"
                value={props.minLength === undefined ? "" : num("minLength")}
                onChange={(e) =>
                  onChange({
                    minLength: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Eng ko'p belgi">
              <Input
                type="number"
                value={props.maxLength === undefined ? "" : num("maxLength")}
                onChange={(e) =>
                  onChange({
                    maxLength: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
          <Field label="Naqsh (regex)" hint="Ixtiyoriy, masalan ^\\+998\\d{9}$">
            <Input
              value={text("pattern")}
              onChange={(e) =>
                onChange({ pattern: e.target.value.trim() || undefined })
              }
            />
          </Field>
        </>
      );

    case "product":
      return (
        <>
          <Field label="Nomi">
            <Input value={text("title")} onChange={(e) => onChange({ title: e.target.value })} />
          </Field>
          <Field label="Tavsifi">
            <Textarea
              rows={3}
              value={text("description")}
              onChange={(e) => onChange({ description: e.target.value })}
            />
          </Field>
          <Field label="Narxi">
            <Input
              type="number"
              value={num("price")}
              onChange={(e) => onChange({ price: Number(e.target.value) })}
            />
          </Field>
          <Field label="Valyuta">
            <Input
              value={text("currency")}
              onChange={(e) => onChange({ currency: e.target.value })}
            />
          </Field>
          <Field label="Rasm manzili" hint="HTTPS">
            <Input
              value={text("image")}
              placeholder="https://…"
              onChange={(e) => onChange({ image: e.target.value })}
            />
          </Field>
          <Field label="Tugma matni">
            <Input
              value={text("buttonText")}
              onChange={(e) => onChange({ buttonText: e.target.value })}
            />
          </Field>
          <ActionField
            action={props.action as ComponentAction}
            pages={pages}
            endpoints={endpoints}
            onChange={(action) => onChange({ action })}
          />
        </>
      );

    case "spacer":
      return (
        <Field label="Balandligi">
          <Input
            type="number"
            value={num("height")}
            onChange={(e) => onChange({ height: Number(e.target.value) })}
          />
        </Field>
      );

    case "divider":
      return (
        <Field label="Bo'shliq">
          <Input
            type="number"
            value={num("spacing")}
            onChange={(e) => onChange({ spacing: Number(e.target.value) })}
          />
        </Field>
      );

    case "container":
      return (
        <>
          <Field label="Yo'nalish">
            <Select
              value={text("direction")}
              onChange={(e) => onChange({ direction: e.target.value })}
            >
              <option value="column">Ustun</option>
              <option value="row">Qator</option>
            </Select>
          </Field>
          <Field label="Oraliq">
            <Input
              type="number"
              value={num("gap")}
              onChange={(e) => onChange({ gap: Number(e.target.value) })}
            />
          </Field>
          <p className="text-xs text-ink-subtle">
            Konteyner ichiga element qo&apos;shish hozircha qo&apos;llanmaydi — u
            bo&apos;shliq va joylashuv uchun ishlatiladi.
          </p>
        </>
      );
  }
}

function AlignField({
  value,
  onChange,
}: {
  value: string;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  return (
    <Field label="Tekislash">
      <Select value={value} onChange={(e) => onChange({ align: e.target.value })}>
        <option value="left">Chapga</option>
        <option value="center">Markazga</option>
        <option value="right">O&apos;ngga</option>
      </Select>
    </Field>
  );
}

/** Amal tanlash — tanlangan turga qarab kerakli maydon chiqadi. */
function ActionField({
  action,
  pages,
  endpoints,
  onChange,
}: {
  action: ComponentAction | undefined;
  pages: BuilderPage[];
  endpoints: BuilderEndpoint[];
  onChange: (action: ComponentAction) => void;
}) {
  const current = action ?? { kind: "none" as const };

  return (
    <>
      <Field label="Bosilganda">
        <Select
          value={current.kind}
          onChange={(e) =>
            onChange({ ...current, kind: e.target.value as ComponentAction["kind"] })
          }
        >
          {ACTION_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {ACTION_LABELS[kind]}
            </option>
          ))}
        </Select>
      </Field>

      {current.kind === "open_page" ? (
        <Field label="Qaysi sahifa">
          <Select
            value={current.page ?? ""}
            onChange={(e) => onChange({ ...current, page: e.target.value })}
          >
            <option value="">— tanlang —</option>
            {pages.map((page) => (
              <option key={page.id} value={page.slug}>
                {page.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {current.kind === "open_url" ? (
        <Field label="Havola" hint="HTTPS bo'lishi shart">
          <Input
            value={current.url ?? ""}
            placeholder="https://…"
            onChange={(e) => onChange({ ...current, url: e.target.value })}
          />
        </Field>
      ) : null}

      {current.kind === "api_request" ? (
        endpoints.length === 0 ? (
          <p className="text-xs text-ink-subtle">
            Hali API amali sozlanmagan. Pastdagi «API amallari» bo&apos;limidan
            qo&apos;shing.
          </p>
        ) : (
          <>
            <Field label="Qaysi amal">
              <Select
                value={current.endpointId ?? ""}
                onChange={(e) => onChange({ ...current, endpointId: e.target.value })}
              >
                <option value="">— tanlang —</option>
                {endpoints.map((endpoint) => (
                  <option key={endpoint.id} value={endpoint.id}>
                    {endpoint.method} · {endpoint.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Muvaffaqiyatdan keyin" hint="Ixtiyoriy">
              <Select
                value={current.thenPage ?? ""}
                onChange={(e) => onChange({ ...current, thenPage: e.target.value })}
              >
                <option value="">Shu sahifada qolish</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.slug}>
                    {page.name} sahifasiga o&apos;tish
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )
      ) : null}

      {current.kind === "send_message" || current.kind === "submit_form" ? (
        <Field
          label="Botga ketadigan matn"
          hint={
            current.kind === "submit_form"
              ? "Forma maydonlari matn ostiga qo'shiladi"
              : undefined
          }
        >
          <Input
            value={current.text ?? ""}
            onChange={(e) => onChange({ ...current, text: e.target.value })}
          />
        </Field>
      ) : null}
    </>
  );
}

/* ── Daraxt yordamchilari ────────────────────────────────────────────────── */

/** Elementning ota konteyneri (yo'q bo'lsa — ildizda turibdi). */
function parentContainer(
  nodes: MiniAppComponent[],
  id: string,
): MiniAppComponent | null {
  for (const node of nodes) {
    if (!node.children?.length) continue;
    if (node.children.some((child) => child.id === id)) return node;
    const deeper = parentContainer(node.children, id);
    if (deeper) return deeper;
  }
  return null;
}

/** Ildizdan hisoblangan chuqurlik (ildiz — 0). */
function depthOf(nodes: MiniAppComponent[], id: string, level = 0): number {
  for (const node of nodes) {
    if (node.id === id) return level;
    if (node.children?.length) {
      const found = depthOf(node.children, id, level + 1);
      if (found >= 0) return found;
    }
  }
  return -1;
}

function findNode(nodes: MiniAppComponent[], id: string): MiniAppComponent | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function mapNode(
  nodes: MiniAppComponent[],
  id: string,
  fn: (node: MiniAppComponent) => MiniAppComponent,
): MiniAppComponent[] {
  return nodes.map((node) => {
    if (node.id === id) return fn(node);
    if (node.children?.length) {
      return { ...node, children: mapNode(node.children, id, fn) } as MiniAppComponent;
    }
    return node;
  });
}

function removeNode(nodes: MiniAppComponent[], id: string): MiniAppComponent[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) =>
      node.children?.length
        ? ({ ...node, children: removeNode(node.children, id) } as MiniAppComponent)
        : node,
    );
}

function moveNode(
  nodes: MiniAppComponent[],
  id: string,
  direction: -1 | 1,
): MiniAppComponent[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index === -1) {
    return nodes.map((node) =>
      node.children?.length
        ? ({ ...node, children: moveNode(node.children, id, direction) } as MiniAppComponent)
        : node,
    );
  }
  const target = index + direction;
  if (target < 0 || target >= nodes.length) return nodes;
  const next = [...nodes];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** «Yangi sahifa» → `yangi-sahifa`. */
function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `page-${Date.now().toString(36).slice(-4)}`;
}
