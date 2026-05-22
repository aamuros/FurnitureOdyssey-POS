import type { DeliveryStatus } from "@prisma/client";
import { assertValidStatusTransition } from "@/lib/status-transitions";

type ExistingDeliveryItem = {
  id: string;
  quantityPlanned: number;
  quantityDelivered: number;
};

export type DeliveryProgressItemInput = {
  deliveryItemId: string;
  quantityDelivered: number;
  notes?: string;
};

export function prepareDeliveryProgressUpdate({
  currentStatus,
  nextStatus,
  existingItems,
  itemInputs,
  markAllDelivered = false
}: {
  currentStatus: DeliveryStatus;
  nextStatus: DeliveryStatus;
  existingItems: ExistingDeliveryItem[];
  itemInputs: DeliveryProgressItemInput[];
  markAllDelivered?: boolean;
}) {
  if (currentStatus === "CANCELLED") {
    throw new Error("Cancelled deliveries cannot be updated.");
  }

  const inputsById = new Map(itemInputs.map((item) => [item.deliveryItemId, item]));
  const nextItems = existingItems.map((item) => {
    const input = inputsById.get(item.id);
    const quantityDelivered =
      nextStatus === "DELIVERED" && markAllDelivered
        ? item.quantityPlanned
        : (input?.quantityDelivered ?? item.quantityDelivered);

    if (quantityDelivered > item.quantityPlanned) {
      throw new Error("Delivered quantity cannot exceed planned quantity.");
    }

    if (quantityDelivered < 0) {
      throw new Error("Delivered quantity cannot be negative.");
    }

    return {
      id: item.id,
      quantityPlanned: item.quantityPlanned,
      quantityDelivered,
      notes: input?.notes
    };
  });

  for (const input of itemInputs) {
    if (!existingItems.some((item) => item.id === input.deliveryItemId)) {
      throw new Error("Delivery item does not belong to this delivery.");
    }
  }

  if (nextStatus === "DELIVERED") {
    const hasDeliveredQuantity = nextItems.some((item) => item.quantityDelivered > 0);
    const allComplete = nextItems.every((item) => item.quantityDelivered === item.quantityPlanned);

    if (!hasDeliveredQuantity) {
      throw new Error("Enter delivered quantities before saving delivered progress.");
    }

    const resolvedStatus = allComplete ? "DELIVERED" : "PARTIALLY_DELIVERED";

    assertValidStatusTransition("delivery", currentStatus, resolvedStatus);

    return {
      status: resolvedStatus,
      items: nextItems
    };
  }

  if (nextStatus === "IN_TRANSIT") {
    assertValidStatusTransition("delivery", currentStatus, nextStatus);

    return {
      status: "IN_TRANSIT",
      items: nextItems
    };
  }

  if (nextStatus === "CANCELLED") {
    assertValidStatusTransition("delivery", currentStatus, nextStatus);

    return {
      status: "CANCELLED",
      items: nextItems
    };
  }

  assertValidStatusTransition("delivery", currentStatus, nextStatus);

  return {
    status: nextStatus,
    items: nextItems
  };
}
