import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPaymentDoesNotOverpay,
  calculateBalanceAmount,
  calculatePaidAmount,
  calculatePaymentStatus,
  calculatePaymentSummary
} from "@/lib/payments/calculations";

test("calculatePaymentSummary handles unpaid orders", () => {
  const summary = calculatePaymentSummary({
    totalAmount: 5000,
    payments: []
  });

  assert.equal(summary.paidAmount, 0);
  assert.equal(summary.balanceAmount, 5000);
  assert.equal(summary.paymentStatus, "UNPAID");
  assert.equal(summary.lastPaymentAt, null);
});

test("calculatePaymentSummary handles downpayments and balance due on delivery", () => {
  const summary = calculatePaymentSummary({
    totalAmount: 5000,
    paymentDueTiming: "UPON_DELIVERY",
    payments: [
      {
        amount: 1500,
        paymentType: "DOWNPAYMENT",
        paymentDate: "2026-05-01T00:00:00.000Z"
      }
    ]
  });

  assert.equal(summary.paidAmount, 1500);
  assert.equal(summary.balanceAmount, 3500);
  assert.equal(summary.paymentStatus, "BALANCE_DUE_ON_DELIVERY");
});

test("calculatePaymentSummary handles partial, multiple, and fully paid orders", () => {
  const partial = calculatePaymentSummary({
    totalAmount: 5000,
    payments: [
      { amount: 1000, paymentType: "PARTIAL_PAYMENT", paymentDate: "2026-05-01" },
      { amount: 1250, paymentType: "PARTIAL_PAYMENT", paymentDate: "2026-05-03" }
    ]
  });

  assert.equal(partial.paidAmount, 2250);
  assert.equal(partial.balanceAmount, 2750);
  assert.equal(partial.paymentStatus, "PARTIALLY_PAID");
  assert.equal(partial.lastPaymentAt?.toISOString(), new Date("2026-05-03").toISOString());

  const paid = calculatePaymentSummary({
    totalAmount: 5000,
    payments: [
      { amount: 2250, paymentType: "PARTIAL_PAYMENT" },
      { amount: 2750, paymentType: "FINAL_PAYMENT" }
    ]
  });

  assert.equal(paid.paidAmount, 5000);
  assert.equal(paid.balanceAmount, 0);
  assert.equal(paid.paymentStatus, "PAID");
});

test("calculatePaidAmount ignores voided and refunded payments", () => {
  const paidAmount = calculatePaidAmount([
    { amount: 1000, status: "RECORDED" },
    { amount: 500, status: "VOIDED" },
    { amount: 250, status: "REFUNDED" }
  ]);

  assert.equal(paidAmount, 1000);
});

test("calculateBalanceAmount never returns a negative balance", () => {
  assert.equal(calculateBalanceAmount(1000, 1200), 0);
});

test("calculatePaymentStatus covers status transitions", () => {
  assert.equal(calculatePaymentStatus({ totalAmount: 1000, paidAmount: 0 }), "UNPAID");
  assert.equal(calculatePaymentStatus({ totalAmount: 1000, paidAmount: 500 }), "PARTIALLY_PAID");
  assert.equal(
    calculatePaymentStatus({ totalAmount: 1000, paidAmount: 500, hasDownpayment: true }),
    "DOWNPAYMENT_PAID"
  );
  assert.equal(calculatePaymentStatus({ totalAmount: 1000, paidAmount: 1000 }), "PAID");
});

test("assertPaymentDoesNotOverpay blocks payments above the remaining balance", () => {
  assert.deepEqual(
    assertPaymentDoesNotOverpay({
      totalAmount: 5000,
      existingPayments: [{ amount: 3000 }],
      nextPaymentAmount: 2000
    }),
    {
      currentPaidAmount: 3000,
      remainingBalance: 2000
    }
  );

  assert.throws(
    () =>
      assertPaymentDoesNotOverpay({
        totalAmount: 5000,
        existingPayments: [{ amount: 3000 }],
        nextPaymentAmount: 2000.01
      }),
    /Payment amount exceeds/
  );
});
