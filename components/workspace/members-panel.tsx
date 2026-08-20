"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { friendly, type FriendlyError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/provider";
import { fill } from "@/lib/i18n/dictionaries";
import { Badge, Button, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { ErrorAlert } from "@/components/error-alert";
import { Modal } from "@/components/overlays";
import { IconTrash, IconUser } from "@/components/icons";

/**
 * Ish maydoni a'zolari (§21).
 *
 * UI huquqqa qarab o'zgaradi, LEKIN u himoya emas: har bir so'rov serverda
 * `member:manage` bo'yicha qayta tekshiriladi (`guardWorkspace`). Bu yerdagi
 * yashirish faqat foydalanuvchi ishlamaydigan tugma qidirib vaqt
 * sarflamasligi uchun.
 */

export type Role = "owner" | "admin" | "editor" | "support" | "viewer";

export type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  joinedAt: string;
  isSelf: boolean;
};

const ASSIGNABLE: Role[] = ["admin", "editor", "support", "viewer"];

export function MembersPanel({
  initial,
  canManage,
}: {
  initial: Member[];
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [members, setMembers] = useState<Member[]>(initial);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Member | null>(null);

  const roleLabel: Record<Role, string> = {
    owner: t.workspace.roleOwner,
    admin: t.workspace.roleAdmin,
    editor: t.workspace.roleEditor,
    support: t.workspace.roleSupport,
    viewer: t.workspace.roleViewer,
  };

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await api<{ member: Member }>("/api/workspace/members", {
      json: { email, role },
    });

    if (result.ok) {
      setMembers((current) => [...current, result.data.member]);
      setEmail("");
    } else {
      setError(friendly(result, t));
    }
    setBusy(false);
  }

  async function updateRole(member: Member, next: Role) {
    const previous = members;
    // Optimistik: ro'yxat darhol yangilanadi, xato bo'lsa oldingi holat qaytadi.
    setMembers((current) =>
      current.map((row) => (row.id === member.id ? { ...row, role: next } : row)),
    );
    setError(null);

    const result = await api(`/api/workspace/members/${member.id}`, {
      method: "PATCH",
      json: { role: next },
    });

    if (!result.ok) {
      setMembers(previous);
      setError(friendly(result, t));
    }
  }

  async function remove(member: Member) {
    setBusy(true);
    setError(null);

    const result = await api(`/api/workspace/members/${member.id}`, {
      method: "DELETE",
    });

    if (result.ok) {
      setMembers((current) => current.filter((row) => row.id !== member.id));
      setPendingRemove(null);
    } else {
      setError(friendly(result, t));
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <ErrorAlert error={error} />

      <Card>
        <CardHeader
          title={t.workspace.membersTitle}
          subtitle={fill(t.workspace.membersCount, {
            count: String(members.length),
          })}
        />
        <ul className="divide-y divide-line">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3.5"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-inset text-ink-subtle">
                <IconUser width={18} height={18} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                  {member.name}
                  {member.isSelf ? (
                    <Badge tone="neutral">{t.workspace.you}</Badge>
                  ) : null}
                </p>
                <p className="truncate text-xs text-ink-subtle">{member.email}</p>
              </div>

              {/* Ega roli va o'z rolimiz o'zgarmaydi — serverda ham shunday. */}
              {canManage && member.role !== "owner" && !member.isSelf ? (
                <>
                  <Select
                    aria-label={t.workspace.changeRole}
                    value={member.role}
                    onChange={(event) =>
                      void updateRole(member, event.target.value as Role)
                    }
                    className="w-36"
                  >
                    {ASSIGNABLE.map((value) => (
                      <option key={value} value={value}>
                        {roleLabel[value]}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="ghost"
                    onClick={() => setPendingRemove(member)}
                    aria-label={t.workspace.remove}
                  >
                    <IconTrash width={16} height={16} />
                  </Button>
                </>
              ) : (
                <Badge tone={member.role === "owner" ? "accent" : "neutral"}>
                  {roleLabel[member.role]}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader title={t.workspace.addTitle} subtitle={t.workspace.addHint} />
          <form onSubmit={add} className="flex flex-wrap items-end gap-3 px-5 pb-5">
            <div className="min-w-56 flex-1">
              <Field label={t.workspace.emailLabel} htmlFor="member-email">
                <Input
                  id="member-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t.workspace.emailPlaceholder}
                />
              </Field>
            </div>
            <div className="w-40">
              <Field label={t.workspace.roleLabel} htmlFor="member-role">
                <Select
                  id="member-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                >
                  {ASSIGNABLE.map((value) => (
                    <option key={value} value={value}>
                      {roleLabel[value]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? t.workspace.adding : t.workspace.add}
            </Button>
          </form>
          <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-ink-subtle">
            {t.workspace.inviteSoon}
          </p>
        </Card>
      ) : null}

      {/* Chiqarish qaytarilmaydigan amal emas, lekin kutilmagan bo'lmasin. */}
      {pendingRemove ? (
        <Modal
          open
          onClose={() => setPendingRemove(null)}
          busy={busy}
          size="sm"
          title={t.workspace.removeConfirmTitle}
          description={fill(t.workspace.removeConfirmBody, {
            name: pendingRemove.name,
          })}
          closeLabel={t.common.close}
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setPendingRemove(null)}
                disabled={busy}
              >
                {t.common.cancel}
              </Button>
              <Button
                variant="danger"
                loading={busy}
                onClick={() => void remove(pendingRemove)}
              >
                {t.workspace.removeConfirm}
              </Button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
