import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  safeFilename
} from "@/lib/pdf/formatters";
import type { OperationalPdfData, OperationalPdfKind, PdfSummaryRow } from "@/lib/pdf/types";

const company = {
  displayName: "Furniture Odyssey",
  address: null,
  contact: null
};

function jsonText(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  return keys
    .map((key) => record[key])
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .join(", ");
}

function customerDetail(value: {
  customerType: string;
  companyName?: string | null;
  contactPersonName?: string | null;
}) {
  return [value.customerType, value.companyName, value.contactPersonName]
    .filter(Boolean)
    .join(" · ");
}

function primaryContact(
  contacts: Array<{ type: string; label: string | null; value: string; isPrimary: boolean }>
) {
  const contact = contacts[0];

  if (!contact) {
    return null;
  }

  return [contact.label ?? contact.type.replaceAll("_", " "), contact.value].join(": ");
}

function firstAddress(
  addresses: Array<{
    addressLine: string;
    city: string | null;
    province: string | null;
    postalCode: string | null;
  }>
) {
  const address = addresses[0];

  if (!address) {
    return null;
  }

  return [address.addressLine, address.city, address.province, address.postalCode]
    .filter(Boolean)
    .join(", ");
}

function generatedFilename(kind: OperationalPdfKind, identifier: string) {
  const date = new Date().toISOString().slice(0, 10);

  return `${safeFilename(kind)}-${safeFilename(identifier)}-${date}.pdf`;
}

export async function getQuotationPdfData(quotationId: string): Promise<OperationalPdfData> {
  const quotation = await prisma.quotation.findUnique({
    where: {
      id: quotationId
    },
    include: {
      customer: {
        include: {
          contacts: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            take: 1
          },
          addresses: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            take: 1
          }
        }
      },
      items: {
        orderBy: {
          sortOrder: "asc"
        }
      }
    }
  });

  if (!quotation) {
    notFound();
  }

  return {
    kind: "quotation",
    title: "Quotation",
    filename: generatedFilename("quotation", quotation.id.slice(0, 8)),
    generatedAt: new Date(),
    company,
    customer: {
      displayName: quotation.customer.displayName,
      detail: customerDetail(quotation.customer),
      contact: primaryContact(quotation.customer.contacts),
      address: firstAddress(quotation.customer.addresses)
    },
    summary: [
      { label: "Quotation ID", value: quotation.id },
      { label: "Status", value: quotation.status },
      { label: "Created", value: formatDate(quotation.createdAt) },
      { label: "Subtotal", value: formatMoney(Number(quotation.subtotalAmount), quotation.currency) },
      {
        label: "Item discounts",
        value: formatMoney(Number(quotation.itemDiscountTotal), quotation.currency)
      },
      {
        label: "Quotation discount",
        value: formatMoney(Number(quotation.quotationDiscountAmount), quotation.currency)
      },
      { label: "Total", value: formatMoney(Number(quotation.totalAmount), quotation.currency) }
    ],
    items: quotation.items.map((item) => ({
      code: item.snapshotProductCode,
      name: item.itemName,
      description: item.description ?? item.specifications,
      quantity: formatQuantity(Number(item.quantity)),
      unitPrice: formatMoney(Number(item.unitPrice), quotation.currency),
      discount: formatMoney(Number(item.discountAmount), quotation.currency),
      total: formatMoney(Number(item.lineTotal), quotation.currency),
      notes: item.customerNotes
    })),
    notes: quotation.customerNotes
  };
}

export async function getInvoicePdfData(orderId: string): Promise<OperationalPdfData> {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId
    },
    include: {
      items: {
        orderBy: {
          sortOrder: "asc"
        }
      }
    }
  });

  if (!order) {
    notFound();
  }

  return {
    kind: "invoice",
    title: "Invoice",
    filename: generatedFilename("invoice", order.orderNumber ?? order.id.slice(0, 8)),
    generatedAt: new Date(),
    company,
    customer: {
      displayName: order.customerDisplayNameSnapshot,
      detail: customerDetail({
        customerType: order.customerTypeSnapshot,
        companyName: order.companyNameSnapshot,
        contactPersonName: order.contactPersonNameSnapshot
      }),
      contact: jsonText(order.primaryContactSnapshot, ["label", "value"]),
      address: jsonText(order.billingAddressSnapshot, [
        "addressLine",
        "city",
        "province",
        "postalCode"
      ])
    },
    summary: orderSummary(order),
    items: order.items.map((item) => ({
      code: item.snapshotProductCode,
      name: item.itemName,
      description: item.description ?? item.specifications,
      quantity: formatQuantity(Number(item.quantity)),
      unitPrice: formatMoney(Number(item.unitPrice), order.currency),
      discount: formatMoney(Number(item.discountAmount), order.currency),
      total: formatMoney(Number(item.lineTotal), order.currency),
      notes: item.customerNotes
    })),
    notes: order.customerNotes
  };
}

export async function getPaymentReceiptPdfData(paymentId: string): Promise<OperationalPdfData> {
  const payment = await prisma.payment.findUnique({
    where: {
      id: paymentId
    },
    include: {
      order: {
        include: {
          payments: {
            where: {
              status: "RECORDED"
            },
            orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }]
          }
        }
      },
      receivedBy: {
        select: {
          displayName: true,
          email: true
        }
      }
    }
  });

  if (!payment) {
    notFound();
  }

  let paidBefore = 0;

  for (const orderPayment of payment.order.payments) {
    if (orderPayment.id === payment.id) {
      break;
    }

    paidBefore += Number(orderPayment.amount);
  }

  const paidAfter = paidBefore + Number(payment.amount);
  const balanceAfter = Math.max(Number(payment.order.totalAmount) - paidAfter, 0);

  return {
    kind: "payment-receipt",
    title: "Payment Receipt",
    filename: generatedFilename(
      "payment-receipt",
      payment.paymentNumber ?? payment.id.slice(0, 8)
    ),
    generatedAt: new Date(),
    company,
    customer: {
      displayName: payment.order.customerDisplayNameSnapshot,
      detail: customerDetail({
        customerType: payment.order.customerTypeSnapshot,
        companyName: payment.order.companyNameSnapshot,
        contactPersonName: payment.order.contactPersonNameSnapshot
      }),
      contact: jsonText(payment.order.primaryContactSnapshot, ["label", "value"]),
      address: jsonText(payment.order.billingAddressSnapshot, [
        "addressLine",
        "city",
        "province",
        "postalCode"
      ])
    },
    summary: [
      { label: "Order", value: payment.order.orderNumber ?? payment.order.id },
      { label: "Payment ID", value: payment.id },
      { label: "Payment type", value: payment.paymentType.replaceAll("_", " ") },
      { label: "Payment date", value: formatDate(payment.paymentDate) },
      { label: "Method", value: payment.method?.replaceAll("_", " ") ?? "Not specified" },
      { label: "Reference", value: payment.referenceNumber ?? "Not specified" },
      { label: "Payer", value: payment.payerName ?? payment.order.customerDisplayNameSnapshot },
      { label: "Received by", value: payment.receivedBy?.displayName ?? "Not specified" },
      { label: "Order total", value: formatMoney(Number(payment.order.totalAmount), payment.order.currency) },
      { label: "Paid before", value: formatMoney(paidBefore, payment.order.currency) },
      { label: "Payment amount", value: formatMoney(Number(payment.amount), payment.order.currency) },
      { label: "Paid after", value: formatMoney(paidAfter, payment.order.currency) },
      { label: "Balance after", value: formatMoney(balanceAfter, payment.order.currency) }
    ],
    notes: payment.customerNotes
  };
}

export async function getDeliveryReceiptPdfData(deliveryId: string): Promise<OperationalPdfData> {
  const delivery = await prisma.delivery.findUnique({
    where: {
      id: deliveryId
    },
    include: {
      order: true,
      items: {
        include: {
          orderItem: true
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (!delivery) {
    notFound();
  }

  return {
    kind: "delivery-receipt",
    title: "Delivery Receipt",
    filename: generatedFilename("delivery-receipt", delivery.id.slice(0, 8)),
    generatedAt: new Date(),
    company,
    customer: {
      displayName: delivery.order.customerDisplayNameSnapshot,
      detail: customerDetail({
        customerType: delivery.order.customerTypeSnapshot,
        companyName: delivery.order.companyNameSnapshot,
        contactPersonName: delivery.order.contactPersonNameSnapshot
      }),
      contact: delivery.recipientPhone ?? jsonText(delivery.order.primaryContactSnapshot, ["label", "value"]),
      address:
        jsonText(delivery.deliveryAddressSnapshot, [
          "addressLine",
          "city",
          "province",
          "postalCode"
        ]) ?? jsonText(delivery.order.deliveryAddressSnapshot, ["addressLine", "city", "province", "postalCode"])
    },
    summary: [
      { label: "Order", value: delivery.order.orderNumber ?? delivery.order.id },
      { label: "Delivery ID", value: delivery.id },
      { label: "Status", value: delivery.status.replaceAll("_", " ") },
      { label: "Scheduled date", value: formatDate(delivery.scheduledDate) },
      { label: "Time window", value: delivery.scheduledTimeWindow ?? "Not specified" },
      { label: "Provider type", value: delivery.deliveryProviderType?.replaceAll("_", " ") ?? "Not specified" },
      { label: "Provider", value: delivery.deliveryProviderName ?? "Not specified" },
      { label: "Provider reference", value: delivery.deliveryProviderReference ?? "Not specified" },
      { label: "Recipient", value: delivery.recipientName ?? delivery.order.customerDisplayNameSnapshot },
      { label: "Recipient phone", value: delivery.recipientPhone ?? "Not specified" }
    ],
    items: delivery.items.map((item) => ({
      code: item.orderItem.snapshotProductCode,
      name: item.orderItem.itemName,
      description: item.orderItem.description ?? item.orderItem.specifications,
      quantity: formatQuantity(Number(item.quantityPlanned)),
      total: `${formatQuantity(Number(item.quantityDelivered))} delivered`,
      notes: item.notes
    })),
    notes: delivery.deliveryNotes
  };
}

export async function getFinalOrderSummaryPdfData(orderId: string): Promise<OperationalPdfData> {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId
    },
    include: {
      items: {
        orderBy: {
          sortOrder: "asc"
        }
      },
      payments: {
        where: {
          status: "RECORDED"
        },
        orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }]
      },
      deliveries: {
        where: {
          status: {
            notIn: ["CANCELLED", "FAILED"]
          }
        },
        orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!order) {
    notFound();
  }

  return {
    kind: "final-order-summary",
    title: "Final Order Summary",
    filename: generatedFilename("final-order-summary", order.orderNumber ?? order.id.slice(0, 8)),
    generatedAt: new Date(),
    company,
    customer: {
      displayName: order.customerDisplayNameSnapshot,
      detail: customerDetail({
        customerType: order.customerTypeSnapshot,
        companyName: order.companyNameSnapshot,
        contactPersonName: order.contactPersonNameSnapshot
      }),
      contact: jsonText(order.primaryContactSnapshot, ["label", "value"]),
      address:
        jsonText(order.billingAddressSnapshot, [
          "addressLine",
          "city",
          "province",
          "postalCode"
        ]) ?? jsonText(order.deliveryAddressSnapshot, ["addressLine", "city", "province", "postalCode"])
    },
    summary: orderSummary(order),
    items: order.items.map((item) => ({
      code: item.snapshotProductCode,
      name: item.itemName,
      description: item.description ?? item.specifications,
      quantity: formatQuantity(Number(item.quantity)),
      unitPrice: formatMoney(Number(item.unitPrice), order.currency),
      discount: formatMoney(Number(item.discountAmount), order.currency),
      total: formatMoney(Number(item.lineTotal), order.currency),
      notes: item.customerNotes
    })),
    payments: order.payments.map((payment) => ({
      label: formatDate(payment.paymentDate),
      value: `${payment.paymentType.replaceAll("_", " ")} · ${formatMoney(Number(payment.amount), order.currency)}`
    })),
    deliveries: order.deliveries.map((delivery) => ({
      label: formatDate(delivery.scheduledDate),
      value: `${delivery.status.replaceAll("_", " ")} · ${delivery.deliveryProviderName ?? delivery.deliveryProviderType ?? "Provider not specified"}`
    })),
    notes: order.customerNotes
  };
}

export async function getOperationalPdfData(kind: OperationalPdfKind, id: string) {
  switch (kind) {
    case "quotation":
      return getQuotationPdfData(id);
    case "invoice":
      return getInvoicePdfData(id);
    case "payment-receipt":
      return getPaymentReceiptPdfData(id);
    case "delivery-receipt":
      return getDeliveryReceiptPdfData(id);
    case "final-order-summary":
      return getFinalOrderSummaryPdfData(id);
  }
}

function orderSummary(order: {
  id: string;
  orderNumber: string | null;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
  confirmedAt: Date | null;
  createdAt: Date;
  currency: string;
  subtotalAmount: unknown;
  itemDiscountTotal: unknown;
  orderDiscountAmount: unknown;
  totalAmount: unknown;
  paidAmount: unknown;
  balanceAmount: unknown;
}): PdfSummaryRow[] {
  return [
    { label: "Order", value: order.orderNumber ?? order.id },
    { label: "Order date", value: formatDate(order.confirmedAt ?? order.createdAt) },
    { label: "Status", value: order.status.replaceAll("_", " ") },
    { label: "Payment status", value: order.paymentStatus.replaceAll("_", " ") },
    { label: "Delivery status", value: order.deliveryStatus.replaceAll("_", " ") },
    { label: "Subtotal", value: formatMoney(Number(order.subtotalAmount), order.currency) },
    { label: "Item discounts", value: formatMoney(Number(order.itemDiscountTotal), order.currency) },
    {
      label: "Order discount",
      value: formatMoney(Number(order.orderDiscountAmount), order.currency)
    },
    { label: "Total", value: formatMoney(Number(order.totalAmount), order.currency) },
    { label: "Paid", value: formatMoney(Number(order.paidAmount), order.currency) },
    { label: "Balance", value: formatMoney(Number(order.balanceAmount), order.currency) }
  ];
}

export function generatedLabel(data: OperationalPdfData) {
  return `Generated ${formatDateTime(data.generatedAt)}`;
}

