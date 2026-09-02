import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth/use-auth";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { respondTo, type CannedTurn } from "../lib/canned";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  turn?: CannedTurn;
}

let seq = 0;
const mid = () => `m${++seq}`;

export function AskMizan() {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [demoNotice, setDemoNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function send(prompt: string) {
    const text = prompt.trim();
    if (!text) return;
    const turn = respondTo(text);
    setMessages((prev) => [
      ...prev,
      { id: mid(), role: "user", text },
      { id: mid(), role: "assistant", text: turn.answer, turn },
    ]);
    setInput("");
    setDemoNotice(null);
    queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={t("assistant.open")}
        className="flex h-9 items-center gap-1.5 rounded-md border border-border-accent bg-surface-sand px-2.5 text-[12.5px] font-semibold text-link hover:bg-surface-sand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Icon name="auto_awesome" size={16} filled />
        <span className="hidden sm:inline">{t("assistant.name")}</span>
      </SheetTrigger>
      <SheetContent side="end" className="w-[min(32rem,100vw-2rem)]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>{t("assistant.name")}</SheetTitle>
            <Badge tone="warning" size="sm">
              {t("assistant.demo_badge")}
            </Badge>
          </div>
          <SheetDescription>{t("assistant.demo_note")}</SheetDescription>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[12.5px] font-semibold text-muted">{t("assistant.try")}</p>
              <ul className="flex flex-col gap-2">
                {[
                  "assistant.prompts.upcoming_hearings",
                  "assistant.prompts.overdue_tasks",
                  "assistant.prompts.outstanding_invoices",
                ].map((key) => (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => send(t(key))}
                      className="flex w-full items-start gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2.5 text-start text-[12.5px] text-foreground-body hover:border-border-accent"
                    >
                      <Icon name="chat_bubble" size={15} className="mt-0.5 flex-none text-muted" />
                      {t(key)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
              {m.role === "assistant" ? (
                <span className="flex size-7 flex-none items-center justify-center rounded-full bg-surface-sand text-link">
                  <Icon name="auto_awesome" size={14} filled />
                </span>
              ) : (
                <Avatar name={user?.displayName ?? "You"} size="sm" />
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-[12.5px]",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-subtle text-foreground-body",
                )}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.turn?.action && (
                  <button
                    type="button"
                    onClick={() => setDemoNotice(m.turn!.action!.label)}
                    className="mt-2 inline-flex items-center gap-1 rounded-md border border-border-control bg-surface px-2 py-1 text-[11.5px] font-semibold text-link"
                  >
                    <Icon name="bolt" size={13} />
                    {m.turn.action.label}
                  </button>
                )}
                {m.turn?.followUps && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.turn.followUps.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => send(f)}
                        className="rounded-pill bg-surface px-2 py-0.5 text-[11px] font-medium text-link ring-1 ring-border-control"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {demoNotice && (
            <div className="rounded-lg border border-warning/30 bg-warning-surface px-3 py-2 text-[12px] text-warning">
              <span className="font-bold">{t("assistant.demo_action_title")}</span> —{" "}
              {t("assistant.demo_action_body", { action: demoNotice })}
            </div>
          )}
          <div ref={bottomRef} />
        </SheetBody>

        <SheetFooter>
          <form
            className="flex w-full items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("assistant.input_placeholder")}
              aria-label={t("assistant.input_placeholder")}
            />
            <Button type="submit" icon="send" disabled={!input.trim()}>
              <span className="sr-only">{t("assistant.send")}</span>
            </Button>
          </form>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
