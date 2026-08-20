"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { api, formatDate, formatTime } from "@/lib/client";
import { Alert, Badge, Button, Input } from "@/components/ui";
import { IconTelegram } from "@/components/icons";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  lang: string;
  linked: boolean;
  telegramUsername: string | null;
  messages: number;
  createdAt: string;
};

export function UsersTable({
  rows,
  currentUserId,
  query: initialQuery = "",
}: {
  rows: AdminUserRow[];
  currentUserId: string;
  /** URL'dagi joriy qidiruv — server tomonda qo'llanilgan. */
  query?: string;
}) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
    Qidiruv endi SERVER tomonda.

    Ilgari klient faqat yuklangan qatorlarni filtrlardi — 200-chidan
    keyingi foydalanuvchi umuman topilmasdi. Endi so'rov URL'ga yoziladi va
    server butun jadval bo'yicha qidiradi.

    Debounce: har bosilgan harfda so'rov yubormaymiz.
  */
  useEffect(() => {
    if (query === initialQuery) return;
    const timer = setTimeout(() => {
      const search = new URLSearchParams();
      if (query.trim()) search.set("q", query.trim());
      router.push(search.toString() ? `/admin?${search}` : "/admin");
    }, 350);
    return () => clearTimeout(timer);
  }, [query, initialQuery, router]);

  // Server allaqachon filtrlagan — bu yerda qayta filtrlash shart emas.
  const filtered = rows;

  async function toggleRole(row: AdminUserRow) {
    setPendingId(row.id);
    setError(null);
    const result = await api("/api/admin/users", {
      method: "PATCH",
      json: { userId: row.id, role: row.role === "admin" ? "user" : "admin" },
    });
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="border-b border-line px-5 py-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.common.search}
          aria-label={t.common.search}
          className="h-9 max-w-xs"
        />
      </div>

      {error ? (
        <div className="px-5 pt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="scroll-slim overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-subtle">
              <Th>{t.admin.colUser}</Th>
              <Th>{t.admin.colTelegram}</Th>
              <Th className="text-right">{t.admin.colMessages}</Th>
              <Th>{t.admin.colLang}</Th>
              <Th>{t.admin.colRole}</Th>
              <Th>{t.admin.colJoined}</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-surface-inset/60">
                <Td>
                  <p className="font-medium text-ink">{row.name}</p>
                  <p className="text-xs text-ink-subtle">{row.email}</p>
                </Td>
                <Td>
                  {row.linked ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink">
                      <IconTelegram width={14} height={14} className="text-accent" />
                      {row.telegramUsername ? `@${row.telegramUsername}` : "—"}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-subtle">—</span>
                  )}
                </Td>
                <Td className="text-right tabular-nums text-ink">{row.messages}</Td>
                <Td>
                  <span className="text-xs uppercase text-ink-muted">{row.lang}</span>
                </Td>
                <Td>
                  {row.role === "admin" ? (
                    <Badge tone="accent">admin</Badge>
                  ) : (
                    <Badge>user</Badge>
                  )}
                </Td>
                <Td className="text-xs text-ink-muted">
                  {formatDate(row.createdAt, lang)}
                </Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pendingId === row.id || row.id === currentUserId}
                    onClick={() => toggleRole(row)}
                  >
                    {row.role === "admin" ? t.admin.removeAdmin : t.admin.makeAdmin}
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-subtle">
          {t.common.empty}
        </p>
      ) : null}
    </div>
  );
}

export type AdminMessageRow = {
  id: string;
  userName: string;
  direction: "outgoing" | "incoming";
  content: string;
  status: string;
  timestamp: string;
};

export function MessagesTable({ rows }: { rows: AdminMessageRow[] }) {
  const { lang, t } = useI18n();

  if (rows.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-ink-subtle">
        {t.common.empty}
      </p>
    );
  }

  return (
    <div className="scroll-slim overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-subtle">
            <Th>{t.admin.colUser}</Th>
            <Th>{t.admin.colDirection}</Th>
            <Th>{t.admin.colContent}</Th>
            <Th>{t.admin.colStatus}</Th>
            <Th>{t.admin.colTime}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface-inset/60">
              <Td className="whitespace-nowrap text-ink">{row.userName}</Td>
              <Td>
                <Badge tone={row.direction === "outgoing" ? "accent" : "neutral"}>
                  {row.direction === "outgoing" ? "→ TG" : "← TG"}
                </Badge>
              </Td>
              <Td className="max-w-md">
                <span className="line-clamp-2 text-ink-muted">{row.content}</span>
              </Td>
              <Td>
                <Badge
                  tone={
                    row.status === "failed"
                      ? "danger"
                      : row.status === "pending"
                        ? "neutral"
                        : "success"
                  }
                >
                  {row.status}
                </Badge>
              </Td>
              <Td className="whitespace-nowrap text-xs text-ink-subtle">
                {formatDate(row.timestamp, lang)} {formatTime(row.timestamp, lang)}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-5 py-2.5 font-medium ${className ?? ""}`}>{children}</th>
  );
}

function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-5 py-3 align-top ${className ?? ""}`}>{children}</td>;
}
