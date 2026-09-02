import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useSetPageChrome } from "@/lib/page-chrome";
import { useUrlParams } from "@/hooks/use-url-params";
import { httpClient } from "@/lib/api/http-client";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/ui/page-container";
import { Icon } from "@/components/ui/icon";
import { ForbiddenState } from "@/components/feedback/forbidden-state";
import { MattersListPage } from "@/features/matters";
import { HearingsListPage } from "@/features/hearings";
import { TasksListPage } from "@/features/tasks";

/**
 * Case Work — the prototype groups Matters / Hearings / Tasks under one screen
 * behind a sand tab group. This composition root lives in `app/` so no feature
 * imports another.
 */
const TABS = ["matters", "hearings", "tasks"] as const;
type Tab = (typeof TABS)[number];

const PERM: Record<Tab, string> = {
  matters: "read:matter",
  hearings: "read:hearing",
  tasks: "read:task",
};
const ICON: Record<Tab, string> = { matters: "gavel", hearings: "balance", tasks: "task_alt" };

export function CaseWorkPage() {
  const { t } = useTranslation("matters");
  const { can } = usePermissions();
  const params = useUrlParams<"tab">({ tab: "matters" });
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "")
    ? (params.get("tab") as Tab)
    : "matters";

  useSetPageChrome({ title: t("case_work.title") });

  const counts = useQuery({
    queryKey: ["casework", "summary"],
    queryFn: ({ signal }) =>
      httpClient<{ matters: number; hearings: number; tasks: number }>("/casework/summary", {
        signal,
      }),
  });

  const visible = TABS.filter((name) => can(PERM[name]));

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex gap-[3px] rounded-group bg-surface-sand-hover p-1">
          {visible.map((name) => {
            const active = name === tab;
            return (
              <button
                key={name}
                type="button"
                onClick={() => params.set({ tab: name === "matters" ? undefined : name })}
                className={cn(
                  "flex items-center gap-[7px] rounded-lg px-[15px] py-2 text-[13px] transition-colors",
                  active
                    ? "bg-surface font-extrabold text-primary shadow-tab-warm"
                    : "font-semibold text-warm-ink hover:bg-surface-warm-2",
                )}
              >
                <Icon name={ICON[name]} size={18} />
                {t(`case_work.${name}`)}
                <span
                  className={cn(
                    "text-[11.5px] font-bold",
                    active ? "text-muted" : "text-warm-muted",
                  )}
                >
                  {counts.data?.[name] ?? ""}
                </span>
              </button>
            );
          })}
        </div>
        <span className="ms-1.5 text-[12.5px] font-medium text-muted-2">
          {t(`case_work.${tab}_hint`)}
        </span>
      </div>

      {!can(PERM[tab]) ? (
        <ForbiddenState />
      ) : tab === "matters" ? (
        <MattersListPage embedded />
      ) : tab === "hearings" ? (
        <HearingsListPage embedded />
      ) : (
        <TasksListPage embedded />
      )}
    </PageContainer>
  );
}
