import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ApiError } from "@/config";
import { useLeads } from "@/api/crm";
import { useTeamDirectory } from "@/api/team";
import { useCreateConversation } from "@/api/messaging";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  meId: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

/**
 * Start a conversation: pick teammates (one → a direct chat, several → a group),
 * and optionally link it to a lead — which is what makes Atlas analyse it for
 * requirements, action items and open questions.
 */
export function NewConversationModal({ open, meId, onOpenChange, onCreated }: Props) {
  const team = useTeamDirectory();
  const leads = useLeads();
  const create = useCreateConversation();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [leadId, setLeadId] = useState("");

  const candidates = useMemo(
    () => team.members.filter((m) => m.id !== meId && (q.trim() === "" || `${m.name} ${m.email}`.toLowerCase().includes(q.trim().toLowerCase()))),
    [team.members, meId, q],
  );
  const isGroup = picked.length > 1;
  const canCreate = picked.length > 0 && (!isGroup || title.trim().length > 0);

  function reset() {
    setQ("");
    setPicked([]);
    setTitle("");
    setLeadId("");
    create.reset();
  }

  function submit() {
    create.mutate(
      {
        type: isGroup ? "group" : "direct",
        memberIds: picked,
        ...(isGroup ? { title: title.trim() } : {}),
        ...(leadId ? { subjectType: "lead", subjectId: leadId } : {}),
      },
      {
        onSuccess: (c) => {
          reset();
          onOpenChange(false);
          onCreated(c.id);
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title="New conversation"
      description="Pick one teammate for a direct chat, or several for a group."
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} loading={create.isPending} disabled={!canCreate}>Start conversation</Button>
        </>
      }
    >
      <div className="mt-3 flex flex-col gap-3 text-[11.5px]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teammates" aria-label="Search teammates" />
        <ul className="max-h-48 overflow-y-auto rounded-btn border border-border" aria-label="Teammates">
          {candidates.map((m) => {
            const on = picked.includes(m.id);
            return (
              <li key={m.id}>
                <label className={cn("flex cursor-pointer items-center gap-2 border-b border-border-row px-2.5 py-1.5 last:border-b-0 hover:bg-primary-surface-pale", on && "bg-primary-surface-pale")}>
                  <input type="checkbox" checked={on} onChange={() => setPicked((cur) => (on ? cur.filter((x) => x !== m.id) : [...cur, m.id]))} />
                  <Avatar name={m.name} size={22} />
                  <span className="min-w-0 flex-1 truncate text-foreground">{m.name}</span>
                  <span className="truncate text-[10px] text-subtle">{m.role}</span>
                </label>
              </li>
            );
          })}
          {candidates.length === 0 && <li className="px-2.5 py-3 text-center text-subtle">{team.isLoading ? "Loading team…" : "No teammates found."}</li>}
        </ul>

        {isGroup && (
          <div className="flex flex-col gap-1">
            <label htmlFor="new-conversation-title">Group name</label>
            <Input id="new-conversation-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New Cairo — Q4 launch" />
          </div>
        )}

        <label className="flex flex-col gap-1">
          About a lead <span className="text-[10px] text-subtle">(optional — enables AI insights)</span>
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className="h-8 rounded-btn border border-border bg-surface px-2 outline-none focus-visible:border-primary">
            <option value="">No lead</option>
            {(leads.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>

        {create.error && (
          <p role="alert" className="text-danger">{create.error instanceof ApiError ? create.error.message : "Couldn't start the conversation."}</p>
        )}
      </div>
    </Modal>
  );
}
