import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { ApiError } from "@/config";
import { uploadAttachment, type UploadedAttachment } from "@/api/messaging";
import type { MessageDto } from "@auric/contracts/messaging";
import { useMessaging } from "../realtime/messaging-provider";

const MAX_FILES = 10;
const MAX_BYTES = 25 * 1024 * 1024;

interface Uploading {
  key: string;
  name: string;
  state: "uploading" | "error";
  error?: string;
}

interface Props {
  conversationId: string;
  disabled?: boolean;
  replyTo: MessageDto | null;
  replyToName: string | null;
  onClearReply: () => void;
}

/**
 * The message box. Typing feeds the (throttled, ephemeral) typing indicator;
 * files go through Core's presigned upload FIRST — the message only ever carries
 * their ids, never bytes.
 */
export function Composer({ conversationId, disabled, replyTo, replyToName, onClearReply }: Props) {
  const messaging = useMessaging();
  const [text, setText] = useState("");
  const [attached, setAttached] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = uploading.some((u) => u.state === "uploading");
  const canSend = !disabled && !busy && (text.trim().length > 0 || attached.length > 0);

  function submit() {
    if (!canSend) return;
    messaging.send(conversationId, { body: text, attachments: attached, replyToMessageId: replyTo?.id ?? null });
    messaging.typing(conversationId, false);
    setText("");
    setAttached([]);
    onClearReply();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter is a newline. Never send mid-IME-composition (Arabic/CJK input).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files.slice(0, MAX_FILES - attached.length)) {
      const key = `${file.name}-${file.size}-${crypto.randomUUID()}`;
      if (file.size > MAX_BYTES) {
        setUploading((u) => [...u, { key, name: file.name, state: "error", error: "Larger than 25 MB" }]);
        continue;
      }
      setUploading((u) => [...u, { key, name: file.name, state: "uploading" }]);
      try {
        const done = await uploadAttachment(file);
        setAttached((a) => [...a, done]);
        setUploading((u) => u.filter((x) => x.key !== key));
      } catch (err) {
        setUploading((u) =>
          u.map((x) =>
            x.key === key ? { ...x, state: "error", error: err instanceof ApiError ? err.message : "Upload failed" } : x,
          ),
        );
      }
    }
  }

  return (
    <div className="border-t border-border-row bg-surface p-3">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 border-s-2 border-primary bg-surface-subtle px-2 py-1 text-[11px] text-secondary">
          <span className="min-w-0 flex-1 truncate">
            Replying to <strong className="text-foreground">{replyToName ?? "message"}</strong>: {replyTo.body || "attachment"}
          </span>
          <button type="button" onClick={onClearReply} aria-label="Cancel reply" className="text-subtle hover:text-foreground">
            <Icon name="close" size={12} />
          </button>
        </div>
      )}

      {(attached.length > 0 || uploading.length > 0) && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Attachments">
          {attached.map((a) => (
            <li key={a.fileId} className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface-subtle px-1.5 py-0.5 text-[10.5px]">
              <Icon name="attach" size={10} />
              {a.fileName}
              <button
                type="button"
                aria-label={`Remove ${a.fileName}`}
                onClick={() => setAttached((cur) => cur.filter((x) => x.fileId !== a.fileId))}
                className="text-subtle hover:text-danger"
              >
                <Icon name="close" size={10} />
              </button>
            </li>
          ))}
          {uploading.map((u) => (
            <li
              key={u.key}
              className={cn(
                "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10.5px]",
                u.state === "error" ? "border-danger-border bg-danger-surface text-danger" : "border-border bg-surface-subtle text-secondary",
              )}
            >
              {u.state === "uploading" ? "Uploading" : u.error ?? "Failed"} · {u.name}
              {u.state === "error" && (
                <button type="button" aria-label={`Dismiss ${u.name}`} onClick={() => setUploading((cur) => cur.filter((x) => x.key !== u.key))}>
                  <Icon name="close" size={10} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <input ref={fileInput} type="file" multiple hidden onChange={onFiles} data-testid="file-input" />
        <Button variant="ghost" size="md" onClick={() => fileInput.current?.click()} disabled={disabled || attached.length >= MAX_FILES} aria-label="Attach a file">
          <Icon name="attach" size={14} />
        </Button>
        <textarea
          value={text}
          rows={1}
          disabled={disabled}
          placeholder={disabled ? "This conversation is archived" : "Message…"}
          aria-label="Message"
          onChange={(e) => {
            setText(e.target.value);
            messaging.typing(conversationId, e.target.value.length > 0);
          }}
          onBlur={() => messaging.typing(conversationId, false)}
          onKeyDown={onKeyDown}
          className="max-h-32 min-h-8 flex-1 resize-none rounded-btn border border-border bg-surface px-2.5 py-1.5 text-[12px] text-foreground outline-none placeholder:text-placeholder focus-visible:border-primary"
        />
        <Button variant="primary" size="md" onClick={submit} disabled={!canSend} icon="send" aria-label="Send message">
          Send
        </Button>
      </div>
    </div>
  );
}
