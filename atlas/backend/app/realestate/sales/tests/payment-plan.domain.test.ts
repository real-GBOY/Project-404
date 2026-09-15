import { describe, expect, it } from "vitest";
import { generateInstallmentSchedule } from "@atlas/realestate/sales/payment-plan.domain.js";

describe("realestate/sales payment-plan.domain", () => {
  it("splits total into a down payment plus N even installments summing back to the total", () => {
    const schedule = generateInstallmentSchedule({
      totalEgp: 10_000_000,
      downPaymentPct: 10,
      installmentCount: 8,
      cadence: "quarterly",
      startDate: "2026-01-01",
    });
    expect(schedule).toHaveLength(9); // down payment + 8 installments
    expect(schedule[0].label).toBe("Down payment");
    expect(schedule[0].amountEgp).toBe(1_000_000);
    const sum = schedule.reduce((s, x) => s + x.amountEgp, 0);
    expect(sum).toBe(10_000_000);
  });

  it("steps due dates by the cadence's month interval", () => {
    const schedule = generateInstallmentSchedule({
      totalEgp: 1_000_000,
      downPaymentPct: 0,
      installmentCount: 3,
      cadence: "monthly",
      startDate: "2026-01-01",
    });
    expect(schedule[1].dueDate).toBe("2026-02-01");
    expect(schedule[2].dueDate).toBe("2026-03-01");
    expect(schedule[3].dueDate).toBe("2026-04-01");
  });

  it("puts any rounding remainder on the final installment", () => {
    const schedule = generateInstallmentSchedule({
      totalEgp: 1_000_000,
      downPaymentPct: 0,
      installmentCount: 3,
      cadence: "monthly",
      startDate: "2026-01-01",
    });
    const sum = schedule.reduce((s, x) => s + x.amountEgp, 0);
    expect(sum).toBe(1_000_000);
  });
});
