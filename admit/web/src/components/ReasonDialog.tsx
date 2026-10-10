import { useState } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { TextArea } from "./Field";

/** Ask for a short reason before a consequential action. The reason ends up in the audit log. */
export function ReasonDialog({
  open,
  title,
  body,
  confirmLabel,
  minLength = 3,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  minLength?: number;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3 px-[22px] pt-2.5">
        <p className="text-sm leading-normal text-ink-2">{body}</p>
        <TextArea
          label="Reason (kept in the audit log)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error ? (
          <p role="alert" className="text-sm text-bad-solid">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 p-[22px]">
        <Button variant="secondary" size="md" onClick={onClose}>
          Back
        </Button>
        <Button
          variant="ink"
          size="md"
          loading={busy}
          disabled={reason.trim().length < minLength}
          onClick={() => onConfirm(reason.trim())}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
