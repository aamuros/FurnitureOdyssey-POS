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
import { defaultPdfLogoSource } from "@/lib/pdf/assets";
import type { AppSettingsInput } from "@/lib/validation/settings";
import type {
  OperationalPdfData,
  OperationalPdfKind,
  PdfDocumentTermsBlock,
  PdfDisplayRow,
  PdfPaymentTermsBlock,
  PdfSummaryRow
} from "@/lib/pdf/types";

function cleanPdfSetting(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || /placeholder/i.test(trimmed) || /^not (specified|set|assigned|linked)$/i.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function textLines(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function bulletLines(value: string | null | undefined): string[] {
  return textLines(value).map((line) => line.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
}

export function paymentTermsBlockForPdf(settings: AppSettingsInput): PdfPaymentTermsBlock | null {
  const block = {
    policyTitle: cleanPdfSetting(settings.payment.pdfPaymentPolicyTitle),
    policyBullets: bulletLines(settings.payment.pdfPaymentPolicyBullets),
    highlightNote: cleanPdfSetting(settings.payment.pdfPaymentHighlightNote),
    bankDetailsTitle: cleanPdfSetting(settings.payment.pdfBankDetailsTitle),
    bankDetailsLines: textLines(settings.payment.pdfBankDetails)
  };

  if (
    !block.policyTitle &&
    !block.policyBullets.length &&
    !block.highlightNote &&
    !block.bankDetailsTitle &&
    !block.bankDetailsLines.length
  ) {
    return null;
  }

  return block;
}

export function documentTermsBlockForPdf(
  title: string | null | undefined,
  body: string | null | undefined
): PdfDocumentTermsBlock | null {
  const block = {
    title: cleanPdfSetting(title),
    lines: textLines(body)
  };

  if (!block.title && !block.lines.length) {
    return null;
  }

  return block;
}

export function companyForPdf(settings: AppSettingsInput) {
  return {
    displayName: cleanPdfSetting(settings.companyProfile.companyName) ?? "Furniture Odyssey",
    registeredName: cleanPdfSetting(settings.companyProfile.registeredName),
    address: cleanPdfSetting(settings.companyProfile.address),
    contactNumber: cleanPdfSetting(settings.companyProfile.contactNumber),
    email: cleanPdfSetting(settings.companyProfile.email),
    facebookPage: cleanPdfSetting(settings.companyProfile.facebookPage),
    websiteUrl: cleanPdfSetting(settings.companyProfile.websiteUrl),
    logoUrl: settings.companyProfile.logoUrl || defaultPdfLogoSource(),
    logoAltText: cleanPdfSetting(settings.companyProfile.logoAltText),
    bankDetails: cleanPdfSetting(settings.payment.bankDetails),
    eWalletDetails: cleanPdfSetting(settings.payment.eWalletDetails),
    otherPaymentNotes: cleanPdfSetting(settings.payment.otherPaymentNotes),
    paymentInstructions: cleanPdfSetting(settings.payment.defaultPaymentInstructions),
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

function normalizePdfDisplayRows(value: unknown): PdfDisplayRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 12)
    .map((row, index) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const record = row as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim().slice(0, 80) : "";
      const rowValue = typeof record.value === "string" ? record.value.trim().slice(0, 200) : "";

      if (!label || !rowValue) {
        return null;
      }

      return {
        id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : `row-${index + 1}`,
        label,
        value: rowValue
      };
    })
    .filter((row): row is { id: string; label: string; value: string } => Boolean(row));
}

function deliveryReceiptSummaryRows({
  pdfDetails,
  orderNumber,
  deliveryReceiptNumber,
  scheduledDate,
  scheduledTimeWindow
}: {
  pdfDetails: unknown;
  orderNumber: string;
  deliveryReceiptNumber: string;
  scheduledDate: Date | null;
  scheduledTimeWindow: string | null;
}): PdfSummaryRow[] {
  const fallbackRows = [
    { label: "Order", value: orderNumber },
    { label: "Delivery receipt number", value: deliveryReceiptNumber },
    { label: "Scheduled date", value: formatDate(scheduledDate) },
    { label: "Time window", value: fallbackText(scheduledTimeWindow) }
  ];

  if (pdfDetails == null) {
    return fallbackRows;
  }

  if (!Array.isArray(pdfDetails)) {
    return fallbackRows;
  }

  const rows = normalizePdfDisplayRows(pdfDetails);

  return rows.map((row) => ({
    label: row.label,
    value:
      row.value === "Auto-generated after saving/export"
        ? deliveryReceiptNumber
        : row.value
  }));
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
    { label: "Needs assemble", value: yesNo(value.needsAssembly) },
    { label: "Sales invoice requested", value: yesNo(value.salesInvoiceRequested) },
    { label: "Mode of delivery", value: fallbackText(value.modeOfDelivery) },
    { label: "Delivery method", value: fallbackText(value.deliveryMethod) },
    { label: "Payment terms", value: fallbackText(value.paymentTerms) },
    { label: "Special instructions", value: fallbackText(value.specialInstructions) }
  ];
}

function quotationTotals(quotation: {
  subtotalAmount: unknown;
  itemDiscountTotal: unknown;
  quotationDiscountAmount: unknown;
  assemblyFeeTotal: unknown;
  salesInvoiceFeeTotal: unknown;
  totalAmount: unknown;
  currency: string;
}): PdfSummaryRow[] {
  const subtotalForItems = Math.max(
    Number(quotation.subtotalAmount) - Number(quotation.itemDiscountTotal),
    0
  );
  const additionalFees = Math.max(
    Number(quotation.totalAmount) -
      (Number(quotation.subtotalAmount) -
        Number(quotation.itemDiscountTotal) -
        Number(quotation.quotationDiscountAmount) +
        Number(quotation.assemblyFeeTotal) +
        Number(quotation.salesInvoiceFeeTotal)),
    0
  );
  const finalSubtotal = Math.max(Number(quotation.totalAmount) - Number(quotation.salesInvoiceFeeTotal), 0);

  return [
    { label: "Subtotal for Items", value: formatMoney(subtotalForItems, quotation.currency) },
    { label: "Assemble Fee", value: formatMoney(Number(quotation.assemblyFeeTotal), quotation.currency) },
    { label: "Additional Fees", value: formatMoney(additionalFees, quotation.currency) },
    {
      label: "Additional Discount",
      value: `-${formatMoney(Number(quotation.quotationDiscountAmount), quotation.currency)}`
    },
    { label: "Final Subtotal", value: formatMoney(finalSubtotal, quotation.currency) },
    { label: "Sales Invoice Fee", value: formatMoney(Number(quotation.salesInvoiceFeeTotal), quotation.currency) },
    { label: "Final Total", value: formatMoney(Number(quotation.totalAmount), quotation.currency) }
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
    totals: quotationTotals(quotation),
    items: quotation.items.map((item) => ({
      code: item.snapshotProductCode,
      name: item.itemName,
      description: [
        item.snapshotVariantName ? `Variant: ${item.snapshotVariantName}` : null,
        item.description,
        item.specifications
      ]
        .filter(Boolean)
        .join("\n"),
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
    footerNote: footerForKind(settings, "quotation"),
    paymentTermsBlock: paymentTermsBlockForPdf(settings)
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
    footerNote: footerForKind(settings, "invoice"),
    paymentTermsBlock: paymentTermsBlockForPdf(settings)
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
    footerNote: footerForKind(settings, "payment-receipt"),
    documentTermsBlock: documentTermsBlockForPdf(
      settings.payment.pdfPaymentReceiptTermsTitle,
      settings.payment.pdfPaymentReceiptTerms
    )
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
        deliveryNumber: true,
        pdfDetails: true
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
      ...deliveryReceiptSummaryRows({
        pdfDetails: delivery.pdfDetails,
        orderNumber: orderDisplayNumber(settings, delivery.order),
        deliveryReceiptNumber,
        scheduledDate: delivery.scheduledDate,
        scheduledTimeWindow: delivery.scheduledTimeWindow
      })
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
    signatureRequired: true,
    documentTermsBlock: documentTermsBlockForPdf(
      settings.payment.pdfDeliveryReceiptTermsTitle,
      settings.payment.pdfDeliveryReceiptTerms
    )
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
    footerNote: footerForKind(settings, "final-order-summary"),
    paymentTermsBlock: paymentTermsBlockForPdf(settings)
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
  assemblyFeeTotal: unknown;
  salesInvoiceFeeTotal: unknown;
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
  assemblyFeeTotal: unknown;
  salesInvoiceFeeTotal: unknown;
  totalAmount: unknown;
  paidAmount: unknown;
  balanceAmount: unknown;
}): PdfSummaryRow[] {
  return [
    { label: "Subtotal for Items", value: formatMoney(Number(order.subtotalAmount), order.currency) },
    { label: "Item discounts", value: formatMoney(Number(order.itemDiscountTotal), order.currency) },
    {
      label: "Order discount",
      value: formatMoney(Number(order.orderDiscountAmount), order.currency)
    },
    ...(Number(order.assemblyFeeTotal) > 0
      ? [{ label: "Assemble fee", value: formatMoney(Number(order.assemblyFeeTotal), order.currency) }]
      : []),
    ...(Number(order.salesInvoiceFeeTotal) > 0
      ? [
          {
            label: "Sales invoice fee",
            value: formatMoney(Number(order.salesInvoiceFeeTotal), order.currency)
          }
        ]
      : []),
    { label: "Total", value: formatMoney(Number(order.totalAmount), order.currency) },
    { label: "Paid", value: formatMoney(Number(order.paidAmount), order.currency) },
    { label: "Balance", value: formatMoney(Number(order.balanceAmount), order.currency) }
  ];
}

export function generatedLabel(data: OperationalPdfData) {
  return `Generated ${formatDateTime(data.generatedAt)}`;
}
