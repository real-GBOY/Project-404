import type { ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

/** A plain "are you sure?" for actions that are hard to undo. Say what will happen, and name the consequence on the confirm button. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = "danger",
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "ink";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3 px-[22px] pt-2.5 text-sm leading-normal text-ink-2">
        {children}
        {error ? (
          <p role="alert" className="text-bad-solid">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 p-[22px]">
        <Button variant="secondary" size="md" onClick={onClose}>
          Back
        </Button>
        <Button variant={tone} size="md" loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
