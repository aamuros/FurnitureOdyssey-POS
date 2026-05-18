import type { CreateManualOrderInput, OrderItemInput } from "@/lib/validation/orders";

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function discountAmount(
  subtotal: number,
  discountType?: "FIXED_AMOUNT" | "PERCENTAGE",
  discountValue = 0
) {
  if (!discountType || discountValue <= 0) {
    return 0;
  }

  if (discountType === "PERCENTAGE") {
    return roundMoney(subtotal * (discountValue / 100));
  }

  return roundMoney(discountValue);
}

export function calculateOrderItem(item: OrderItemInput) {
  const lineSubtotal = roundMoney(item.quantity * item.unitPrice);
  const itemDiscountAmount = discountAmount(lineSubtotal, item.discountType, item.discountValue);

  if (itemDiscountAmount > lineSubtotal) {
    throw new Error(`Discount exceeds subtotal for ${item.itemName}.`);
  }

  return {
    lineSubtotal,
    discountAmount: itemDiscountAmount,
    lineTotal: roundMoney(Math.max(lineSubtotal - itemDiscountAmount, 0))
  };
}

export function calculateOrderTotals(
  input: Pick<CreateManualOrderInput, "items" | "orderDiscountType" | "orderDiscountValue">
) {
  const calculatedItems = input.items.map((item) => calculateOrderItem(item));
  const subtotalAmount = roundMoney(
    calculatedItems.reduce((sum, item) => sum + item.lineSubtotal, 0)
  );
  const itemDiscountTotal = roundMoney(
    calculatedItems.reduce((sum, item) => sum + item.discountAmount, 0)
  );
  const postItemDiscountTotal = roundMoney(
    calculatedItems.reduce((sum, item) => sum + item.lineTotal, 0)
  );
  const orderDiscountAmount = discountAmount(
    postItemDiscountTotal,
    input.orderDiscountType,
    input.orderDiscountValue
  );

  if (orderDiscountAmount > postItemDiscountTotal) {
    throw new Error("Order discount exceeds the post-item-discount total.");
  }

  return {
    items: calculatedItems,
    subtotalAmount,
    itemDiscountTotal,
    orderDiscountAmount,
    totalAmount: roundMoney(Math.max(postItemDiscountTotal - orderDiscountAmount, 0))
  };
}

export function paymentStatus({
  totalAmount,
  paidAmount,
  hasDownpayment,
  paymentDueTiming
}: {
  totalAmount: number;
  paidAmount: number;
  hasDownpayment?: boolean;
  paymentDueTiming?: "BEFORE_DELIVERY" | "UPON_DELIVERY" | "AFTER_DELIVERY" | null;
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

export function orderStatusFromProgress({
  currentStatus,
  paymentStatus: orderPaymentStatus,
  deliveryStatus
}: {
  currentStatus: string;
  paymentStatus: string;
  deliveryStatus: string;
}) {
  if (currentStatus === "CANCELLED" || currentStatus === "COMPLETED" || currentStatus === "DRAFT") {
    return currentStatus;
  }

  if (deliveryStatus === "DELIVERED") {
    return "DELIVERED";
  }

  if (deliveryStatus === "PARTIALLY_DELIVERED") {
    return "PARTIALLY_DELIVERED";
  }

  if (deliveryStatus === "SCHEDULED") {
    return "SCHEDULED_FOR_DELIVERY";
  }

  if (orderPaymentStatus === "PAID") {
    return "PAID";
  }

  if (
    orderPaymentStatus === "PARTIALLY_PAID" ||
    orderPaymentStatus === "DOWNPAYMENT_PAID" ||
    orderPaymentStatus === "BALANCE_DUE_ON_DELIVERY"
  ) {
    return "PARTIALLY_PAID";
  }

  return "CONFIRMED";
}
