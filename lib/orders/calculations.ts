import type { CreateManualOrderInput, OrderItemInput } from "@/lib/validation/orders";
import { calculatePaymentStatus } from "@/lib/payments/calculations";
import { nextOrderStatusFromProgress } from "@/lib/status-transitions";

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
  const unitCostSnapshot = roundMoney(item.unitCostSnapshot ?? item.unitCost ?? 0);
  const lineCostTotal = roundMoney(item.quantity * unitCostSnapshot);

  if (itemDiscountAmount > lineSubtotal) {
    throw new Error(`Discount exceeds subtotal for ${item.itemName}.`);
  }

  const lineTotal = roundMoney(Math.max(lineSubtotal - itemDiscountAmount, 0));

  return {
    lineSubtotal,
    discountAmount: itemDiscountAmount,
    lineTotal,
    unitCostSnapshot,
    lineCostTotal,
    lineProfit: roundMoney(lineTotal - lineCostTotal)
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

  const totalAmount = roundMoney(Math.max(postItemDiscountTotal - orderDiscountAmount, 0));
  const totalCostAmount = roundMoney(
    calculatedItems.reduce((sum, item) => sum + item.lineCostTotal, 0)
  );

  return {
    items: calculatedItems,
    subtotalAmount,
    itemDiscountTotal,
    orderDiscountAmount,
    totalAmount,
    totalCostAmount,
    grossProfitAmount: roundMoney(totalAmount - totalCostAmount)
  };
}

export const paymentStatus = calculatePaymentStatus;

export function orderStatusFromProgress({
  currentStatus,
  paymentStatus: orderPaymentStatus,
  deliveryStatus
}: {
  currentStatus:
    | "DRAFT"
    | "CONFIRMED"
    | "PARTIALLY_PAID"
    | "PAID"
    | "SCHEDULED_FOR_DELIVERY"
    | "PARTIALLY_DELIVERED"
    | "DELIVERED"
    | "COMPLETED"
    | "CANCELLED";
  paymentStatus: string;
  deliveryStatus: "NOT_SCHEDULED" | "SCHEDULED" | "PARTIALLY_DELIVERED" | "DELIVERED" | "CANCELLED";
}) {
  return nextOrderStatusFromProgress({
    currentStatus,
    paymentStatus: orderPaymentStatus,
    deliveryStatus
  });
}
