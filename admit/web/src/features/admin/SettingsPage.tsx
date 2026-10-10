import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/api";
import type { TeamMember, TeamRole } from "@/api/types";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ResetPasswordDialog } from "@/components/PasswordDialogs";
import { SelectField, TextField } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { QueryState } from "@/components/QueryState";
import { useToast } from "@/components/Toast";
import { errorText } from "@/lib/errors";
import { ApiError } from "@/services/http";
import { Forbidden } from "./AdminApp";
import { useAuth } from "./auth";
import { MATRIX } from "./permission-matrix";
import { Card, CardHead } from "./parts";

export function SettingsPage() {
  const { can } = useAuth();
  if (!can("manage:event_staff") && !can("read:admit_settings"))
    return <Forbidden needs="manage:event_staff" />;
  return (
    <>
      <h1 className="sr-only">Settings</h1>
      {can("read:admit_settings") ? <Organizer /> : null}
      {can("manage:event_staff") ? <Team /> : null}
    </>
  );
}

function Organizer() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => adminApi.settings.get() });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (q.data) {
      setName(q.data.organizerName);
      setEmail(q.data.supportEmail ?? "");
    }
  }, [q.data]);
  const save = useMutation({
    mutationFn: () =>
      adminApi.settings.update({ organizerName: name.trim(), supportEmail: email.trim() || null }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      toast.show("Organizer settings saved");
    },
  });
  const editable = can("update:admit_settings");
  return (
    <Card tone="ink">
      <CardHead title="Organizer" />
      <QueryState query={q}>
        {() => (
          <form
            className="grid gap-4 p-5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <TextField
              label="Organizer name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!editable}
              hint="Shown on the public site and in every email."
            />
            <TextField
              label="Support email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!editable}
              hint="Customers reply here; shown in email footers."
            />
            {save.isError ? (
              <p role="alert" className="text-sm text-bad-solid sm:col-span-2">
                {errorText(save.error)}
              </p>
            ) : null}
            {editable ? (
              <div>
                <Button type="submit" variant="ink" size="md" loading={save.isPending}>
                  Save
                </Button>
              </div>
            ) : null}
          </form>
        )}
      </QueryState>
    </Card>
  );
}

function Team() {
  const { can, me } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "team"], queryFn: () => adminApi.team.get() });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("event_manager");
  const [create, setCreate] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [resetting, setResetting] = useState<TeamMember | null>(null);
  const toast = useToast();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "team"] });
  const add = useMutation({
    mutationFn: () =>
      adminApi.team.add(email.trim(), role, create ? { name: name.trim(), password } : undefined),
    onSuccess: async () => {
      setEmail("");
      setName("");
      setPassword("");
      setCreate(false);
      await refresh();
    },
    // an unknown email is the cue to offer creating the account right here
    onError: (err) => {
      if (err instanceof ApiError && err.code === "admit.no_account") setCreate(true);
    },
  });
  const removeMember = useMutation({
    mutationFn: (m: TeamMember) => adminApi.team.removeMember(m.userId),
    onSuccess: refresh,
    onSettled: () => setRemoving(null),
  });
  const remove = useMutation({
    mutationFn: (v: { userId: string; role: string }) => adminApi.team.removeRole(v.userId, v.role),
    onSuccess: refresh,
  });
  const manage = can("assign:role") && can("manage_members:organization");
  return (
    <>
      <Card tone="ink">
        <CardHead
          title="Staff & roles"
          action={
            <span className="text-xs font-semibold text-used-fg">
              ! Roles decide who can approve payments
            </span>
          }
        />
        <QueryState query={q}>
          {(t) => (
            <>
              <ul className="m-0 list-none p-0">
                {t.members.map((m: TeamMember) => (
                  <li
                    key={m.userId}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-rule-soft px-5 py-3"
                  >
                    <span className="flex flex-col">
                      <span className="font-semibold">{m.name}</span>
                      <span className="text-xs text-muted">{m.email}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {m.roles.length === 0 ? (
                        <span className="text-xs text-muted">No role</span>
                      ) : null}
                      {m.roles.map((r) => (
                        <span
                          key={r.key}
                          className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold"
                        >
                          {r.name}
                          {manage ? (
                            <button
                              aria-label={`Remove ${r.name} from ${m.name}`}
                              className="text-muted hover:text-bad-solid"
                              onClick={() => remove.mutate({ userId: m.userId, role: r.key })}
                            >
                              ✕
                            </button>
                          ) : null}
                        </span>
                      ))}
                      {manage ? (
                        <button
                          className="ml-2 text-xs font-semibold underline"
                          onClick={() => setResetting(m)}
                        >
                          Reset password
                        </button>
                      ) : null}
                      {manage && m.email !== me?.user.email ? (
                        <button
                          className="ml-2 text-xs font-semibold text-bad-solid underline"
                          onClick={() => setRemoving(m)}
                        >
                          Remove person
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              {remove.isError || removeMember.isError ? (
                <p role="alert" className="px-5 py-2 text-sm text-bad-solid">
                  {errorText(remove.error ?? removeMember.error)}
                </p>
              ) : null}
              {manage ? (
                <form
                  className="flex flex-wrap items-end gap-3 border-t border-rule bg-paper px-5 py-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    add.mutate();
                  }}
                >
                  <div className="min-w-[220px] flex-1">
                    <TextField
                      label="Add a person by email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10"
                      hint="An existing account is added as is; for a new person, create their account below."
                    />
                  </div>
                  <div className="w-52">
                    <SelectField
                      label="Role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="h-10"
                    >
                      {t.roles.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <label className="flex basis-full items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-ink"
                      checked={create}
                      onChange={(e) => setCreate(e.target.checked)}
                    />
                    This person has no account yet: create one for them
                  </label>
                  {create ? (
                    <>
                      <div className="min-w-[220px] flex-1">
                        <TextField
                          label="Full name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-10"
                        />
                      </div>
                      <div className="min-w-[220px] flex-1">
                        <TextField
                          label="Starting password"
                          type="text"
                          autoComplete="off"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-10"
                          hint="At least 10 characters. Tell them in person; they can change it after signing in."
                        />
                      </div>
                    </>
                  ) : null}
                  <Button
                    type="submit"
                    variant="ink"
                    size="md"
                    loading={add.isPending}
                    disabled={
                      !email.includes("@") ||
                      (create && (name.trim().length < 2 || password.length < 10))
                    }
                  >
                    {create ? "Create account & add" : "Add"}
                  </Button>
                  {add.isError ? (
                    <p role="alert" className="basis-full text-sm text-bad-solid">
                      {errorText(add.error)}
                    </p>
                  ) : null}
                </form>
              ) : (
                <div className="px-5 py-3">
                  <Notice tone="info">Only an owner can add people or change roles.</Notice>
                </div>
              )}
            </>
          )}
        </QueryState>
        <ResetPasswordDialog
          person={resetting ? { userId: resetting.userId, name: resetting.name } : null}
          onClose={() => setResetting(null)}
          onDone={() => {
            setResetting(null);
            toast.show("Password set");
          }}
        />
        <ConfirmDialog
          open={removing !== null}
          onClose={() => setRemoving(null)}
          title={`Remove ${removing?.name ?? "this person"}?`}
          confirmLabel="Remove from the team"
          busy={removeMember.isPending}
          onConfirm={() => removing && removeMember.mutate(removing)}
        >
          <p>
            They lose every role and every event assignment, and can no longer open this dashboard
            or the scanner. Their account and everything they did (decisions, scans, the audit
            trail) stays on record. You cannot remove yourself or the last owner.
          </p>
        </ConfirmDialog>
      </Card>

      <Card tone="ink">
        <CardHead title="Roles & permissions" />
        <QueryState query={q}>
          {(t) => (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-ink text-left text-[11px] uppercase tracking-[0.06em] text-ink-2">
                    <th scope="col" className="px-5 py-2.5">
                      Permission
                    </th>
                    {t.roles.map((r: TeamRole) => (
                      <th key={r.key} scope="col" className="px-2 py-2.5 text-center">
                        {r.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MATRIX.map(([label, key]) => (
                    <tr key={key} className="border-b border-rule-soft">
                      <td className="px-5 py-2">{label}</td>
                      {t.roles.map((r) => {
                        const on = r.permissions.includes(key) || r.permissions.includes("*:*");
                        return (
                          <td
                            key={r.key}
                            className={`px-2 py-2 text-center font-bold ${on ? "text-ok-fg" : "text-[#b5aea3]"}`}
                            aria-label={on ? "Allowed" : "Not allowed"}
                          >
                            {on ? "✓" : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
        <p className="px-5 py-3 text-xs text-muted">
          Which events a person can open is separate: people without “See every event” only reach
          events they are assigned to (set under each event).
        </p>
      </Card>
    </>
  );
}
