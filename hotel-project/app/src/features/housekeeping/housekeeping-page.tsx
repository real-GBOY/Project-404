import { useState } from "react";
import {
  useHousekeepingTasks,
  useTaskAction,
  type HousekeepingTask,
  type TaskCommand,
} from "@/api/operations";
import { useStaff } from "@/api/staff";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { FormError, SelectField, TextAreaField } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/cn";

const KIND_LABEL: Record<HousekeepingTask["kind"], string> = {
  checkout_clean: "Check-out clean",
  stayover: "Stayover",
  deep_clean: "Deep clean",
};

const COLUMNS = [
  { key: "needs", title: "Needs Cleaning", tone: "text-danger", statuses: ["pending", "assigned"] },
  { key: "cleaning", title: "Cleaning", tone: "text-warning", statuses: ["in_progress"] },
  { key: "ready", title: "Ready", tone: "text-success", statuses: ["completed", "inspected"] },
] as const;

/**
 * Housekeeping board (design: "Housekeeping"): the design's three columns — Needs Cleaning,
 * Cleaning, Ready — built from housekeeping TASKS, not by editing rooms. Starting and completing
 * a task is what changes the room's housekeeping status (server-side). Supervisors
 * (`manage:housekeeping`) also assign and inspect. Cards stack to one column on a phone.
 */
export function HousekeepingPage() {
  const auth = useAuth();
  const supervisor = auth.can("manage:housekeeping");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const tasks = useHousekeepingTasks({ mine: scope === "mine" });
  const [assigning, setAssigning] = useState<HousekeepingTask | null>(null);
  const [completing, setCompleting] = useState<HousekeepingTask | null>(null);

  return (
    <>
      <PageHeader
        title="Housekeeping"
        subtitle={`Today · ${formatLongDate(new Date())}`}
        actions={
          <FilterTabs
            label="Whose tasks"
            size="sm"
            value={scope}
            onChange={setScope}
            tabs={[
              { value: "all", label: "All rooms" },
              { value: "mine", label: "My tasks" },
            ]}
          />
        }
      />
      {tasks.isLoading ? (
        <LoadingState />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = tasks.data!.filter((t) =>
              (col.statuses as readonly string[]).includes(t.status),
            );
            return (
              <section key={col.key} aria-label={col.title}>
                <h2
                  className={cn(
                    "m-0 mb-2.5 text-small font-bold tracking-[0.03em] uppercase",
                    col.tone,
                  )}
                >
                  {col.title} · {items.length}
                </h2>
                {items.length === 0 ? (
                  <p className="m-0 rounded-inner border border-dashed border-border px-4 py-6 text-center text-small text-muted">
                    Nothing here.
                  </p>
                ) : (
                  items.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      supervisor={supervisor}
                      canWork={
                        auth.can("update:housekeeping") &&
                        (supervisor || !t.assigneeId || t.assigneeId === auth.user?.id)
                      }
                      onAssign={() => setAssigning(t)}
                      onComplete={() => setCompleting(t)}
                    />
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}
      {assigning ? <AssignDialog task={assigning} onClose={() => setAssigning(null)} /> : null}
      {completing ? <CompleteDialog task={completing} onClose={() => setCompleting(null)} /> : null}
    </>
  );
}

function TaskCard({
  task,
  supervisor,
  canWork,
  onAssign,
  onComplete,
}: {
  task: HousekeepingTask;
  supervisor: boolean;
  canWork: boolean;
  onAssign: () => void;
  onComplete: () => void;
}) {
  const action = useTaskAction();
  const toast = useToast();
  const has = (c: TaskCommand) => task.commands.includes(c);
  const run = (command: TaskCommand, done: string) =>
    action.mutate(
      { id: task.id, command },
      {
        onSuccess: () => toast(done),
        onError: (e) => toast(errorMessage(e)),
      },
    );

  return (
    <article
      aria-label={`Room ${task.roomNumber}`}
      className="mb-2.5 rounded-[11px] border border-border bg-surface p-3.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-title font-extrabold">Room {task.roomNumber}</div>
          <div className="text-label text-muted">
            {task.roomTypeName} · Floor {task.floor}
          </div>
        </div>
        {task.priority === "high" ? (
          <StatusBadge status="high" label="Priority" />
        ) : task.status === "inspected" ? (
          <StatusBadge status="inspected" />
        ) : null}
      </div>
      <div className="mt-1.5 text-label text-faint">
        {KIND_LABEL[task.kind]}
        {task.assigneeName ? ` · ${task.assigneeName}` : " · Unassigned"}
      </div>
      {task.notes ? <p className="m-0 mt-1.5 text-label text-ink-soft">{task.notes}</p> : null}
      <div className="mt-2.5 flex flex-wrap gap-2 empty:hidden">
        {canWork && has("start") ? (
          <Button
            size="sm"
            className="flex-1 !py-2 text-label"
            disabled={action.isPending}
            onClick={() => run("start", `Room ${task.roomNumber} — cleaning started`)}
          >
            Start Cleaning
          </Button>
        ) : null}
        {canWork && has("complete") ? (
          <Button size="sm" className="flex-1 !py-2 text-label" onClick={onComplete}>
            Complete
          </Button>
        ) : null}
        {supervisor && has("inspect") ? (
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 !py-2 text-label"
            disabled={action.isPending}
            onClick={() => run("inspect", `Room ${task.roomNumber} inspected`)}
          >
            Inspect
          </Button>
        ) : null}
        {supervisor && has("assign") ? (
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 !py-2 text-label"
            onClick={onAssign}
          >
            {task.assigneeId ? "Reassign" : "Assign"}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function AssignDialog({ task, onClose }: { task: HousekeepingTask; onClose: () => void }) {
  const staff = useStaff();
  const action = useTaskAction();
  const toast = useToast();
  const people = (staff.data ?? []).filter(
    (s) => s.status === "active" && s.roleKey === "housekeeping",
  );
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "");
  return (
    <Dialog
      open
      title={`Assign Room ${task.roomNumber}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!assigneeId || action.isPending}
            onClick={() =>
              action.mutate(
                { id: task.id, command: "assign", assigneeId },
                {
                  onSuccess: () => {
                    toast(`Room ${task.roomNumber} assigned`);
                    onClose();
                  },
                },
              )
            }
          >
            Assign
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <SelectField
          label="Housekeeper"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
        >
          <option value="">Choose…</option>
          {people.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <FormError message={action.error ? errorMessage(action.error) : null} />
      </div>
    </Dialog>
  );
}

function CompleteDialog({ task, onClose }: { task: HousekeepingTask; onClose: () => void }) {
  const action = useTaskAction();
  const toast = useToast();
  const [notes, setNotes] = useState("");
  return (
    <Dialog
      open
      title={`Room ${task.roomNumber} is clean`}
      description="The room becomes ready to sell. Note anything the next shift should know."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={action.isPending}
            onClick={() =>
              action.mutate(
                { id: task.id, command: "complete", notes: notes.trim() || null },
                {
                  onSuccess: () => {
                    toast(`Room ${task.roomNumber} ready`);
                    onClose();
                  },
                },
              )
            }
          >
            Mark Complete
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextAreaField
          label="Notes (optional)"
          value={notes}
          maxLength={500}
          onChange={(e) => setNotes(e.target.value)}
        />
        <FormError message={action.error ? errorMessage(action.error) : null} />
      </div>
    </Dialog>
  );
}
