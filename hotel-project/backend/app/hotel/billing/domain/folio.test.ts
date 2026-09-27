import { describe, expect, it } from "vitest";
import { folioTotals, paymentStatusFor, splitRoomCharges, taxFor } from "./folio.js";

describe("folio ledger", () => {
  it("computes VAT per line in whole piastres", () => {
    expect(taxFor(5400, 0.14)).toBe(756);
    expect(taxFor(0.07, 0.14)).toBe(0.01);
  });

  it("splits a discounted stay into nights that sum exactly to the booked total", () => {
    const nights = [
      { date: "2026-10-05", rate: 5400 },
      { date: "2026-10-06", rate: 5400 },
      { date: "2026-10-07", rate: 6210 },
    ];
    // 17010 room total, 10% off = 15309 total.
    const split = splitRoomCharges(nights, 17010, 15309);
    expect(split.map((s) => s.amount)).toEqual([4860, 4860, 5589]);
    expect(split.reduce((s, x) => s + x.amount, 0)).toBe(15309);
  });

  it("absorbs rounding in the last night", () => {
    const split = splitRoomCharges(
      [
        { date: "a", rate: 1000 },
        { date: "b", rate: 1000 },
        { date: "c", rate: 1000 },
      ],
      3000,
      2000,
    );
    expect(split.map((s) => s.amount)).toEqual([666.67, 666.67, 666.66]);
  });

  it("shows the expected cost before check-in and the posted ledger after", () => {
    const expected = { roomTotal: 10000, taxRate: 0.14 };
    const before = folioTotals({ charges: [], completedPayments: [3000], refunds: [], expected });
    expect(before).toMatchObject({
      total: 11400,
      paid: 3000,
      balance: 8400,
      paymentStatus: "partial",
      posted: false,
    });

    const after = folioTotals({
      charges: [
        { amount: 5000, taxAmount: 700, voided: false },
        { amount: 5000, taxAmount: 700, voided: false },
        { amount: 400, taxAmount: 56, voided: true },
      ],
      completedPayments: [3000, 8400],
      refunds: [],
      expected,
    });
    expect(after).toMatchObject({ total: 11400, balance: 0, paymentStatus: "paid", posted: true });
  });

  it("derives payment status — there is no stored paid flag", () => {
    expect(paymentStatusFor(100, 0, 0)).toBe("pending");
    expect(paymentStatusFor(100, 40, 0)).toBe("partial");
    expect(paymentStatusFor(100, 100, 0)).toBe("paid");
    expect(paymentStatusFor(100, 0, 100)).toBe("refunded");
  });
});
