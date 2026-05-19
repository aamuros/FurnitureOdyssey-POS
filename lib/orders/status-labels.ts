import type {
  DeliveryStatus,
  DocumentStatus,
  DocumentType,
  OrderDeliveryStatus,
  OrderPaymentStatus,
  OrderStatus,
  PaymentDueTiming,
  PaymentStatus,
  PaymentType
} from "@prisma/client";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "teal";

const labels: Record<string, string> = {
  ACKNOWLEDGEMENT_RECEIPT: "Acknowledgement receipt",
  AFTER_DELIVERY: "After delivery",
  BALANCE_DUE_ON_DELIVERY: "Balance due on delivery",
  BEFORE_DELIVERY: "Before delivery",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  CONFIRMED: "Confirmed",
  DELIVERED: "Delivered",
  DELIVERY_BALANCE_PAYMENT: "Delivery balance",
  DELIVERY_RECEIPT: "Delivery receipt",
  DOWNPAYMENT: "Downpayment",
  DOWNPAYMENT_PAID: "Downpayment paid",
  DRAFT: "Draft",
  FAILED: "Failed",
  FINAL_PAYMENT: "Final payment",
  GENERATED: "Generated",
  INVOICE: "Invoice",
  IN_TRANSIT: "In transit",
  NOT_SCHEDULED: "Not scheduled",
  OFFICIAL_RECEIPT: "Official receipt",
  ORDER_CONFIRMATION: "Order confirmation",
  OTHER: "Other",
  PAID: "Paid",
  PARTIAL_PAYMENT: "Partial payment",
  PARTIALLY_DELIVERED: "Partially delivered",
  PARTIALLY_PAID: "Partially paid",
  PARTIALLY_REFUNDED: "Partially refunded",
  PAYMENT_RECEIPT: "Payment receipt",
  PLANNED: "Planned",
  QUOTATION_PDF: "Quotation PDF",
  RECORDED: "Recorded",
  REFUNDED: "Refunded",
  SCHEDULED: "Scheduled",
  SCHEDULED_FOR_DELIVERY: "Scheduled for delivery",
  SENT: "Sent",
  UNPAID: "Unpaid",
  UPON_DELIVERY: "Upon delivery",
  VOIDED: "Voided"
};

export function readableLabel(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return (
    labels[value] ??
    value
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function statusTone(status: string): StatusTone {
  if (["PAID", "DELIVERED", "COMPLETED", "RECORDED", "GENERATED"].includes(status)) {
    return "success";
  }

  if (["CONFIRMED", "SCHEDULED", "SCHEDULED_FOR_DELIVERY", "IN_TRANSIT"].includes(status)) {
    return "teal";
  }

  if (
    [
      "PARTIALLY_PAID",
      "DOWNPAYMENT_PAID",
      "BALANCE_DUE_ON_DELIVERY",
      "PLANNED",
      "PARTIALLY_DELIVERED"
    ].includes(status)
  ) {
    return "warning";
  }

  if (["CANCELLED", "VOIDED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(status)) {
    return "danger";
  }

  return "neutral";
}

export function orderStatusLabel(value: OrderStatus | string) {
  return readableLabel(value);
}

export function paymentStatusLabel(value: OrderPaymentStatus | PaymentStatus | string) {
  return readableLabel(value);
}

export function deliveryStatusLabel(value: OrderDeliveryStatus | DeliveryStatus | string) {
  return readableLabel(value);
}

export function documentStatusLabel(value: DocumentStatus | string) {
  return readableLabel(value);
}

export function documentTypeLabel(value: DocumentType | string) {
  return readableLabel(value);
}

export function paymentTypeLabel(value: PaymentType | string) {
  return readableLabel(value);
}

export function paymentDueTimingLabel(value: PaymentDueTiming | string | null | undefined) {
  return readableLabel(value);
}
