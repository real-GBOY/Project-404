import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { MizanMark } from "@/components/ui/logo";
import { respondTo, type CannedTurn } from "../lib/canned";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  turn?: CannedTurn;
}

let seq = 0;
const mid = () => `m${++seq}`;

const GRADIENT_BORDER = "linear-gradient(115deg,#31456b,#b99a5b 50%,#16233a)";

export function AskMizan() {
  const { t } = useTranslation("common");
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

  const prompts = [
    "assistant.prompts.upcoming_hearings",
    "assistant.prompts.overdue_tasks",
    "assistant.prompts.outstanding_invoices",
  ];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={t("assistant.open")}
        className="flex h-9 items-center gap-[7px] rounded-pill border border-border-accent bg-surface-sand px-3.5 text-[13px] font-bold text-link hover:bg-surface-sand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Icon name="auto_awesome" size={18} />
        <span className="hidden sm:inline">{t("assistant.name")}</span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(22,22,29,0.34)] px-6 pb-[34px] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-x-0 bottom-[34px] z-[70] mx-auto w-[calc(100%-3rem)] max-w-[660px] overflow-hidden rounded-[22px] shadow-sheet data-[state=open]:animate-[ai-in_0.18s_ease-out]"
        >
          <div className="p-[3px]" style={{ background: GRADIENT_BORDER }}>
            <div className="flex max-h-[78vh] flex-col rounded-[19px] bg-surface">
              <div className="flex items-center gap-2.5 border-b border-divider px-[18px] py-3.5">
                <Icon name="auto_awesome" size={20} className="text-primary" />
                <div className="flex-1">
                  <Dialog.Title className="text-[14px] font-extrabold text-foreground">
                    {t("assistant.name")}
                  </Dialog.Title>
                  <Dialog.Description className="text-[11px] font-medium text-muted">
                    {t("assistant.demo_note")}
                  </Dialog.Description>
                </div>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessages([])}
                    className="rounded-md px-2.5 py-1.5 text-[12px] font-bold text-muted hover:bg-divider-row hover:text-foreground"
                  >
                    {t("assistant.new_chat", { defaultValue: "New chat" })}
                  </button>
                )}
                <Dialog.Close
                  aria-label={t("common:actions.close")}
                  className="flex size-7 items-center justify-center rounded-md text-subtle hover:bg-divider-row"
                >
                  <Icon name="close" size={20} />
                </Dialog.Close>
              </div>

              <div className="flex-1 overflow-y-auto p-[18px]">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center gap-3.5 px-2.5 pb-6 pt-[30px]">
                    <span className="flex size-[68px] items-center justify-center rounded-group bg-primary shadow-avatar">
                      <MizanMark size={40} className="text-primary-foreground" />
                    </span>
                    <div className="font-display text-[22px] font-normal tracking-[0.01em] text-foreground">
                      {t("assistant.empty_title", { defaultValue: "Ask Mizan anything" })}
                    </div>
                    <p className="max-w-[420px] text-center text-[13px] font-medium text-muted-2 text-pretty">
                      {t("assistant.demo_note")}
                    </p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="mb-3.5">
                      {m.role === "user" ? (
                        <div className="flex justify-end">
                          <div className="max-w-[82%] rounded-[14px] rounded-ee-[5px] bg-primary px-3.5 py-2.5 text-[13.5px] font-semibold leading-[1.5] text-primary-foreground">
                            {m.text}
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2.5">
                          <span className="flex size-[26px] flex-none items-center justify-center rounded-full bg-primary">
                            <MizanMark size={16} className="text-primary-foreground" />
                          </span>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="whitespace-pre-line text-[13.5px] font-medium leading-[1.62] text-foreground-body">
                              {m.text}
                            </p>
                            {m.turn?.action && (
                              <button
                                type="button"
                                onClick={() => setDemoNotice(m.turn!.action!.label)}
                                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border-control bg-surface px-2.5 py-1.5 text-[11.5px] font-bold text-link"
                              >
                                <Icon name="bolt" size={14} />
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
                                    className="rounded-pill border border-border bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-link hover:bg-surface-sand"
                                  >
                                    {f}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
                {demoNotice && (
                  <div className="flex items-start gap-2.5 rounded-[14px] border border-warning-surface bg-warning-surface px-3.5 py-3 text-[12.5px] text-warning">
                    <Icon name="info" size={17} className="mt-px flex-none" />
                    <span>
                      <span className="font-extrabold">{t("assistant.demo_action_title")}</span> —{" "}
                      {t("assistant.demo_action_body", { action: demoNotice })}
                    </span>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="px-[18px] pb-4">
                <div className="mb-2.5 flex flex-wrap gap-2">
                  {prompts.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => send(t(key))}
                      className="rounded-pill border border-border-control bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-foreground-body hover:border-border-accent hover:bg-surface-sand hover:text-link"
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(input);
                  }}
                  className="flex items-center gap-2.5 rounded-[14px] border border-border-control py-[11px] pe-3 ps-[15px] shadow-input"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t("assistant.input_placeholder")}
                    aria-label={t("assistant.input_placeholder")}
                    className="flex-1 bg-transparent text-[13.5px] font-medium text-foreground outline-none placeholder:text-muted"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    aria-label={t("assistant.send")}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground",
                      !input.trim() && "opacity-40",
                    )}
                  >
                    <Icon name="send" size={18} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
