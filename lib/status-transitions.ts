import type {
  DeliveryStatus,
  OrderDeliveryStatus,
  OrderStatus,
  PaymentStatus,
  QuotationStatus
} from "@prisma/client";

export type StatusEntityType = "quotation" | "order" | "orderDelivery" | "delivery" | "payment";

export type EntityStatus<T extends StatusEntityType> = T extends "quotation"
  ? QuotationStatus
  : T extends "order"
    ? OrderStatus
    : T extends "orderDelivery"
      ? OrderDeliveryStatus
      : T extends "delivery"
        ? DeliveryStatus
        : PaymentStatus;

type TransitionMap<T extends string> = Record<T, readonly T[]>;

export const quotationStatusTransitions = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["ACCEPTED", "DECLINED", "CANCELLED"],
  ACCEPTED: [],
  DECLINED: [],
  CANCELLED: []
} as const satisfies TransitionMap<QuotationStatus>;

export const orderStatusTransitions = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PARTIALLY_PAID", "PAID", "SCHEDULED_FOR_DELIVERY", "CANCELLED"],
  PARTIALLY_PAID: ["PAID", "SCHEDULED_FOR_DELIVERY", "CANCELLED"],
  PAID: ["SCHEDULED_FOR_DELIVERY", "CANCELLED"],
  SCHEDULED_FOR_DELIVERY: ["PARTIALLY_DELIVERED", "DELIVERED", "CANCELLED"],
  PARTIALLY_DELIVERED: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: []
} as const satisfies TransitionMap<OrderStatus>;

export const orderDeliveryStatusTransitions = {
  NOT_SCHEDULED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["PARTIALLY_DELIVERED", "DELIVERED", "CANCELLED"],
  PARTIALLY_DELIVERED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: []
} as const satisfies TransitionMap<OrderDeliveryStatus>;

export const deliveryStatusTransitions = {
  PLANNED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["PARTIALLY_DELIVERED", "DELIVERED", "FAILED"],
  PARTIALLY_DELIVERED: ["DELIVERED"],
  DELIVERED: [],
  FAILED: ["SCHEDULED"],
  CANCELLED: []
} as const satisfies TransitionMap<DeliveryStatus>;

export const paymentStatusTransitions = {
  RECORDED: ["VOIDED", "REFUNDED"],
  VOIDED: [],
  REFUNDED: []
} as const satisfies TransitionMap<PaymentStatus>;

const transitionMaps = {
  quotation: quotationStatusTransitions,
  order: orderStatusTransitions,
  orderDelivery: orderDeliveryStatusTransitions,
  delivery: deliveryStatusTransitions,
  payment: paymentStatusTransitions
} as const;

function displayEntityType(entityType: StatusEntityType) {
  return entityType === "orderDelivery" ? "order delivery" : entityType;
}

function transitionMapFor<T extends StatusEntityType>(entityType: T) {
  return transitionMaps[entityType] as TransitionMap<EntityStatus<T>>;
}

export function getAllowedNextStatuses<T extends StatusEntityType>(
  entityType: T,
  currentStatus: EntityStatus<T>
): EntityStatus<T>[] {
  return [...(transitionMapFor(entityType)[currentStatus] ?? [])];
}

export function canTransitionStatus<T extends StatusEntityType>(
  entityType: T,
  fromStatus: EntityStatus<T>,
  toStatus: EntityStatus<T>
) {
  return fromStatus === toStatus || getAllowedNextStatuses(entityType, fromStatus).includes(toStatus);
}

export function assertValidStatusTransition<T extends StatusEntityType>(
  entityType: T,
  fromStatus: EntityStatus<T>,
  toStatus: EntityStatus<T>
) {
  if (!canTransitionStatus(entityType, fromStatus, toStatus)) {
    throw new Error(
      `Invalid ${displayEntityType(entityType)} status transition: ${fromStatus} cannot move to ${toStatus}`
    );
  }
}

export function isTerminalStatus<T extends StatusEntityType>(
  entityType: T,
  status: EntityStatus<T>
) {
  return getAllowedNextStatuses(entityType, status).length === 0;
}

export function nextOrderStatusFromProgress({
  currentStatus,
  paymentStatus,
  deliveryStatus
}: {
  currentStatus: OrderStatus;
  paymentStatus: string;
  deliveryStatus: OrderDeliveryStatus;
}): OrderStatus {
  if (currentStatus === "CANCELLED" || currentStatus === "COMPLETED" || currentStatus === "DRAFT") {
    return currentStatus;
  }

  const targetStatus =
    deliveryStatus === "DELIVERED"
      ? "DELIVERED"
      : deliveryStatus === "PARTIALLY_DELIVERED"
        ? "PARTIALLY_DELIVERED"
        : deliveryStatus === "SCHEDULED"
          ? "SCHEDULED_FOR_DELIVERY"
          : paymentStatus === "PAID"
            ? "PAID"
            : ["PARTIALLY_PAID", "DOWNPAYMENT_PAID", "BALANCE_DUE_ON_DELIVERY"].includes(paymentStatus)
              ? "PARTIALLY_PAID"
              : "CONFIRMED";

  assertValidStatusTransition("order", currentStatus, targetStatus);
  return targetStatus;
}
