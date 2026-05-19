type DeliveryStatus = "PLANNED" | "SCHEDULED" | "IN_TRANSIT" | "PARTIALLY_DELIVERED" | "DELIVERED" | "FAILED" | "CANCELLED";

export type DeliveryItemForSummary = {
  quantityPlanned?: number;
  quantityDelivered: number;
  delivery?: {
    status: DeliveryStatus;
  } | null;
};

export type OrderItemForDeliverySummary = {
  id: string;
  itemName?: string;
  quantity: number;
  deliveryItems?: DeliveryItemForSummary[];
};

export type DeliveryForSummary = {
  status: DeliveryStatus;
};

export type RequestedDeliveryItem = {
  orderItemId: string;
  quantityPlanned: number;
};

const inactiveDeliveryStatuses: DeliveryStatus[] = ["CANCELLED", "FAILED"];

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isActiveDelivery(status?: DeliveryStatus) {
  return !status || !inactiveDeliveryStatuses.includes(status);
}

export function calculateDeliverySummary({
  orderItems,
  deliveries = []
}: {
  orderItems: OrderItemForDeliverySummary[];
  deliveries?: DeliveryForSummary[];
}) {
  const totalQuantity = roundQuantity(orderItems.reduce((sum, item) => sum + item.quantity, 0));
  const deliveredQuantity = roundQuantity(
    orderItems.reduce(
      (sum, item) =>
        sum +
        (item.deliveryItems ?? [])
          .filter((deliveryItem) => isActiveDelivery(deliveryItem.delivery?.status))
          .reduce((itemSum, deliveryItem) => itemSum + deliveryItem.quantityDelivered, 0),
      0
    )
  );
  const activeDeliveryCount = deliveries.filter((delivery) => isActiveDelivery(delivery.status)).length;
  const progressPercentage =
    totalQuantity > 0 ? roundQuantity(Math.min((deliveredQuantity / totalQuantity) * 100, 100)) : 0;

  const deliveryStatus =
    deliveredQuantity > 0 && deliveredQuantity >= totalQuantity
      ? "DELIVERED"
      : deliveredQuantity > 0
        ? "PARTIALLY_DELIVERED"
        : activeDeliveryCount > 0
          ? "SCHEDULED"
          : "NOT_SCHEDULED";

  return {
    totalQuantity,
    deliveredQuantity,
    progressPercentage,
    deliveryStatus
  };
}

export function assertDeliveryPlanDoesNotExceedOrdered({
  orderItems,
  requestedItems
}: {
  orderItems: OrderItemForDeliverySummary[];
  requestedItems: RequestedDeliveryItem[];
}) {
  const orderItemsById = new Map(orderItems.map((item) => [item.id, item]));

  for (const requestedItem of requestedItems) {
    const orderItem = orderItemsById.get(requestedItem.orderItemId);

    if (!orderItem) {
      throw new Error("Delivery item does not belong to this order.");
    }

    const plannedQuantity = (orderItem.deliveryItems ?? [])
      .filter((deliveryItem) => isActiveDelivery(deliveryItem.delivery?.status))
      .reduce((sum, deliveryItem) => sum + (deliveryItem.quantityPlanned ?? 0), 0);

    if (plannedQuantity + requestedItem.quantityPlanned > orderItem.quantity) {
      throw new Error(`Delivery quantity exceeds remaining quantity for ${orderItem.itemName ?? "item"}.`);
    }
  }
}
