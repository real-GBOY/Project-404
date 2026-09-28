import { useState } from "react";
import {
  useChangeRole,
  useRemoveStaff,
  useRoleMatrix,
  useStaff,
  type StaffMember,
} from "@/api/staff";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { errorMessage } from "@/lib/errors";
import { useToast } from "@/components/ui/toast";
import { formatRelative } from "@/lib/format";
import { AddStaffDialog } from "./add-staff-dialog";
import { PermissionMatrix } from "./permission-matrix";
import { AuditLog } from "./audit-log";

type Tab = "directory" | "permissions" | "audit";

/**
 * Staff & Permissions (design): the directory, the role → permission matrix, and the audit log
 * (for those with `read:audit_log`).
 */
export function StaffPage() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>("directory");
  const [adding, setAdding] = useState(false);
  const canManage = auth.can("manage:staff");

  return (
    <>
      <PageHeader
        title="Staff & Permissions"
        actions={canManage ? <Button onClick={() => setAdding(true)}>+ Add staff</Button> : null}
      />
      <div className="mb-5">
        <FilterTabs
          label="Staff sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "directory", label: "Directory" },
            { value: "permissions", label: "Roles & Permissions" },
            ...(auth.can("read:audit_log")
              ? [{ value: "audit" as const, label: "Audit Log" }]
              : []),
          ]}
        />
      </div>
      {tab === "directory" ? (
        <Directory canManage={canManage} />
      ) : tab === "permissions" ? (
        <PermissionsTab />
      ) : (
        <AuditLog />
      )}
      {adding ? <AddStaffDialog onClose={() => setAdding(false)} /> : null}
    </>
  );
}

function Directory({ canManage }: { canManage: boolean }) {
  const staff = useStaff();
  const roles = useRoleMatrix();
  const auth = useAuth();

  // Granting or taking away Owner needs manage:role (the server enforces the same rule).
  const canManageRoles = auth.can("manage:role");
  if (staff.isLoading) return <LoadingState />;
  if (staff.error) return <ErrorState error={staff.error} />;
  const cols = canManage
    ? "md:grid-cols-[1.3fr_1fr_0.8fr_0.9fr_auto]"
    : "md:grid-cols-[1.3fr_1fr_0.8fr_0.9fr]";

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <div
        className={`hidden border-b border-border bg-canvas px-4 py-3 text-micro font-bold text-faint uppercase md:grid ${cols}`}
      >
        <div>Name</div>
        <div>Role</div>
        <div>Status</div>
        <div>Last active</div>
        {canManage ? <div className="w-[170px]" /> : null}
      </div>
      <ul className="m-0 list-none p-0">
        {staff.data!.map((m) => (
          <StaffRow
            key={m.userId}
            member={m}
            cols={cols}
            showActions={canManage}
            roleOptions={(roles.data?.roles ?? []).filter(
              (r) => r.key !== "owner" || canManageRoles,
            )}
            editable={
              canManage && m.userId !== auth.user?.id && (m.roleKey !== "owner" || canManageRoles)
            }
          />
        ))}
      </ul>
    </div>
  );
}

function StaffRow({
  member,
  cols,
  roleOptions,
  editable,
  showActions,
}: {
  member: StaffMember;
  cols: string;
  showActions: boolean;
  roleOptions: Array<{ key: string; name: string }>;
  editable: boolean;
}) {
  const changeRole = useChangeRole();
  const remove = useRemoveStaff();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  async function onRole(roleKey: string) {
    setError(null);
    try {
      await changeRole.mutateAsync({ userId: member.userId, roleKey });
      toast(`${member.name} is now ${roleOptions.find((r) => r.key === roleKey)?.name ?? roleKey}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onRemove() {
    setError(null);
    try {
      await remove.mutateAsync(member.userId);
      toast(`${member.name} removed from staff`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <li className="border-b border-divider px-4 py-[13px] last:border-b-0">
      <div className={`grid grid-cols-2 items-center gap-2 ${cols}`}>
        <div className="col-span-2 md:col-span-1">
          <div className="text-small font-semibold">{member.name}</div>
          <div className="text-label text-faint">{member.email}</div>
        </div>
        <div className="text-small">
          {editable ? (
            <select
              aria-label={`Role for ${member.name}`}
              value={member.roleKey ?? ""}
              onChange={(e) => void onRole(e.target.value)}
              disabled={changeRole.isPending}
              className="cursor-pointer rounded-control border border-border bg-canvas px-2 py-1.5 text-small"
            >
              {member.roleKey ? null : <option value="">No role</option>}
              {roleOptions.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          ) : (
            (member.roleName ?? "—")
          )}
        </div>
        <div>
          <StatusBadge
            status={member.status}
            label={member.status === "pending" ? "Invited" : undefined}
          />
        </div>
        <div className="text-label text-muted">{formatRelative(member.lastActiveAt)}</div>
        {showActions ? (
          <div className="flex w-[170px] justify-end">
            {editable ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void onRemove()}
                disabled={remove.isPending}
              >
                Remove
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {error ? (
        <div role="alert" className="mt-2 text-label font-semibold text-danger">
          {error}
        </div>
      ) : null}
    </li>
  );
}

function PermissionsTab() {
  const matrix = useRoleMatrix();
  if (matrix.isLoading) return <LoadingState />;
  if (matrix.error || !matrix.data) return <ErrorState error={matrix.error} />;
  return <PermissionMatrix matrix={matrix.data} />;
}
