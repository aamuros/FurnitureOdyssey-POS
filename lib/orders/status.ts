type PaymentDueTiming = "BEFORE_DELIVERY" | "UPON_DELIVERY" | "AFTER_DELIVERY";

type NumericValue = number | string | { toString(): string } | null | undefined;

type DeliveryItemState = {
  quantityPlanned?: NumericValue;
  delivery?: {
    status?: string | null;
  } | null;
};

type OrderItemDeliveryState = {
  quantity: NumericValue;
  deliveryItems?: DeliveryItemState[];
};

type OrderPaymentState = {
  paymentStatus: string;
  balanceAmount: NumericValue;
  paymentDueTiming?: PaymentDueTiming | null;
};

type OrderDeliveryState = {
  status: string;
  deliveryStatus: string;
  items: OrderItemDeliveryState[];
};

const inactiveDeliveryStatuses = new Set(["CANCELLED", "FAILED"]);
const terminalOrderStatuses = new Set(["CANCELLED", "COMPLETED"]);

function numeric(value: NumericValue) {
  return Number(value ?? 0);
}

function isActiveDelivery(status?: string | null) {
  return !status || !inactiveDeliveryStatuses.has(status);
}

export function isOrderFullyPaid(order: Pick<OrderPaymentState, "paymentStatus" | "balanceAmount">) {
  return order.paymentStatus === "PAID" || numeric(order.balanceAmount) <= 0;
}

export function isOrderFullyDelivered(order: Pick<OrderDeliveryState, "deliveryStatus">) {
  return order.deliveryStatus === "DELIVERED";
}

export function hasRemainingDeliveryQuantity(order: Pick<OrderDeliveryState, "items">) {
  return order.items.some((item) => {
    const plannedQuantity = (item.deliveryItems ?? [])
      .filter((deliveryItem) => isActiveDelivery(deliveryItem.delivery?.status))
      .reduce((sum, deliveryItem) => sum + numeric(deliveryItem.quantityPlanned), 0);

    return plannedQuantity < numeric(item.quantity);
  });
}

export function canScheduleDeliveryByPaymentState(order: OrderPaymentState) {
  return Boolean(order);
}

export function canScheduleOrderDelivery(order: OrderPaymentState & OrderDeliveryState) {
  return (
    !terminalOrderStatuses.has(order.status) &&
    !["DELIVERED", "CANCELLED"].includes(order.deliveryStatus) &&
    hasRemainingDeliveryQuantity(order)
  );
}

export function canCompleteOrder(order: Pick<OrderDeliveryState, "status" | "deliveryStatus"> & OrderPaymentState) {
  return (
    !terminalOrderStatuses.has(order.status) &&
    order.status === "DELIVERED" &&
    isOrderFullyPaid(order) &&
    isOrderFullyDelivered(order)
  );
}
