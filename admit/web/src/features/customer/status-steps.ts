import type { GuestBooking } from "@/api/types";

export type StepState = "done" | "now" | "act" | "fail" | "todo";
export interface Step {
  label: string;
  state: StepState;
  /** A time, or a short phrase like "Waiting for you". */
  when: string;
}

const SHORT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Cairo",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const stamp = (iso: string | undefined) =>
  iso ? SHORT.format(new Date(iso)).replace(",", "") : "";

/**
 * The five-step booking timeline the customer sees, derived ONLY from what the server reports: the booking status, its recorded
 * timeline and the real email status. Nothing is shown as done until the server says so (an approval is not "emailed" until the
 * worker's provider accepted the message).
 */
export function buildSteps(b: GuestBooking): Step[] {
  const at = (step: string) => b.timeline.find((t) => t.step === step)?.at;
  const created = at("Booking created");
  const proof = [...b.timeline].reverse().find((t) => t.step === "Payment proof submitted")?.at;
  const approved = at("Payment approved");
  const issued = at("Tickets issued");
  const rejected = [...b.timeline].reverse().find((t) => t.step === "Payment rejected")?.at;

  const steps: Step[] = [
    { label: "Booking created", state: "done", when: stamp(created) },
    { label: "Proof submitted", state: "todo", when: "" },
    { label: "Payment verified", state: "todo", when: "" },
    { label: "Tickets issued", state: "todo", when: "" },
    { label: "Tickets emailed", state: "todo", when: "" },
  ];

  switch (b.status) {
    case "AWAITING_PAYMENT":
      steps[1] = rejected
        ? { label: "Proof not accepted", state: "fail", when: stamp(rejected) }
        : { label: "Proof submitted", state: "act", when: "Waiting for you" };
      if (rejected) steps[2] = { label: "Send a new proof", state: "act", when: "Waiting for you" };
      break;
    case "IN_REVIEW":
      steps[1] = { label: "Proof submitted", state: "done", when: stamp(proof) };
      steps[2] = { label: "Payment verified", state: "now", when: "In progress" };
      break;
    case "CONFIRMED": {
      steps[1] = { label: "Proof submitted", state: "done", when: stamp(proof) };
      steps[2] = { label: "Payment verified", state: "done", when: stamp(approved) };
      steps[3] = { label: "Tickets issued", state: "done", when: stamp(issued) };
      const es = b.emailStatus;
      steps[4] =
        es === "ACCEPTED" || es === "DELIVERED"
          ? { label: "Tickets emailed", state: "done", when: "" }
          : es === "FAILED"
            ? {
                label: "Email did not arrive — your tickets are available here",
                state: "fail",
                when: "",
              }
            : { label: "Tickets emailed", state: "now", when: "Sending" };
      break;
    }
    case "REJECTED":
      steps[1] = { label: "Proof submitted", state: "done", when: stamp(proof) };
      steps[2] = { label: "Payment not verified", state: "fail", when: stamp(rejected) };
      break;
    case "EXPIRED":
      steps[1] = { label: "No proof received in time", state: "fail", when: "" };
      break;
    case "CANCELLED":
      steps[1] = {
        label: "Booking cancelled",
        state: "fail",
        when: stamp(at("Booking cancelled")),
      };
      break;
  }
  return steps;
}
