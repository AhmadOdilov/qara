"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useI18n } from "@/lib/i18n/provider";
import { api, formatDayLabel, formatTime } from "@/lib/client";
import { Alert, Button, EmptyState, Input, Toggle } from "@/components/ui";
import {
  IconAlert,
  IconChat,
  IconSend,
  IconTelegram,
} from "@/components/icons";
import { cn } from "@/lib/cn";

export type ChatMessage = {
  id: string;
  direction: "outgoing" | "incoming";
  fromUser: boolean;
  content: string;
  kind: string;
  status: "pending" | "sent" | "failed";
  error: string | null;
  timestamp: string;
};

const POLL_INTERVAL_MS = 3000;

export function Chat({
  initialMessages,
  linked,
  mockMode,
  quietDefault,
}: {
  initialMessages: ChatMessage[];
  linked: boolean;
  mockMode: boolean;
  quietDefault: boolean;
}) {
  const { lang, t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [silent, setSilent] = useState(quietDefault);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simDraft, setSimDraft] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Foydalanuvchi tarixni yuqoriga surib o'qiyotgan bo'lsa, yangi xabar
  // kelganda uni pastga otib yubormaymiz.
  const pinnedToBottom = useRef(true);

  const lastTimestamp = messages.at(-1)?.timestamp;

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((current) => {
      const seen = new Set(current.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      return fresh.length ? [...current, ...fresh] : current;
    });
  }, []);

  // Yangi xabarlarni davriy so'rab turamiz. Sahifa fonda bo'lsa so'ramaymiz.
  useEffect(() => {
    if (!linked) return;
    let cancelled = false;

    const tick = async () => {
      if (document.hidden) return;
      const query = lastTimestamp
        ? `?after=${encodeURIComponent(lastTimestamp)}`
        : "";
      const result = await api<{ messages: ChatMessage[] }>(
        `/api/messages${query}`,
      );
      if (!cancelled && result.ok) merge(result.data.messages);
    };

    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [linked, lastTimestamp, merge]);

  useLayoutEffect(() => {
    if (pinnedToBottom.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  function onScroll() {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    pinnedToBottom.current = distance < 80;
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    setError(null);
    pinnedToBottom.current = true;

    const result = await api<{ message: ChatMessage; warning?: string }>(
      "/api/messages",
      { json: { content, silent } },
    );

    setSending(false);

    if (!result.ok) {
      setError(result.error === "network" ? t.errors.network : result.error);
      return;
    }

    setDraft("");
    merge([result.data.message]);
    if (result.data.warning) setError(result.data.warning);
  }

  async function simulate(event: FormEvent) {
    event.preventDefault();
    const text = simDraft.trim();
    if (!text || simulating) return;

    setSimulating(true);
    setError(null);
    const result = await api("/api/telegram/simulate", { json: { text } });
    setSimulating(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSimDraft("");
    pinnedToBottom.current = true;

    // Simulyatsiya qilingan xabar darhol ko'rinsin — polling'ni kutmaymiz.
    const fresh = await api<{ messages: ChatMessage[] }>(
      `/api/messages${lastTimestamp ? `?after=${encodeURIComponent(lastTimestamp)}` : ""}`,
    );
    if (fresh.ok) merge(fresh.data.messages);
  }

  const grouped = groupByDay(messages);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Xabarlar */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scroll-slim min-h-0 flex-1 overflow-y-auto bg-surface-sunken px-4 py-5"
      >
        {messages.length === 0 ? (
          <EmptyState
            icon={<IconChat width={28} height={28} />}
            title={t.chat.emptyTitle}
            body={linked ? t.chat.emptyBody : t.chat.connectFirst}
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {grouped.map(([day, items]) => (
              <div key={day} className="space-y-2">
                <div className="flex justify-center">
                  <span className="rounded-full bg-surface-raised px-3 py-1 text-[11px] font-medium text-ink-subtle">
                    {/* Yorliq to'liq vaqt tamg'asidan chiziladi: `YYYY-MM-DD`
                        satri UTC yarim tuni sifatida o'qilib, manfiy siljishli
                        mintaqalarda bir kun orqaga ketardi. */}
                    {formatDayLabel(items[0].timestamp, lang)}
                  </span>
                </div>
                {items.map((message) => (
                  <Bubble
                    key={message.id}
                    message={message}
                    lang={lang}
                    failedLabel={t.chat.failed}
                  />
                ))}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Yozish paneli */}
      <div className="border-t border-line bg-surface-raised px-4 py-3">
        <div className="mx-auto max-w-3xl space-y-2">
          {error ? <Alert>{error}</Alert> : null}

          <form onSubmit={send} className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={linked ? t.chat.placeholder : t.chat.connectFirst}
              disabled={!linked || sending}
              maxLength={4096}
              aria-label={t.chat.placeholder}
              className="h-11"
            />
            <Button
              type="submit"
              size="lg"
              disabled={!linked || sending || !draft.trim()}
              aria-label={t.chat.send}
            >
              <IconSend width={18} height={18} />
              <span className="hidden sm:inline">
                {sending ? t.chat.sending : t.chat.send}
              </span>
            </Button>
          </form>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Toggle
                checked={silent}
                onChange={setSilent}
                label={t.chat.silentMode}
                hint={t.chat.silentHint}
                disabled={!linked}
              />
            </div>
          </div>

          {mockMode && linked ? (
            <form
              onSubmit={simulate}
              className="flex items-center gap-2 border-t border-line pt-3"
            >
              <span className="hidden shrink-0 items-center gap-1.5 text-xs text-ink-subtle sm:flex">
                <IconTelegram width={14} height={14} />
                {t.chat.simulate}
              </span>
              <Input
                value={simDraft}
                onChange={(event) => setSimDraft(event.target.value)}
                placeholder={t.chat.simulatePlaceholder}
                disabled={simulating}
                maxLength={2000}
                aria-label={t.chat.simulate}
                className="h-9 text-xs"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={simulating || !simDraft.trim()}
              >
                {simulating ? t.common.loading : "↩"}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Bubble({
  message,
  lang,
  failedLabel,
}: {
  message: ChatMessage;
  lang: string;
  failedLabel: string;
}) {
  const mine = message.fromUser;
  const failed = message.status === "failed";

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 sm:max-w-[70%]",
          mine
            ? "rounded-br-sm bg-accent text-accent-fg"
            : "rounded-bl-sm border border-line bg-surface-raised text-ink",
          failed && "opacity-70 ring-1 ring-danger",
        )}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content}
        </p>
        <p
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[11px]",
            mine ? "text-accent-fg/70" : "text-ink-subtle",
          )}
        >
          {message.status === "pending" ? "…" : null}
          {failed ? (
            <span className="flex items-center gap-1 text-danger">
              <IconAlert width={12} height={12} />
              {failedLabel}
            </span>
          ) : null}
          {formatTime(message.timestamp, lang)}
        </p>
      </div>
    </div>
  );
}

/**
 * Xabarlarni kun bo'yicha guruhlash — chatlarda odatiy ajratgich.
 *
 * Kalit MAHALLIY sana bo'yicha yig'iladi. ISO satrini kesib olish (UTC)
 * noto'g'ri bo'lardi: pufakchadagi soat mahalliy vaqtda ko'rsatiladi, shuning
 * uchun UTC+5 da yarim kechadan keyingi xabar «kecha» ajratgichi ostiga
 * tushib qolardi.
 */
function dayKey(timestamp: string): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function groupByDay(messages: ChatMessage[]): [string, ChatMessage[]][] {
  const groups = new Map<string, ChatMessage[]>();
  for (const message of messages) {
    const key = dayKey(message.timestamp);
    const bucket = groups.get(key);
    if (bucket) bucket.push(message);
    else groups.set(key, [message]);
  }
  return [...groups.entries()];
}
