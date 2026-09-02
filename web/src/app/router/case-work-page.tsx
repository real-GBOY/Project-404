import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUrlParams } from "@/hooks/use-url-params";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ForbiddenState } from "@/components/feedback/forbidden-state";
import { MattersListPage } from "@/features/matters";
import { HearingsListPage } from "@/features/hearings";
import { TasksListPage } from "@/features/tasks";

/**
 * Case Work — the design groups Matters / Hearings / Tasks under one screen
 * (PLAN §8). This composition root lives in `app/` so no feature imports another.
 */
const TABS = ["matters", "hearings", "tasks"] as const;
const PERM: Record<(typeof TABS)[number], string> = {
  matters: "read:matter",
  hearings: "read:hearing",
  tasks: "read:task",
};

export function CaseWorkPage() {
  const { t } = useTranslation("matters");
  const { can } = usePermissions();
  const params = useUrlParams<"tab">({ tab: "matters" });
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "")
    ? (params.get("tab") as (typeof TABS)[number])
    : "matters";

  const visible = TABS.filter((name) => can(PERM[name]));

  return (
    <PageContainer>
      <PageHeader title={t("case_work.title")} description={t("case_work.subtitle")} />
      <Tabs value={tab} onValueChange={(v) => params.set({ tab: v === "matters" ? undefined : v })}>
        <TabsList>
          {visible.map((name) => (
            <TabsTrigger key={name} value={name}>
              {t(`case_work.${name}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
