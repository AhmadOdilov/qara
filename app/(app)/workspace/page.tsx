import type { Metadata } from "next";
import {
  requireWorkspace,
  listWorkspaces,
  can,
  type Capability,
} from "@/lib/workspace";
import { listMembers } from "@/lib/workspace-members";
import { getDictionary } from "@/lib/i18n/server";
import { Card, CardHeader, EmptyState, PageHeading } from "@/components/ui";
import { MembersPanel, type Member } from "@/components/workspace/members-panel";
import { WorkspaceSwitcher } from "@/components/workspace/switcher";
import { IconShield, IconUsers } from "@/components/icons";

export const metadata: Metadata = { title: "Ish maydoni" };

/**
 * Ish maydoni sozlamalari (§21).
 *
 * Huquq tekshiruvi IKKI qatlamda:
 *   · shu sahifa `member:manage` bo'lmasa a'zolar ro'yxatini umuman
 *     yuklamaydi — ma'lumot klientga chiqmaydi;
 *   · API route'lari ham har so'rovda mustaqil tekshiradi, ya'ni UI ni
 *     chetlab o'tib so'rov yuborish ish bermaydi.
 */
export default async function WorkspacePage() {
  const ctx = await requireWorkspace();
  const { t } = await getDictionary();

  const canManage = can(ctx.role, "member:manage");
  const workspaces = await listWorkspaces(ctx.user.id);

  // Ruxsat bo'lmasa a'zolar ro'yxati o'qilmaydi ham.
  const members: Member[] = canManage
    ? (await listMembers(ctx)).map((row) => ({
        ...row,
        joinedAt: row.joinedAt.toISOString(),
      }))
    : [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PageHeading title={ctx.workspaceName} subtitle={t.workspace.subtitle} />

        <WorkspaceSwitcher options={workspaces} activeId={ctx.workspaceId} />

        {canManage ? (
          <MembersPanel initial={members} canManage={canManage} />
        ) : (
          <Card>
            <EmptyState
              icon={<IconUsers width={28} height={28} />}
              title={t.workspace.noAccessTitle}
              body={t.workspace.noAccessBody}
            />
          </Card>
        )}

        {/* ── Huquqlar matritsasi ────────────────────────────────────────
            Jadval `CAPABILITIES` dan hisoblanadi — ro'yxat ikki joyda
            takrorlanmaydi va kod o'zgarsa jadval o'zi yangilanadi. */}
        <div className="mt-4">
          <Card>
            <CardHeader
              title={t.workspace.permissionsTitle}
              subtitle={t.workspace.permissionsHint}
              icon={<IconShield width={16} height={16} />}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-sunken">
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-left text-xs font-medium text-ink-subtle"
                    >
                      &nbsp;
                    </th>
                    {ROLES.map((role) => (
                      <th
                        key={role}
                        scope="col"
                        className="px-3 py-2.5 text-left text-xs font-medium text-ink"
                      >
                        {t.workspace[roleKey(role)]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MATRIX.map((row, index) => (
                    <tr
                      key={row.capability}
                      className={index === MATRIX.length - 1 ? "" : "border-b border-line"}
                    >
                      <th
                        scope="row"
                        className="px-5 py-2.5 text-left text-xs font-normal text-ink-muted"
                      >
                        {t.workspace[row.labelKey]}
                      </th>
                      {ROLES.map((role) => (
                        <td key={role} className="px-3 py-2.5">
                          {can(role, row.capability) ? (
                            <span className="text-success" title={t.workspace.yes}>
                              ✓
                            </span>
                          ) : (
                            <span className="text-ink-subtle" title={t.workspace.no}>
                              —
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const ROLES = ["owner", "admin", "editor", "support", "viewer"] as const;

type Role = (typeof ROLES)[number];

function roleKey(role: Role) {
  const map = {
    owner: "roleOwner",
    admin: "roleAdmin",
    editor: "roleEditor",
    support: "roleSupport",
    viewer: "roleViewer",
  } as const;
  return map[role];
}

/** Jadval qatorlari — har biri HAQIQIY `Capability` ga bog'langan. */
const MATRIX: {
  capability: Capability;
  labelKey:
    | "capBots"
    | "capBotEdit"
    | "capBotDelete"
    | "capSecrets"
    | "capMembers"
    | "capApiKeys"
    | "capAnalytics"
    | "capWorkspace";
}[] = [
  { capability: "bot:read", labelKey: "capBots" },
  { capability: "bot:edit", labelKey: "capBotEdit" },
  { capability: "bot:delete", labelKey: "capBotDelete" },
  { capability: "secret:write", labelKey: "capSecrets" },
  { capability: "member:manage", labelKey: "capMembers" },
  { capability: "apikey:manage", labelKey: "capApiKeys" },
  { capability: "analytics:read", labelKey: "capAnalytics" },
  { capability: "workspace:manage", labelKey: "capWorkspace" },
];
