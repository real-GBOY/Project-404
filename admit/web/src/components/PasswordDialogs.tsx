import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { adminApi } from "@/api";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { TextField } from "./Field";
import { errorText } from "@/lib/errors";

const MIN = 10;

/** A signed-in person changes their own password. Every session ends afterwards, so the caller signs them out. */
export function ChangePasswordDialog({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const change = useMutation({
    mutationFn: () => adminApi.account.changePassword(current, next),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setAgain("");
      onChanged();
    },
  });
  const ok = current.length > 0 && next.length >= MIN && next === again;
  return (
    <Dialog open={open} onClose={onClose} title="Change your password">
      <form
        className="flex flex-col gap-3 px-[22px] pb-[22px] pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) change.mutate();
        }}
      >
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          hint={`At least ${MIN} characters.`}
        />
        <TextField
          label="New password again"
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          error={again && next !== again ? "The two passwords do not match." : undefined}
        />
        {change.isError ? (
          <p role="alert" className="text-sm text-bad-solid">
            {errorText(change.error)}
          </p>
        ) : null}
        <p className="text-xs text-ink-2">
          You will be signed out on every device and sign in again with the new password.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="ink" size="md" disabled={!ok} loading={change.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** The owner hands a colleague a new password (to be told to them in person). */
export function ResetPasswordDialog({
  person,
  onClose,
  onDone,
}: {
  person: { userId: string; name: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pw, setPw] = useState("");
  const reset = useMutation({
    mutationFn: () => adminApi.team.setPassword(person!.userId, pw),
    onSuccess: () => {
      setPw("");
      onDone();
    },
  });
  return (
    <Dialog
      open={person !== null}
      onClose={onClose}
      title={`New password for ${person?.name ?? ""}`}
    >
      <form
        className="flex flex-col gap-3 px-[22px] pb-[22px] pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (pw.length >= MIN) reset.mutate();
        }}
      >
        <TextField
          label="New password"
          type="text"
          autoComplete="off"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          hint={`At least ${MIN} characters. Tell them in person; they can change it after signing in.`}
        />
        {reset.isError ? (
          <p role="alert" className="text-sm text-bad-solid">
            {errorText(reset.error)}
          </p>
        ) : null}
        <p className="text-xs text-ink-2">
          They are signed out everywhere and use this password next time.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="ink"
            size="md"
            disabled={pw.length < MIN}
            loading={reset.isPending}
          >
            Set password
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
