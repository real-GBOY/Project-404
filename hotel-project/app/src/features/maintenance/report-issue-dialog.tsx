import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useReportTicket, type RoomImpact, type TicketPriority } from "@/api/operations";
import { useRooms } from "@/api/rooms";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, InputField, SelectField, TextAreaField } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { addIsoDays, hotelToday } from "@/lib/format";
import { IMPACT_HINT } from "./labels";

/**
 * Report a room issue. Anyone with `create:maintenance` can report; only a supervisor
 * (`manage:maintenance`) may take the room out of sale, and must say when it's expected back.
 * The server refuses a block over a booked stay and names the bookings in the way.
 */
export function ReportIssueDialog({
  onClose,
  roomId: presetRoomId,
}: {
  onClose: () => void;
  roomId?: string;
}) {
  const auth = useAuth();
  const supervisor = auth.can("manage:maintenance");
  const rooms = useRooms();
  const report = useReportTicket();
  const toast = useToast();
  const navigate = useNavigate();
  const today = hotelToday();
  const [form, setForm] = useState({
    roomId: presetRoomId ?? "",
    title: "",
    description: "",
    priority: "medium" as TicketPriority,
    roomImpact: "none" as RoomImpact,
    expectedBack: addIsoDays(today, 1),
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    report.mutate(
      {
        roomId: form.roomId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        roomImpact: form.roomImpact,
        expectedBack: form.roomImpact === "none" ? null : form.expectedBack,
      },
      {
        onSuccess: (t) => {
          toast(`${t.number} reported`);
          onClose();
          navigate(`/maintenance/${t.id}`);
        },
      },
    );
  };

  return (
    <Dialog
      open
      title="Report an issue"
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="report-issue" size="sm" disabled={report.isPending}>
            Report Issue
          </Button>
        </>
      }
    >
      <form id="report-issue" onSubmit={submit} noValidate className="flex flex-col gap-3">
        <SelectField
          label="Room"
          value={form.roomId}
          required
          onChange={(e) => set("roomId", e.target.value)}
        >
          <option value="">Choose a room…</option>
          {(rooms.data ?? [])
            .filter((r) => !r.archivedAt)
            .map((r) => (
              <option key={r.id} value={r.id}>
                Room {r.number} · {r.roomTypeName}
              </option>
            ))}
        </SelectField>
        <InputField
          label="Issue"
          placeholder="e.g. AC not cooling"
          value={form.title}
          maxLength={120}
          onChange={(e) => set("title", e.target.value)}
        />
        <TextAreaField
          label="Details (optional)"
          value={form.description}
          maxLength={2000}
          onChange={(e) => set("description", e.target.value)}
        />
        <SelectField
          label="Priority"
          value={form.priority}
          onChange={(e) => set("priority", e.target.value as TicketPriority)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </SelectField>
        {supervisor ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField
              label="Room impact"
              value={form.roomImpact}
              onChange={(e) => set("roomImpact", e.target.value as RoomImpact)}
            >
              <option value="none">Stays on sale</option>
              <option value="maintenance">Under maintenance</option>
              <option value="out_of_service">Out of service</option>
            </SelectField>
            {form.roomImpact !== "none" ? (
              <InputField
                label="Expected back"
                type="date"
                min={addIsoDays(today, 1)}
                value={form.expectedBack}
                onChange={(e) => set("expectedBack", e.target.value)}
              />
            ) : null}
          </div>
        ) : null}
        <p className="m-0 text-label text-faint">
          {supervisor
            ? IMPACT_HINT[form.roomImpact]
            : "A supervisor decides whether the room comes off sale."}
        </p>
        <FormError message={report.error ? errorMessage(report.error) : null} />
      </form>
    </Dialog>
  );
}
