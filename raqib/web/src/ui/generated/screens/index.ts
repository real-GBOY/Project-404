/* eslint-disable */
// Maps view-model flags (vm.is.*) to screen components.
import { OverviewQuality } from "./OverviewQuality";
import { OverviewInspector } from "./OverviewInspector";
import { OverviewProjectManager } from "./OverviewProjectManager";
import { OverviewGuard } from "./OverviewGuard";
import { OverviewGuardsSupervisor } from "./OverviewGuardsSupervisor";
import { GuardsHeader } from "./GuardsHeader";
import { GuardsTable } from "./GuardsTable";
import { ProjectsList } from "./ProjectsList";
import { ProjectDetail } from "./ProjectDetail";
import { VisitsList } from "./VisitsList";
import { VisitDetail } from "./VisitDetail";
import { InspectionWorkspace } from "./InspectionWorkspace";
import { ReviewQueue } from "./ReviewQueue";
import { ReviewDetail } from "./ReviewDetail";
import { InspectionReport } from "./InspectionReport";
import { ReportsIssued } from "./ReportsIssued";
import { ActionsList } from "./ActionsList";
import { ActionDetail } from "./ActionDetail";
import { ObservationsList } from "./ObservationsList";
import { ConfidentialArea } from "./ConfidentialArea";
import { AccessDenied } from "./AccessDenied";
import { ModuleStub } from "./ModuleStub";
import { FormsList } from "./FormsList";
import { FormBuilder } from "./FormBuilder";
import { GuardProfile } from "./GuardProfile";
import { TrainingList } from "./TrainingList";
import { TrainingDetail } from "./TrainingDetail";
import { UsersList } from "./UsersList";
import { UserDetail } from "./UserDetail";
import { AccountRequestReview } from "./AccountRequestReview";
import { AccountRequestPublic } from "./AccountRequestPublic";
import { PasswordSetup } from "./PasswordSetup";
import { PermissionTemplates } from "./PermissionTemplates";
import { AuditLog } from "./AuditLog";
import { Analytics } from "./Analytics";
import { ReportsCenter } from "./ReportsCenter";
import { GeneratedReport } from "./GeneratedReport";
import { SettingsScreen } from "./SettingsScreen";

export const SCREENS: [string, (props: { vm: any }) => React.JSX.Element][] = [
  ["ovMgmt", OverviewQuality],
  ["ovIns", OverviewInspector],
  ["ovPm", OverviewProjectManager],
  ["ovGuard", OverviewGuard],
  ["ovGs", OverviewGuardsSupervisor],
  ["guards", GuardsHeader],
  ["showGuardTable", GuardsTable],
  ["projects", ProjectsList],
  ["project", ProjectDetail],
  ["visits", VisitsList],
  ["visit", VisitDetail],
  ["inspect", InspectionWorkspace],
  ["reviews", ReviewQueue],
  ["review", ReviewDetail],
  ["report", InspectionReport],
  ["reports", ReportsIssued],
  ["actions", ActionsList],
  ["action", ActionDetail],
  ["observations", ObservationsList],
  ["conf", ConfidentialArea],
  ["denied", AccessDenied],
  ["stub", ModuleStub],
  ["forms", FormsList],
  ["form", FormBuilder],
  ["guard", GuardProfile],
  ["training", TrainingList],
  ["trainingD", TrainingDetail],
  ["users", UsersList],
  ["user", UserDetail],
  ["request", AccountRequestReview],
  ["publicReq", AccountRequestPublic],
  ["setup", PasswordSetup],
  ["perms", PermissionTemplates],
  ["audit", AuditLog],
  ["analytics", Analytics],
  ["reportsC", ReportsCenter],
  ["rpt", GeneratedReport],
  ["settings", SettingsScreen],
];
