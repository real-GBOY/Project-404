import { useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { MizanMark } from "@/components/ui/logo";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { isApiError } from "@/lib/api/api-error";
import { sendChat, type CurrentContext, type ToolActivity } from "../api/assistant.api";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools?: ToolActivity[];
}

let seq = 0;
const mid = () => `m${++seq}`;

const GRADIENT_BORDER = "linear-gradient(115deg,#31456b,#b99a5b 50%,#16233a)";

/** Turn `/matters/mat_123` into `{ screen: "matter", matterId: "mat_123" }`. */
function contextFromPath(pathname: string): CurrentContext {
  const seg = pathname.split("/").filter(Boolean);
  if (seg[0] === "matters" && seg[1]) return { screen: "matter", matterId: seg[1] };
  if (seg[0] === "clients" && seg[1]) return { screen: "client", clientId: seg[1] };
  if (seg[0] === "billing" && seg[1] === "invoices" && seg[2]) {
    return { screen: "invoice" };
  }
  return { screen: seg[0] ?? "dashboard" };
}

export function AskMizan() {
  const { t } = useTranslation("common");
  const { can } = usePermissions();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useRef<string | undefined>(undefined);
  const lastPrompt = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentContext = useMemo(() => contextFromPath(pathname), [pathname]);

  if (!can("use:assistant")) return null;

  const scrollDown = () =>
    queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));

  async function run(prompt: string) {
    const text = prompt.trim();
    if (!text || pending) return;
    lastPrompt.current = text;
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { id: mid(), role: "user", text }]);
    setPending(true);
    scrollDown();

    try {
      const res = await sendChat({
        conversationId: conversationId.current,
        message: text,
        currentContext,
      });
      conversationId.current = res.conversationId;
      setMessages((prev) => [
        ...prev,
        {
          id: mid(),
          role: "assistant",
          text: res.message,
          tools: res.toolActivity.length > 0 ? res.toolActivity : undefined,
        },
      ]);
    } catch (err) {
      setError(
        isApiError(err) && err.message ? err.message : t("assistant.error_generic"),
      );
    } finally {
      setPending(false);
      scrollDown();
    }
  }

  function reset() {
    setMessages([]);
    setError(null);
    conversationId.current = undefined;
    lastPrompt.current = null;
  }

  const prompts = [
    "assistant.prompts.upcoming_hearings",
    "assistant.prompts.overdue_tasks",
    "assistant.prompts.outstanding_invoices",
  ];

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
      }}
    >
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
                    {t("assistant.subtitle")}
                  </Dialog.Description>
                </div>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-md px-2.5 py-1.5 text-[12px] font-bold text-muted hover:bg-divider-row hover:text-foreground"
                  >
                    {t("assistant.new_chat")}
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
                      {t("assistant.empty_title")}
                    </div>
                    <p className="max-w-[420px] text-center text-[13px] font-medium text-muted-2 text-pretty">
                      {t("assistant.empty_hint")}
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
                            {m.tools && m.tools.length > 0 && (
                              <div className="mb-1.5 flex flex-wrap gap-1.5">
                                {m.tools.map((tool, i) => (
                                  <span
                                    key={`${m.id}-${i}`}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-pill border px-2 py-[3px] text-[10.5px] font-bold",
                                      tool.ok
                                        ? "border-border bg-surface-sand text-link"
                                        : "border-warning-surface bg-warning-surface text-warning",
                                    )}
                                  >
                                    <Icon
                                      name={tool.ok ? "check" : "error_outline"}
                                      size={12}
                                    />
                                    {t(`assistant.tools.${tool.name}`, {
                                      defaultValue: tool.name.replace(/_/g, " "),
                                    })}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="whitespace-pre-line text-[13.5px] font-medium leading-[1.62] text-foreground-body">
                              {m.text}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {pending && (
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-[26px] flex-none items-center justify-center rounded-full bg-primary">
                      <MizanMark size={16} className="text-primary-foreground" />
                    </span>
                    <span className="inline-flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="size-1.5 animate-pulse rounded-full bg-muted"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </span>
                    <span className="sr-only">{t("assistant.thinking")}</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2.5 rounded-[14px] border border-warning-surface bg-warning-surface px-3.5 py-3 text-[12.5px] text-warning">
                    <Icon name="error_outline" size={17} className="mt-px flex-none" />
                    <span className="flex-1">{error}</span>
                    {lastPrompt.current && (
                      <button
                        type="button"
                        onClick={() => lastPrompt.current && run(lastPrompt.current)}
                        className="rounded-md border border-border-control bg-surface px-2 py-1 text-[11.5px] font-bold text-link"
                      >
                        {t("assistant.retry")}
                      </button>
                    )}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="px-[18px] pb-4">
                {messages.length === 0 && (
                  <div className="mb-2.5 flex flex-wrap gap-2">
                    {prompts.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => run(t(key))}
                        className="rounded-pill border border-border-control bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-foreground-body hover:border-border-accent hover:bg-surface-sand hover:text-link"
                      >
                        {t(key)}
                      </button>
                    ))}
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(input);
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
                    disabled={!input.trim() || pending}
                    aria-label={t("assistant.send")}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground",
                      (!input.trim() || pending) && "opacity-40",
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
