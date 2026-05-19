import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ensureOrderDocumentNumber,
  generateDeliveryReceiptNumber,
  generatePaymentNumber,
  generateQuotationNumber
} from "@/lib/numbering";
import {
  fallbackText,
  formatDate,
  formatDateTime,
  formatDeliveryStatus,
  formatDocumentNumber,
  formatMoney,
  formatPaymentStatus,
  formatQuantity,
  safeFilename,
  titleCaseLabel
} from "@/lib/pdf/formatters";
import {
  footerForKind,
  getAppSettings
} from "@/lib/settings/get-settings";
import type { AppSettingsInput } from "@/lib/validation/settings";
import type { OperationalPdfData, OperationalPdfKind, PdfSummaryRow } from "@/lib/pdf/types";

function companyForPdf(settings: AppSettingsInput) {
  return {
    displayName: settings.companyProfile.companyName,
    registeredName: settings.companyProfile.registeredName,
    address: settings.companyProfile.address,
    contactNumber: settings.companyProfile.contactNumber,
    email: settings.companyProfile.email,
    facebookPage: settings.companyProfile.facebookPage,
    websiteUrl: settings.companyProfile.websiteUrl,
    logoUrl: settings.companyProfile.logoUrl,
    logoAltText: settings.companyProfile.logoAltText,
    bankDetails: settings.payment.bankDetails,
    eWalletDetails: settings.payment.eWalletDetails,
    otherPaymentNotes: settings.payment.otherPaymentNotes,
    paymentInstructions: settings.payment.defaultPaymentInstructions,
    footer: footerForKind(settings, "final-order-summary")
  };
}

function orderDisplayNumber(_settings: AppSettingsInput, order: { id: string; orderNumber: string | null }) {
  return order.orderNumber ?? "Not assigned";
}

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
    .join(" - ");
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

function primaryImage(
  images: Array<{ secureUrl: string; isPrimary: boolean; sortOrder: number }>
) {
  return [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)[0]
    ?.secureUrl;
}

function discountDetail(
  discountType: string | null,
  discountValue: unknown,
  currency: string,
  label = "Fixed discount"
) {
  if (!discountType || discountValue == null || Number(discountValue) <= 0) {
    return null;
  }

  if (discountType === "PERCENTAGE") {
    return `${Number(discountValue)}% discount`;
  }

  return `${label}: ${formatMoney(Number(discountValue), currency)}`;
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function salesWorkflowRows(value: {
  needsAssembly: boolean;
  salesInvoiceRequested: boolean;
  modeOfDelivery?: string | null;
  deliveryMethod?: string | null;
  paymentTerms?: string | null;
  specialInstructions?: string | null;
}): PdfSummaryRow[] {
  return [
    { label: "Needs assembly", value: yesNo(value.needsAssembly) },
    { label: "Sales invoice requested", value: yesNo(value.salesInvoiceRequested) },
    { label: "Mode of delivery", value: fallbackText(value.modeOfDelivery) },
    { label: "Delivery method", value: fallbackText(value.deliveryMethod) },
    { label: "Payment terms", value: fallbackText(value.paymentTerms) },
    { label: "Special instructions", value: fallbackText(value.specialInstructions) }
  ];
}

export async function getQuotationPdfData(quotationId: string): Promise<OperationalPdfData> {
  await prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUnique({
      where: {
        id: quotationId
      },
      select: {
        id: true,
        quotationNumber: true
      }
    });

    if (quotation && !quotation.quotationNumber) {
      await tx.quotation.update({
        where: {
          id: quotation.id
        },
        data: {
          quotationNumber: await generateQuotationNumber(tx)
        }
      });
    }
  });

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
        },
        include: {
          images: {
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }]
          }
        }
      },
      inquiry: {
        select: {
          id: true,
          source: true,
          sourceReference: true,
          subject: true,
          deliveryLocation: true
        }
      }
    }
  });

  if (!quotation) {
    notFound();
  }

  const settings = await getAppSettings();
  const company = companyForPdf(settings);

  return {
    kind: "quotation",
    title: "Quotation",
    subtitle: "Furniture quotation for review and approval",
    filename: generatedFilename("quotation", quotation.quotationNumber ?? "not-assigned"),
    generatedAt: new Date(),
    company,
    customer: {
      displayName: quotation.customer.displayName,
      detail: customerDetail(quotation.customer),
      contact: primaryContact(quotation.customer.contacts),
      address: firstAddress(quotation.customer.addresses)
    },
    summary: [
      {
        label: "Quotation number",
        value: quotation.quotationNumber ?? "Not assigned"
      },
      { label: "Quotation date", value: formatDate(quotation.createdAt) },
      { label: "Expiration date", value: "Not set" },
      { label: "Status", value: titleCaseLabel(quotation.status) },
      {
        label: "Inquiry reference",
        value: quotation.inquiry
          ? [
              formatDocumentNumber("INQ", quotation.inquiry.id.slice(0, 8)),
              quotation.inquiry.source,
              quotation.inquiry.sourceReference,
              quotation.inquiry.subject
            ]
              .filter(Boolean)
              .join(" - ")
          : "Not linked"
      },
      { label: "Delivery location", value: fallbackText(quotation.inquiry?.deliveryLocation) },
      ...salesWorkflowRows(quotation)
    ],
    totals: [
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
      discountDetail: discountDetail(
        item.discountType,
        item.discountValue,
        quotation.currency
      ),
      total: formatMoney(Number(item.lineTotal), quotation.currency),
      notes: item.customerNotes,
      imageUrl: primaryImage(item.images)
    })),
    notes: quotation.customerNotes,
    paymentInstructions: settings.payment.defaultPaymentInstructions,
    footerNote: footerForKind(settings, "quotation")
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
        },
        include: {
          images: {
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }]
          }
        }
      }
    }
  });

  if (!order) {
    notFound();
  }

  const settings = await getAppSettings();
  const company = companyForPdf(settings);
  const invoiceNumber = await prisma.$transaction((tx) =>
    ensureOrderDocumentNumber(tx, {
      orderId: order.id,
      quotationId: order.quotationId,
      documentType: "INVOICE",
      numberType: "invoice",
      title: "Order Invoice"
    })
  );

  return {
    kind: "invoice",
    title: "Order Invoice",
    subtitle: "Sales order payment summary",
    filename: generatedFilename("invoice", invoiceNumber),
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
    summary: [
      {
        label: "Invoice number",
        value: invoiceNumber
      },
      ...orderSummary(order, settings)
    ],
    totals: orderTotals(order),
    items: order.items.map((item) => ({
      code: item.snapshotProductCode,
      name: item.itemName,
      description: item.description ?? item.specifications,
      quantity: formatQuantity(Number(item.quantity)),
      unitPrice: formatMoney(Number(item.unitPrice), order.currency),
      discount: formatMoney(Number(item.discountAmount), order.currency),
      discountDetail: discountDetail(item.discountType, item.discountValue, order.currency),
      total: formatMoney(Number(item.lineTotal), order.currency),
      notes: item.customerNotes,
      imageUrl: primaryImage(item.images)
    })),
    notes: order.customerNotes,
    paymentInstructions: settings.payment.defaultPaymentInstructions,
    footerNote: footerForKind(settings, "invoice")
  };
}

export async function getPaymentReceiptPdfData(paymentId: string): Promise<OperationalPdfData> {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: {
        id: paymentId
      },
      select: {
        id: true,
        paymentNumber: true
      }
    });

    if (payment && !payment.paymentNumber) {
      await tx.payment.update({
        where: {
          id: payment.id
        },
        data: {
          paymentNumber: await generatePaymentNumber(tx)
        }
      });
    }
  });

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

  const settings = await getAppSettings();
  const company = companyForPdf(settings);
  const receiptNumber = await prisma.$transaction(async (tx) => {
    const documentNumber = await ensureOrderDocumentNumber(tx, {
      orderId: payment.orderId,
      quotationId: payment.order.quotationId,
      paymentId: payment.id,
      documentType: "PAYMENT_RECEIPT",
      numberType: "payment",
      title: "Payment Receipt",
      existingNumber: payment.paymentNumber
    });

    if (!payment.receiptGenerated) {
      await tx.payment.update({
        where: {
          id: payment.id
        },
        data: {
          receiptGenerated: true
        }
      });
    }

    return documentNumber;
  });

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
    subtitle: "Acknowledgement of recorded payment",
    filename: generatedFilename(
      "payment-receipt",
      receiptNumber
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
      { label: "Order", value: orderDisplayNumber(settings, payment.order) },
      {
        label: "Receipt number",
        value: receiptNumber
      },
      { label: "Payment type", value: titleCaseLabel(payment.paymentType) },
      { label: "Payment date", value: formatDate(payment.paymentDate) },
      { label: "Method", value: titleCaseLabel(payment.method) },
      { label: "Reference", value: fallbackText(payment.referenceNumber) },
      { label: "Payer", value: payment.payerName ?? payment.order.customerDisplayNameSnapshot },
      { label: "Received by", value: fallbackText(payment.receivedBy?.displayName) },
      { label: "Order total", value: formatMoney(Number(payment.order.totalAmount), payment.order.currency) },
      { label: "Paid before", value: formatMoney(paidBefore, payment.order.currency) },
      { label: "Payment amount", value: formatMoney(Number(payment.amount), payment.order.currency) },
      { label: "Paid after", value: formatMoney(paidAfter, payment.order.currency) },
      { label: "Balance after", value: formatMoney(balanceAfter, payment.order.currency) }
    ],
    notes: payment.customerNotes,
    paymentInstructions: settings.payment.defaultPaymentInstructions,
    footerNote: footerForKind(settings, "payment-receipt")
  };
}

export async function getDeliveryReceiptPdfData(deliveryId: string): Promise<OperationalPdfData> {
  await prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.findUnique({
      where: {
        id: deliveryId
      },
      select: {
        id: true,
        deliveryNumber: true
      }
    });

    if (delivery && !delivery.deliveryNumber) {
      await tx.delivery.update({
        where: {
          id: delivery.id
        },
        data: {
          deliveryNumber: await generateDeliveryReceiptNumber(tx)
        }
      });
    }
  });

  const delivery = await prisma.delivery.findUnique({
    where: {
      id: deliveryId
    },
    include: {
      order: true,
      items: {
        include: {
          orderItem: {
            include: {
              images: {
                orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }]
              }
            }
          }
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

  const settings = await getAppSettings();
  const company = companyForPdf(settings);
  const deliveryReceiptNumber = await prisma.$transaction((tx) =>
    ensureOrderDocumentNumber(tx, {
      orderId: delivery.orderId,
      quotationId: delivery.order.quotationId,
      deliveryId: delivery.id,
      documentType: "DELIVERY_RECEIPT",
      numberType: "deliveryReceipt",
      title: "Delivery Receipt",
      existingNumber: delivery.deliveryNumber
    })
  );

  return {
    kind: "delivery-receipt",
    title: "Delivery Receipt",
    subtitle: "Delivery handoff document",
    filename: generatedFilename("delivery-receipt", deliveryReceiptNumber),
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
      { label: "Order", value: orderDisplayNumber(settings, delivery.order) },
      {
        label: "Delivery receipt number",
        value: deliveryReceiptNumber
      },
      { label: "Status", value: formatDeliveryStatus(delivery.status) },
      { label: "Scheduled date", value: formatDate(delivery.scheduledDate) },
      { label: "Time window", value: fallbackText(delivery.scheduledTimeWindow) },
      { label: "Provider type", value: titleCaseLabel(delivery.deliveryProviderType) },
      { label: "Provider", value: fallbackText(delivery.deliveryProviderName) },
      { label: "Provider reference", value: fallbackText(delivery.deliveryProviderReference) },
      { label: "Recipient", value: delivery.recipientName ?? delivery.order.customerDisplayNameSnapshot },
      { label: "Recipient phone", value: fallbackText(delivery.recipientPhone) },
      ...salesWorkflowRows(delivery.order)
    ],
    items: delivery.items.map((item) => ({
      code: item.orderItem.snapshotProductCode,
      name: item.orderItem.itemName,
      description: item.orderItem.description ?? item.orderItem.specifications,
      quantity: formatQuantity(Number(item.quantityPlanned)),
      quantityDelivered: formatQuantity(Number(item.quantityDelivered)),
      notes: item.notes,
      imageUrl: primaryImage(item.orderItem.images)
    })),
    notes: delivery.deliveryNotes,
    footerNote: footerForKind(settings, "delivery-receipt"),
    signatureRequired: true
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
        },
        include: {
          images: {
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }]
          }
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

  const settings = await getAppSettings();
  const company = companyForPdf(settings);
  const summaryNumber = await prisma.$transaction((tx) =>
    ensureOrderDocumentNumber(tx, {
      orderId: order.id,
      quotationId: order.quotationId,
      documentType: "FINAL_ORDER_SUMMARY",
      numberType: "finalSummary",
      title: "Final Order Summary"
    })
  );

  return {
    kind: "final-order-summary",
    title: "Final Order Summary",
    subtitle: "Order, payment, and delivery record",
    filename: generatedFilename("final-order-summary", summaryNumber),
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
    summary: [
      {
        label: "Final summary number",
        value: summaryNumber
      },
      ...orderSummary(order, settings)
    ],
    totals: orderTotals(order),
    items: order.items.map((item) => ({
      code: item.snapshotProductCode,
      name: item.itemName,
      description: item.description ?? item.specifications,
      quantity: formatQuantity(Number(item.quantity)),
      unitPrice: formatMoney(Number(item.unitPrice), order.currency),
      discount: formatMoney(Number(item.discountAmount), order.currency),
      discountDetail: discountDetail(item.discountType, item.discountValue, order.currency),
      total: formatMoney(Number(item.lineTotal), order.currency),
      notes: item.customerNotes,
      imageUrl: primaryImage(item.images)
    })),
    payments: order.payments.map((payment) => ({
      label: formatDate(payment.paymentDate),
      value: `${titleCaseLabel(payment.paymentType)} - ${formatMoney(Number(payment.amount), order.currency)}`
    })),
    deliveries: order.deliveries.map((delivery) => ({
      label: formatDate(delivery.scheduledDate),
      value: `${formatDeliveryStatus(delivery.status)} - ${
        delivery.deliveryProviderName ?? titleCaseLabel(delivery.deliveryProviderType, "Provider not specified")
      }`
    })),
    notes: order.customerNotes,
    paymentInstructions: settings.payment.defaultPaymentInstructions,
    footerNote: footerForKind(settings, "final-order-summary")
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
  paymentDueTiming?: string | null;
  paymentDueDate?: Date | null;
  needsAssembly: boolean;
  salesInvoiceRequested: boolean;
  modeOfDelivery?: string | null;
  deliveryMethod?: string | null;
  paymentTerms?: string | null;
  specialInstructions?: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  currency: string;
  subtotalAmount: unknown;
  itemDiscountTotal: unknown;
  orderDiscountAmount: unknown;
  totalAmount: unknown;
  paidAmount: unknown;
  balanceAmount: unknown;
}, settings: AppSettingsInput): PdfSummaryRow[] {
  return [
    { label: "Order", value: orderDisplayNumber(settings, order) },
    { label: "Order date", value: formatDate(order.confirmedAt ?? order.createdAt) },
    { label: "Status", value: titleCaseLabel(order.status) },
    { label: "Payment status", value: formatPaymentStatus(order.paymentStatus) },
    { label: "Delivery status", value: formatDeliveryStatus(order.deliveryStatus) },
    { label: "Payment due timing", value: titleCaseLabel(order.paymentDueTiming) },
    { label: "Payment due date", value: formatDate(order.paymentDueDate) },
    ...salesWorkflowRows(order)
  ];
}

function orderTotals(order: {
  currency: string;
  subtotalAmount: unknown;
  itemDiscountTotal: unknown;
  orderDiscountAmount: unknown;
  totalAmount: unknown;
  paidAmount: unknown;
  balanceAmount: unknown;
}): PdfSummaryRow[] {
  return [
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
