import { useState } from "react";
import type { RoleMatrix } from "@/api/staff";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { statusLabel } from "@/lib/status";

const RESOURCE_LABEL: Record<string, string> = {
  hotel_settings: "Settings",
  staff: "Staff",
  room: "Rooms",
  guest: "Guests",
};

/**
 * The design's permission view: role pills, then each resource group with ✓ / ✕ per action.
 * Read-only by design — roles are shared by every hotel on the deployment, so editing one here
 * would silently change it everywhere (see backend StaffService.roles).
 */
export function PermissionMatrix({ matrix }: { matrix: RoleMatrix }) {
  const [roleKey, setRoleKey] = useState(matrix.roles[0]?.key ?? "");
  const role = matrix.roles.find((r) => r.key === roleKey);
  const granted = new Set(role?.permissionKeys ?? []);

  const groups = new Map<string, RoleMatrix["permissions"]>();
  for (const p of matrix.permissions) {
    const list = groups.get(p.resource) ?? [];
    list.push(p);
    groups.set(p.resource, list);
  }

  return (
    <div>
      <div className="mb-4">
        <FilterTabs
          label="Roles"
          size="sm"
          value={roleKey}
          onChange={setRoleKey}
          tabs={matrix.roles.map((r) => ({ value: r.key, label: r.name }))}
        />
      </div>
      {role?.description ? (
        <p className="m-0 mb-3 text-small text-muted">{role.description}</p>
      ) : null}
      <div className="max-w-[440px] rounded-card border border-border bg-surface p-5">
        {[...groups.entries()].map(([resource, perms]) => (
          <section key={resource} className="mb-[18px] last:mb-0">
            <h3 className="m-0 mb-2 text-label font-bold tracking-[0.04em] text-faint uppercase">
              {RESOURCE_LABEL[resource] ?? statusLabel(resource)}
            </h3>
            {perms.map((p) => {
              const has = granted.has(p.key);
              return (
                <div key={p.key} className="flex items-center justify-between gap-4 py-[7px]">
                  <div>
                    <div className="text-small font-semibold">{statusLabel(p.action)}</div>
                    {p.description ? (
                      <div className="text-label text-faint">{p.description}</div>
                    ) : null}
                  </div>
                  <div
                    className={`text-title font-extrabold ${has ? "text-success" : "text-danger"}`}
                    aria-label={has ? "Allowed" : "Not allowed"}
                  >
                    {has ? "✓" : "✕"}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <p className="m-0 mt-3 max-w-[440px] text-label text-faint">
        Roles are standard across HotelOS. Change what someone can do by changing their role in the
        directory.
      </p>
    </div>
  );
}
