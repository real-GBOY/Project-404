const STEPS = ["Tickets", "Your details", "Transfer", "Upload proof"];

/** The four-step progress bar of the booking flow. `step` is the zero-based current step. */
export function CheckoutSteps({ step }: { step: number }) {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pt-6 md:px-6">
      <ol
        aria-label="Booking progress"
        className="m-0 grid list-none grid-cols-4 border-t-2 border-ink p-0"
      >
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={`-mt-[3px] flex flex-col gap-0.5 border-t-4 pr-2 pt-2.5 ${i < step ? "border-ink" : i === step ? "border-brand" : "border-rule"}`}
          >
            <span className="font-mono text-[11px] text-muted">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              className={`text-sm ${i === step ? "font-bold" : "font-medium"} ${i <= step ? "text-ink" : "text-muted"}`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
