type PaymentStatus = "RECORDED" | "VOIDED" | "REFUNDED";
type PaymentType = "DOWNPAYMENT" | "PARTIAL_PAYMENT" | "FINAL_PAYMENT" | "DELIVERY_BALANCE_PAYMENT";
type PaymentDueTiming = "BEFORE_DELIVERY" | "UPON_DELIVERY" | "AFTER_DELIVERY";

export type PaymentForSummary = {
  amount: number;
  status?: PaymentStatus;
  paymentType?: PaymentType;
  paymentDate?: Date | string | null;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePaidAmount(payments: PaymentForSummary[]) {
  return roundMoney(
    payments
      .filter((payment) => (payment.status ?? "RECORDED") === "RECORDED")
      .reduce((sum, payment) => sum + payment.amount, 0)
  );
}

export function calculateBalanceAmount(totalAmount: number, paidAmount: number) {
  return roundMoney(Math.max(totalAmount - paidAmount, 0));
}

export function calculatePaymentStatus({
  totalAmount,
  paidAmount,
  hasDownpayment,
  paymentDueTiming
}: {
  totalAmount: number;
  paidAmount: number;
  hasDownpayment?: boolean;
  paymentDueTiming?: PaymentDueTiming | null;
}) {
  if (paidAmount <= 0) {
    return "UNPAID" as const;
  }

  if (paidAmount >= totalAmount) {
    return "PAID" as const;
  }

  if (paymentDueTiming === "UPON_DELIVERY") {
    return "BALANCE_DUE_ON_DELIVERY" as const;
  }

  if (hasDownpayment) {
    return "DOWNPAYMENT_PAID" as const;
  }

  return "PARTIALLY_PAID" as const;
}

export function calculatePaymentSummary({
  totalAmount,
  payments,
  paymentDueTiming
}: {
  totalAmount: number;
  payments: PaymentForSummary[];
  paymentDueTiming?: PaymentDueTiming | null;
}) {
  const recordedPayments = payments.filter((payment) => (payment.status ?? "RECORDED") === "RECORDED");
  const paidAmount = calculatePaidAmount(recordedPayments);
  const balanceAmount = calculateBalanceAmount(totalAmount, paidAmount);
  const hasDownpayment = recordedPayments.some((payment) => payment.paymentType === "DOWNPAYMENT");
  const lastPaymentAt =
    recordedPayments
      .map((payment) => payment.paymentDate)
      .filter((paymentDate): paymentDate is Date | string => Boolean(paymentDate))
      .map((paymentDate) => new Date(paymentDate))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    paidAmount,
    balanceAmount,
    lastPaymentAt,
    paymentStatus: calculatePaymentStatus({
      totalAmount,
      paidAmount,
      hasDownpayment,
      paymentDueTiming
    })
  };
}

export function assertPaymentDoesNotOverpay({
  totalAmount,
  existingPayments,
  nextPaymentAmount
}: {
  totalAmount: number;
  existingPayments: PaymentForSummary[];
  nextPaymentAmount: number;
}) {
  const currentPaidAmount = calculatePaidAmount(existingPayments);
  const remainingBalance = calculateBalanceAmount(totalAmount, currentPaidAmount);

  if (nextPaymentAmount > remainingBalance) {
    throw new Error("Payment amount exceeds the remaining balance.");
  }

  return {
    currentPaidAmount,
    remainingBalance
  };
}
