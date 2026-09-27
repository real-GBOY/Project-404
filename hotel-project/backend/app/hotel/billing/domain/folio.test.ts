import { describe, expect, it } from "vitest";
import {
  allocateRefund,
  expectedRoomTotal,
  folioTotals,
  paymentStatusFor,
  splitRoomCharges,
  taxFor,
  totalsFromSums,
} from "./folio.js";

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

  it("owes nothing on a cancelled booking, so its deposit becomes a credit", () => {
    expect(expectedRoomTotal("cancelled", 9000)).toBe(0);
    expect(expectedRoomTotal("no_show", 9000)).toBe(9000);
    const t = totalsFromSums({
      chargeCount: 0,
      charges: 0,
      tax: 0,
      paid: 2000,
      refunded: 0,
      expected: { roomTotal: expectedRoomTotal("cancelled", 9000), taxRate: 0.14 },
    });
    expect(t).toMatchObject({ total: 0, paid: 2000, balance: -2000 });
  });

  it("counts completed refunds against what was paid", () => {
    const t = totalsFromSums({
      chargeCount: 2,
      charges: 8000,
      tax: 1120,
      paid: 10000,
      refunded: 880,
      expected: { roomTotal: 0, taxRate: 0.14 },
    });
    expect(t).toMatchObject({ total: 9120, paid: 9120, refunded: 880, balance: 0 });
    expect(paymentStatusFor(0, 0, 500)).toBe("refunded");
  });

  it("allocates a refund to the most recent payments first, never beyond what each can return", () => {
    expect(
      allocateRefund(700, [
        { id: "pay_new", refundable: 500 },
        { id: "pay_old", refundable: 1000 },
      ]),
    ).toEqual([
      { paymentId: "pay_new", amount: 500 },
      { paymentId: "pay_old", amount: 200 },
    ]);
    expect(allocateRefund(0.1, [{ id: "p", refundable: 0.05 }])).toBeNull();
  });
});
