import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { publicApi } from "@/api";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { errorText } from "@/lib/errors";
import { validEmail } from "./validation";
import { useOrg } from "./hooks";
import { Page } from "./parts";

/** Guest "find my booking": the answer is always the same, so it cannot be used to learn which references or emails exist. */
export function FindBookingForm() {
  const org = useOrg();
  const [ref, setRef] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ ref?: string; email?: string }>({});
  const send = useMutation({
    mutationFn: () => publicApi.resendLink(org, ref.trim().toUpperCase(), email.trim()),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^ADM-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(ref.trim()))
      next.ref = "Enter the reference from your email, like ADM-7K4Q-2931.";
    if (!validEmail(email)) next.email = "Enter the email you booked with.";
    setErrors(next);
    if (Object.keys(next).length === 0) send.mutate();
  };

  if (send.isSuccess) {
    return (
      <Notice tone="ok">
        <strong>Check your inbox.</strong> If that reference and email belong together, we have just
        sent a fresh link to your booking. It can take a minute to arrive.
      </Notice>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-start gap-2">
      <div className="min-w-[180px] flex-1">
        <TextField
          label="Booking reference"
          mono
          placeholder="ADM-XXXX-XXXX"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          error={errors.ref}
          autoComplete="off"
        />
      </div>
      <div className="min-w-[200px] flex-1">
        <TextField
          label="Email used to book"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />
      </div>
      <div className="pt-[26px]">
        <Button type="submit" variant="secondary" loading={send.isPending}>
          Email me the link
        </Button>
      </div>
      {send.isError ? (
        <p role="alert" className="basis-full text-sm text-bad-solid">
          {errorText(send.error)}
        </p>
      ) : null}
    </form>
  );
}

export function FindBookingPage() {
  return (
    <Page narrow="xs" className="flex flex-col gap-6">
      <h1 className="display text-5xl">Find my booking</h1>
      <p className="text-[15px] leading-relaxed text-ink-2">
        Bookings do not need an account. Your booking page is reached by a private link in your
        email. Lost it? Enter your reference and the email you used, and we will send a new one.
      </p>
      <FindBookingForm />
    </Page>
  );
}
