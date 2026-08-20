"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { api, formatDate } from "@/lib/client";
import { cn } from "@/lib/cn";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeading,
  Select,
  Textarea,
} from "@/components/ui";
import { IconArrowRight, IconBot, IconPlus } from "@/components/icons";
import { statusTone, type BotStatusValue } from "@/components/bots/status";
import { BotActions } from "@/components/bots/bot-actions";
import { applyFilters, type Filter, type Sort } from "@/lib/bots/list-filter";

export type BotCard = {
  id: string;
  username: string;
  name: string;
  description: string | null;
  status: BotStatusValue;
  userCount: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

/** «Botlarim» sahifasi: ro'yxat va yangi bot ulash formasi. */
export function BotsPanel({
  initial,
  initialFilter = "all",
}: {
  initial: BotCard[];
  /** Dashboard'dagi «Faol botlar» kartasi shu bilan keladi (§3). */
  initialFilter?: Filter;
}) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(initial.length === 0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [sort, setSort] = useState<Sort>("recent");

  const visible = useMemo(
    () => applyFilters(initial, query, filter, sort),
    [initial, query, filter, sort],
  );

  const filtering = query.trim().length > 0 || filter !== "all";

  return (
    <>
      <PageHeading
        title={t.bots.title}
        subtitle={t.bots.subtitle}
        action={
          initial.length > 0 ? (
            <Button size="sm" onClick={() => setAdding((v) => !v)}>
              <IconPlus width={16} height={16} />
              {t.bots.add}
            </Button>
          ) : undefined
        }
      />

      {adding ? (
        <div className="mb-6">
          <AddBotForm onDone={() => setAdding(false)} />
        </div>
      ) : null}

      {initial.length === 0 && !adding ? (
        <Card>
          <EmptyState
            icon={<IconBot width={28} height={28} />}
            title={t.bots.empty}
            body={t.bots.emptyBody}
            action={
              <Button onClick={() => setAdding(true)}>
                <IconPlus width={16} height={16} />
                {t.bots.add}
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Boshqaruv paneli faqat ro'yxat o'sganda ma'noli — bitta-ikkita
              bot uchun u faqat ekranni band qiladi (§20). Ammo filtr tashqaridan
              kelgan bo'lsa (dashboard'dagi «Faol botlar»), boshqaruv HAR DOIM
              ko'rinadi: aks holda odam filtrlangan ro'yxatda qamalib qoladi. */}
          {initial.length > 3 || filter !== "all" ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="min-w-[12rem] flex-1">
                <label htmlFor="bot-search" className="sr-only">
                  {t.bots.searchPlaceholder}
                </label>
                <Input
                  id="bot-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.bots.searchPlaceholder}
                />
              </div>

              <div role="group" aria-label={t.bots.filterAll} className="flex gap-1">
                {(
                  [
                    ["all", t.bots.filterAll],
                    ["active", t.bots.filterActive],
                    ["inactive", t.bots.filterInactive],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    aria-pressed={filter === value}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm transition-colors",
                      filter === value
                        ? "bg-accent-soft font-medium text-accent"
                        : "text-ink-muted hover:bg-surface-inset hover:text-ink",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="bot-sort" className="sr-only">
                  {t.bots.sortLabel}
                </label>
                <Select
                  id="bot-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                >
                  <option value="recent">{t.bots.sortRecent}</option>
                  <option value="name">{t.bots.sortName}</option>
                  <option value="created">{t.bots.sortCreated}</option>
                </Select>
              </div>
            </div>
          ) : null}

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={<IconBot width={28} height={28} />}
                title={t.bots.noMatches}
                body={t.bots.noMatchesBody}
                action={
                  filtering ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setQuery("");
                        setFilter("all");
                      }}
                    >
                      {t.bots.clearFilters}
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {visible.map((bot) => (
                <li key={bot.id}>
                  <BotTile bot={bot} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function BotTile({ bot }: { bot: BotCard }) {
  const { t, lang } = useI18n();
  const tone = statusTone(bot.status);

  /*
    Karta bitta katta havola EMAS: ichida «yana» menyusi bor, tugmani havola
    ichiga qo'yish esa noto'g'ri HTML va klaviaturada chalkash tartib beradi.
    Shuning uchun havola — sarlavha ustidagi kengaytirilgan (`after:absolute`)
    soha: butun karta bosiladi, lekin menyu tugmasi undan yuqorida turadi.
  */
  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-card border border-line bg-surface-raised p-4",
        "transition-colors hover:border-line-strong hover:bg-surface-inset",
        "focus-within:border-line-strong",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <IconBot width={18} height={18} />
          </span>
          <div className="min-w-0">
            <Link
              href={`/bots/${bot.id}`}
              className={cn(
                "truncate text-sm font-medium text-ink outline-none",
                "after:absolute after:inset-0 after:rounded-card",
                "focus-visible:underline",
              )}
            >
              {bot.name}
            </Link>
            <p className="truncate text-xs text-ink-subtle">@{bot.username}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone={tone.tone}>{t.bots[tone.labelKey]}</Badge>
          {/* Menyu havola qatlamidan yuqorida turishi kerak. */}
          <div className="relative z-10">
            <BotActions bot={{ id: bot.id, name: bot.name, status: bot.status }} />
          </div>
        </div>
      </div>

      {bot.description ? (
        <p className="mt-3 line-clamp-2 text-xs text-ink-muted">{bot.description}</p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <dl className="flex gap-4 text-xs">
          <div>
            <dt className="text-[11px] text-ink-subtle">{t.bots.statUsers}</dt>
            <dd className="font-semibold tabular-nums text-ink">{bot.userCount}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-subtle">{t.bots.statMessages}</dt>
            <dd className="font-semibold tabular-nums text-ink">{bot.messageCount}</dd>
          </div>
        </dl>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
          {t.bots.open}
          <IconArrowRight width={14} height={14} />
        </span>
      </div>

      <div className="mt-2 border-t border-line pt-2">
        <p className="text-[11px] text-ink-subtle">
          {t.bots.lastUpdated}: {formatDate(bot.updatedAt, lang)}
        </p>
      </div>
    </div>
  );
}

/* ── Yangi bot ulash ─────────────────────────────────────────────────────── */

type CreateResponse = {
  bot: { id: string };
  webhook: { ok: true; url: string } | { ok: false; reason: string; needsHttps: boolean };
};

function AddBotForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const router = useRouter();

  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const result = await api<CreateResponse>("/api/bots", {
      json: {
        token: token.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      },
    });

    setBusy(false);
    if (!result.ok) {
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }

    // Token endi serverda — formada qoldirmaymiz.
    setToken("");
    setName("");
    setDescription("");
    onDone();
    router.push(`/bots/${result.data.bot.id}`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title={t.bots.addTitle} subtitle={t.bots.addSubtitle} />
      <form onSubmit={submit} className="space-y-4 p-5">
        <Field label={t.bots.tokenLabel} hint={t.bots.tokenHint} htmlFor="bot-token">
          <Input
            id="bot-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t.bots.tokenPlaceholder}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.bots.nameLabel} hint={t.bots.nameHint} htmlFor="bot-name">
            <Input
              id="bot-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.bots.namePlaceholder}
              maxLength={64}
            />
          </Field>
          <Field label={t.bots.descriptionLabel} htmlFor="bot-description">
            <Textarea
              id="bot-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.bots.descriptionPlaceholder}
              rows={2}
              maxLength={512}
            />
          </Field>
        </div>

        {error ? <Alert>{error}</Alert> : null}

        <div className="rounded-lg bg-surface-inset px-3 py-2.5">
          <p className="text-xs font-medium text-ink">{t.bots.howToTitle}</p>
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-xs text-ink-muted">
            <li>{t.bots.howTo1}</li>
            <li>{t.bots.howTo2}</li>
            <li>{t.bots.howTo3}</li>
          </ol>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={busy || token.trim().length < 20}>
            {busy ? t.bots.creating : t.bots.create}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone} disabled={busy}>
            {t.common.cancel}
          </Button>
        </div>
      </form>
    </Card>
  );
}
