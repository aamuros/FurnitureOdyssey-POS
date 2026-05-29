"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  DeliveryProviderType,
  DeliveryStatus,
  DiscountType,
  DocumentType,
  OrderDeliveryStatus,
  Prisma,
  QuotationItemType
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/server";
import {
  generateDeliveryReceiptNumber,
  generateFinalSummaryNumber,
  generateInvoiceNumber,
  generateOrderNumber,
  generatePaymentNumber
} from "@/lib/numbering";
import {
  calculateOrderItem,
  calculateOrderTotals,
  quotationUnitCostSnapshotForOrderItem
} from "@/lib/orders/calculations";
import {
  canCompleteOrder,
  canScheduleOrderDelivery
} from "@/lib/orders/status";
import {
  assertDeliveryPlanDoesNotExceedOrdered,
  calculateDeliverySummary
} from "@/lib/deliveries/calculations";
import { prepareDeliveryProgressUpdate } from "@/lib/deliveries/progress";
import {
  assertPaymentDoesNotOverpay,
  calculatePaymentSummary
} from "@/lib/payments/calculations";
import {
  assertValidStatusTransition,
  nextOrderStatusFromProgress
} from "@/lib/status-transitions";
import {
  completeOrderSchema,
  convertQuotationToOrderSchema,
  cancelOrderSchema,
  createDeliverySchema,
  createManualOrderSchema,
  createOrderDocumentSchema,
  createPaymentSchema,
  deleteOrderSchema,
  updateDeliveryProgressSchema,
  updatePaymentDueTimingSchema,
  type OrderItemInput
} from "@/lib/validation/orders";
import {
  createDeliveryCalendarEvent,
  deleteDeliveryCalendarEvent,
  updateDeliveryCalendarEvent,
  type DeliveryCalendarSyncResult
} from "@/lib/google-calendar/delivery-events";

type ActionState = {
  ok: boolean;
  message: string;
  orderId?: string;
  orderNumber?: string | null;
};

type OrderTx = Prisma.TransactionClient;
type QuotationForOrderConversion = Prisma.QuotationGetPayload<{
  include: {
    order: true;
    customer: {
      include: {
        contacts: true;
        addresses: true;
      };
    };
    items: {
      include: {
        images: true;
      };
    };
  };
}>;

class ActionError extends Error {}

const deliveryCalendarEventDurationMs = 30 * 60 * 1000;

function combineScheduledDateAndTime(scheduledDate: Date, scheduledTime?: string) {
  if (!scheduledTime) {
    return {
      scheduledStartAt: null,
      scheduledEndAt: null
    };
  }

  const datePart = scheduledDate.toISOString().slice(0, 10);
  const scheduledStartAt = new Date(`${datePart}T${scheduledTime}:00+08:00`);

  return {
    scheduledStartAt,
    scheduledEndAt: new Date(scheduledStartAt.getTime() + deliveryCalendarEventDurationMs)
  };
}

async function syncDeliveryCalendarSafely(
  deliveryId: string,
  syncOperation: (deliveryId: string) => Promise<DeliveryCalendarSyncResult>
) {
  try {
    await syncOperation(deliveryId);
  } catch {
    // Calendar sync failures must not block delivery operations.
    // Per-target errors are recorded in DeliveryCalendarEvent records by the sync service.
  }
}

function parseJsonArray(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function firstIssue(error: { issues: Array<{ message: string; path?: Array<string | number> }> }, fallback: string) {
  if (!error.issues.length) {
    return fallback;
  }

  return error.issues
    .map((issue) => {
      const path = issue.path?.length ? issue.path.join(".") : "form";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function safeReturnPath(value: FormDataEntryValue | null, fallback: string) {
  const path = String(value ?? "").trim();
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

function formatDeliveryPdfDate(value: Date | null | undefined) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

function deliveryPdfDetailRows({
  orderNumber,
  deliveryNumber,
  scheduledDate,
  scheduledTimeWindow
}: {
  orderNumber: string | null;
  deliveryNumber: string | null;
  scheduledDate: Date | null | undefined;
  scheduledTimeWindow: string | null | undefined;
}) {
  return [
    { id: "row-1", label: "Order", value: orderNumber ?? "Not assigned" },
    {
      id: "row-2",
      label: "Delivery receipt number",
      value: deliveryNumber ?? "Auto-generated after saving/export"
    },
    { id: "row-3", label: "Scheduled date", value: formatDeliveryPdfDate(scheduledDate) },
    { id: "row-4", label: "Time window", value: scheduledTimeWindow?.trim() || "Not set" }
  ];
}

function submittedPdfDetailsOrDefault(
  rawValue: FormDataEntryValue | null,
  parsedRows: Array<{ id: string; label: string; value: string }>,
  defaultRows: Array<{ id: string; label: string; value: string }>
) {
  if (rawValue == null) {
    return defaultRows;
  }

  try {
    const parsed = JSON.parse(String(rawValue));
    return Array.isArray(parsed) ? parsedRows : defaultRows;
  } catch {
    return defaultRows;
  }
}

function primaryContactSnapshot(
  contacts: Array<{ type: string; label: string | null; value: string; isPrimary: boolean }>
) {
  const contact = contacts[0];

  return contact
    ? {
        type: contact.type,
        label: contact.label,
        value: contact.value,
        isPrimary: contact.isPrimary
      }
    : undefined;
}

function addressSnapshot(
  addresses: Array<{
    label: string | null;
    recipientName: string | null;
    phone: string | null;
    addressLine: string;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    notes: string | null;
    isDefault: boolean;
  }>
) {
  const address = addresses[0];

  return address
    ? {
        label: address.label,
        recipientName: address.recipientName,
        phone: address.phone,
        addressLine: address.addressLine,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
        notes: address.notes,
        isDefault: address.isDefault
      }
    : undefined;
}

async function updateOrderPaymentSummaryTx(tx: OrderTx, orderId: string, actorId: string) {
  const order = await tx.order.findUnique({
    where: {
      id: orderId
    },
    select: {
      id: true,
      status: true,
      totalAmount: true,
      paymentStatus: true,
      paymentDueTiming: true,
      deliveryStatus: true,
      orderNumber: true,
      payments: {
        where: {
          status: "RECORDED"
        },
        orderBy: {
          paymentDate: "desc"
        },
        select: {
          amount: true,
          status: true,
          paymentType: true,
          paymentDate: true
        }
      }
    }
  });

  if (!order) {
    throw new Error("Order was not found.");
  }

  const paymentSummary = calculatePaymentSummary({
    totalAmount: Number(order.totalAmount),
    payments: order.payments.map((payment) => ({
      amount: Number(payment.amount),
      status: payment.status,
      paymentType: payment.paymentType,
      paymentDate: payment.paymentDate
    })),
    paymentDueTiming: order.paymentDueTiming
  });
  const nextOrderStatus = nextOrderStatusFromProgress({
    currentStatus: order.status,
    paymentStatus: paymentSummary.paymentStatus,
    deliveryStatus: order.deliveryStatus
  });

  await tx.order.update({
    where: {
      id: order.id
    },
    data: {
      paidAmount: paymentSummary.paidAmount,
      balanceAmount: paymentSummary.balanceAmount,
      lastPaymentAt: paymentSummary.lastPaymentAt,
      paymentStatus: paymentSummary.paymentStatus,
      status: nextOrderStatus,
      updatedById: actorId
    }
  });

  if (order.status !== nextOrderStatus || order.paymentStatus !== paymentSummary.paymentStatus) {
    await tx.activityLog.create({
      data: {
        action: "ORDER_UPDATED",
        actorId,
        summary: `Updated payment progress for order ${order.id}.`,
        metadata: {
          entityType: "order",
          entityId: order.id,
          oldStatus: order.status,
          newStatus: nextOrderStatus,
          oldPaymentStatus: order.paymentStatus,
          newPaymentStatus: paymentSummary.paymentStatus,
          sourceAction: "payment_summary"
        }
      }
    });
  }
}

async function updateOrderDeliverySummaryTx(tx: OrderTx, orderId: string, actorId: string) {
  const order = await tx.order.findUnique({
    where: {
      id: orderId
    },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      deliveryStatus: true,
      orderNumber: true,
      items: {
        select: {
          id: true,
          quantity: true,
          deliveryItems: {
            where: {
              delivery: {
                status: {
                  notIn: ["CANCELLED", "FAILED"]
                }
              }
            },
            select: {
              quantityDelivered: true,
              delivery: {
                select: {
                  status: true
                }
              }
            }
          }
        }
      },
      deliveries: {
        where: {
          status: {
            notIn: ["CANCELLED", "FAILED"]
          }
        },
        select: {
          status: true
        }
      }
    }
  });

  if (!order) {
    throw new Error("Order was not found.");
  }

  const deliverySummary = calculateDeliverySummary({
    orderItems: order.items.map((item) => ({
      id: item.id,
      quantity: Number(item.quantity),
      deliveryItems: item.deliveryItems.map((deliveryItem) => ({
        quantityDelivered: Number(deliveryItem.quantityDelivered),
        delivery: {
          status: deliveryItem.delivery.status
        }
      }))
    })),
    deliveries: order.deliveries.map((delivery) => ({
      status: delivery.status
    }))
  });
  const nextDeliveryStatus = deliverySummary.deliveryStatus as OrderDeliveryStatus;
  assertValidStatusTransition("orderDelivery", order.deliveryStatus, nextDeliveryStatus);

  const nextOrderStatus = nextOrderStatusFromProgress({
    currentStatus: order.status,
    paymentStatus: order.paymentStatus,
    deliveryStatus: nextDeliveryStatus
  });

  await tx.order.update({
    where: {
      id: order.id
    },
    data: {
      deliveryStatus: nextDeliveryStatus,
      status: nextOrderStatus,
      updatedById: actorId
    }
  });

  if (order.status !== nextOrderStatus || order.deliveryStatus !== nextDeliveryStatus) {
    await tx.activityLog.create({
      data: {
        action: "ORDER_UPDATED",
        actorId,
        summary: `Updated delivery progress for order ${order.id}.`,
        metadata: {
          entityType: "order",
          entityId: order.id,
          oldStatus: order.status,
          newStatus: nextOrderStatus,
          oldDeliveryStatus: order.deliveryStatus,
          newDeliveryStatus: nextDeliveryStatus,
          sourceAction: "delivery_summary"
        }
      }
    });
  }
}

async function findQuotationForOrderConversion(tx: OrderTx, quotationId: string) {
  return tx.quotation.findUnique({
    where: {
      id: quotationId
    },
    include: {
      order: true,
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
            orderBy: {
              sortOrder: "asc"
            }
          }
        }
      }
    }
  });
}

async function createOrderFromQuotationTx(
  tx: OrderTx,
  quotation: QuotationForOrderConversion,
  actorId: string
) {
  const orderNumber = await generateOrderNumber(tx);
  const calculatedItems = quotation.items.map((item) =>
    calculateOrderItem({
      quotationItemId: item.id,
      productId: item.productId ?? undefined,
      itemType: item.itemType,
      sortOrder: item.sortOrder,
      snapshotProductCode: item.snapshotProductCode ?? undefined,
      itemName: item.itemName,
      description: item.description ?? undefined,
      specifications: item.specifications ?? undefined,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      unitCostSnapshot: quotationUnitCostSnapshotForOrderItem(item),
      discountType: item.discountType ?? undefined,
      discountValue: item.discountValue ? Number(item.discountValue) : undefined,
      customerNotes: item.customerNotes ?? undefined,
      internalNotes: item.internalNotes ?? undefined,
      images: []
    })
  );
  const totalCostAmount = roundMoney(calculatedItems.reduce((sum, item) => sum + item.lineCostTotal, 0));
  const grossProfitAmount = roundMoney(Number(quotation.totalAmount) - totalCostAmount);

  const created = await tx.order.create({
    data: {
      orderNumber,
      quotationId: quotation.id,
      customerId: quotation.customerId,
      inquiryId: quotation.inquiryId,
      status: "CONFIRMED",
      paymentStatus: "UNPAID",
      deliveryStatus: "NOT_SCHEDULED",
      currency: quotation.currency,
      customerDisplayNameSnapshot: quotation.customer.displayName,
      customerTypeSnapshot: quotation.customer.customerType,
      companyNameSnapshot: quotation.customer.companyName,
      contactPersonNameSnapshot: quotation.customer.contactPersonName,
      primaryContactSnapshot: primaryContactSnapshot(quotation.customer.contacts),
      billingAddressSnapshot: addressSnapshot(quotation.customer.addresses),
      deliveryAddressSnapshot: addressSnapshot(quotation.customer.addresses),
      subtotalAmount: quotation.subtotalAmount,
      itemDiscountTotal: quotation.itemDiscountTotal,
      orderDiscountType: quotation.quotationDiscountType,
      orderDiscountValue: quotation.quotationDiscountValue,
      orderDiscountAmount: quotation.quotationDiscountAmount,
      assemblyFeeTotal: quotation.assemblyFeeTotal,
      salesInvoiceFeeTotal: quotation.salesInvoiceFeeTotal,
      totalAmount: quotation.totalAmount,
      totalCostAmount,
      grossProfitAmount,
      paidAmount: 0,
      balanceAmount: quotation.totalAmount,
      needsAssembly: quotation.needsAssembly,
      salesInvoiceRequested: quotation.salesInvoiceRequested,
      modeOfDelivery: quotation.modeOfDelivery,
      deliveryMethod: quotation.deliveryMethod,
      paymentTerms: quotation.paymentTerms,
      specialInstructions: quotation.specialInstructions,
      customerNotes: quotation.customerNotes,
      internalNotes: quotation.internalNotes,
      sourceType: "QUOTATION",
      confirmedAt: new Date(),
      createdById: actorId,
      updatedById: actorId,
      items: {
        create: quotation.items.map((item, index) => ({
          quotationItemId: item.id,
          productId: item.productId,
          itemType: item.itemType,
          sortOrder: item.sortOrder,
          snapshotProductCode: item.snapshotProductCode,
          itemName: item.itemName,
          description: item.description,
          specifications: item.specifications,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountType: item.discountType,
          discountValue: item.discountValue,
          discountAmount: item.discountAmount,
          lineSubtotal: item.lineSubtotal,
          lineTotal: item.lineTotal,
          unitCostSnapshot: calculatedItems[index].unitCostSnapshot,
          lineCostTotal: calculatedItems[index].lineCostTotal,
          lineProfit: calculatedItems[index].lineProfit,
          requiresAssembly: item.requiresAssembly,
          customerNotes: item.customerNotes,
          internalNotes: item.internalNotes,
          images: item.images.length
            ? {
                create: item.images.map((image) => ({
                  sourceQuotationItemImageId: image.id,
                  sourceProductImageId: image.sourceProductImageId,
                  cloudinaryPublicId: image.cloudinaryPublicId,
                  secureUrl: image.secureUrl,
                  resourceType: image.resourceType,
                  format: image.format,
                  width: image.width,
                  height: image.height,
                  bytes: image.bytes,
                  altText: image.altText,
                  sortOrder: image.sortOrder,
                  isPrimary: image.isPrimary
                }))
              }
            : undefined
        }))
      }
    }
  });

  if (quotation.inquiryId) {
    await tx.inquiry.update({
      where: {
        id: quotation.inquiryId
      },
      data: {
        status: "CONVERTED_TO_ORDER"
      }
    });
  }

  await tx.activityLog.createMany({
    data: [
      {
        action: "QUOTATION_CONVERTED_TO_ORDER",
        actorId,
        summary: `Converted quotation for ${quotation.customer.displayName} to an order.`,
        metadata: {
          quotationId: quotation.id,
          orderId: created.id,
          customerId: quotation.customerId,
          needsAssembly: quotation.needsAssembly,
          salesInvoiceRequested: quotation.salesInvoiceRequested,
          modeOfDelivery: quotation.modeOfDelivery,
          deliveryMethod: quotation.deliveryMethod,
          paymentTerms: quotation.paymentTerms
        }
      },
      {
        action: "ORDER_CREATED",
        actorId,
        summary: `Created order for ${quotation.customer.displayName}.`,
        metadata: {
          orderId: created.id,
          orderNumber: created.orderNumber,
          quotationId: quotation.id,
          totalAmount: Number(quotation.totalAmount),
          totalCostAmount,
          grossProfitAmount,
          needsAssembly: quotation.needsAssembly,
          assemblyFeeTotal: Number(quotation.assemblyFeeTotal),
          salesInvoiceFeeTotal: Number(quotation.salesInvoiceFeeTotal),
          salesInvoiceRequested: quotation.salesInvoiceRequested
        }
      }
    ]
  });

  return created;
}

export async function convertAcceptedQuotationToOrderTx(
  tx: OrderTx,
  quotationId: string,
  actorId: string
) {
  const quotation = await findQuotationForOrderConversion(tx, quotationId);

  if (!quotation) {
    throw new ActionError("Quotation was not found.");
  }

  if (quotation.order) {
    return quotation.order;
  }

  if (quotation.status !== "ACCEPTED") {
    throw new ActionError("Only approved quotations can be converted to orders.");
  }

  if (quotation.items.length === 0) {
    throw new ActionError("Quotation needs at least one item before conversion.");
  }

  return createOrderFromQuotationTx(tx, quotation, actorId);
}

export async function convertQuotationToOrderAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("ORDERS", "CREATE");
  const parsed = convertQuotationToOrderSchema.safeParse({
    quotationId: formData.get("quotationId")
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: firstIssue(parsed.error, "Invalid quotation.")
    };
  }

  const quotation = await prisma.quotation.findUnique({
    where: {
      id: parsed.data.quotationId
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true
        }
      },
      customer: {
        select: {
          displayName: true
        }
      }
    }
  });

  if (!quotation) {
    return {
      ok: false,
      message: "Quotation was not found."
    };
  }

  if (quotation.order) {
    revalidatePath("/orders");
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${quotation.id}`);

    return {
      ok: true,
      orderId: quotation.order.id,
      orderNumber: quotation.order.orderNumber,
      message: `Quotation already has an order: ${quotation.order.orderNumber ?? quotation.order.id}.`
    };
  }

  let order;

  try {
    order = await prisma.$transaction((tx) =>
      convertAcceptedQuotationToOrderTx(tx, quotation.id, actor.id)
    );
  } catch (error) {
    if (error instanceof ActionError) {
      return {
        ok: false,
        message: error.message
      };
    }

    throw error;
  }

  revalidatePath("/orders");
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${quotation.id}`);
  revalidatePath("/inquiries");

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.orderNumber,
    message: `Order created from approved quotation for ${quotation.customer.displayName}: ${order.orderNumber ?? order.id}.`
  };
}

export async function createManualOrderAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("ORDERS", "CREATE");
  const parsed = createManualOrderSchema.safeParse({
    customerId: formData.get("customerId"),
    orderDiscountType: formData.get("orderDiscountType") || undefined,
    orderDiscountValue: formData.get("orderDiscountValue") || undefined,
    needsAssembly: formData.get("needsAssembly"),
    salesInvoiceRequested: formData.get("salesInvoiceRequested"),
    paymentDueTiming: formData.get("paymentDueTiming") || undefined,
    paymentDueDate: formData.get("paymentDueDate") || undefined,
    modeOfDelivery: formData.get("modeOfDelivery"),
    deliveryMethod: formData.get("deliveryMethod"),
    paymentTerms: formData.get("paymentTerms"),
    specialInstructions: formData.get("specialInstructions"),
    customerNotes: formData.get("customerNotes"),
    internalNotes: formData.get("internalNotes"),
    items: parseJsonArray(formData.get("items"))
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: firstIssue(parsed.error, "Invalid order details.")
    };
  }

  const catalogProductIds = parsed.data.items
    .filter((item) => item.itemType === "CATALOG_PRODUCT" && item.productId)
    .map((item) => item.productId as string);

  const [customer, productCosts] = await Promise.all([
    prisma.customer.findFirst({
      where: {
        id: parsed.data.customerId,
        archivedAt: null
      },
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
    }),
    catalogProductIds.length
      ? prisma.product.findMany({
          where: {
            id: {
              in: catalogProductIds
            }
          },
          select: {
            id: true,
            referenceCost: true
          }
        })
      : Promise.resolve([])
  ]);

  if (!customer) {
    return {
      ok: false,
      message: "Customer was not found."
    };
  }
  const productCostById = new Map(
    productCosts.map((product) => [product.id, Number(product.referenceCost ?? 0)])
  );
  const canSetCosts = hasPermission(actor, "PAYMENTS", "VIEW");
  const itemsWithCosts = parsed.data.items.map((item) => ({
    ...item,
    unitCostSnapshot:
      (canSetCosts ? (item.unitCostSnapshot ?? item.unitCost) : undefined) ??
      (item.productId ? productCostById.get(item.productId) : undefined) ??
      0
  }));
  const orderInput = {
    ...parsed.data,
    items: itemsWithCosts
  };

  let totals;

  try {
    totals = calculateOrderTotals(orderInput);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Order totals are invalid."
    };
  }

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx);
    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
        paymentDueTiming: parsed.data.paymentDueTiming,
        paymentDueDate: parsed.data.paymentDueDate,
        deliveryStatus: "NOT_SCHEDULED",
        currency: "PHP",
        customerDisplayNameSnapshot: customer.displayName,
        customerTypeSnapshot: customer.customerType,
        companyNameSnapshot: customer.companyName,
        contactPersonNameSnapshot: customer.contactPersonName,
        primaryContactSnapshot: primaryContactSnapshot(customer.contacts),
        billingAddressSnapshot: addressSnapshot(customer.addresses),
        deliveryAddressSnapshot: addressSnapshot(customer.addresses),
        subtotalAmount: totals.subtotalAmount,
        itemDiscountTotal: totals.itemDiscountTotal,
        orderDiscountType: parsed.data.orderDiscountType as DiscountType | undefined,
        orderDiscountValue: parsed.data.orderDiscountValue,
        orderDiscountAmount: totals.orderDiscountAmount,
        totalAmount: totals.totalAmount,
        totalCostAmount: totals.totalCostAmount,
        grossProfitAmount: totals.grossProfitAmount,
        paidAmount: 0,
        balanceAmount: totals.totalAmount,
        needsAssembly: parsed.data.needsAssembly,
        salesInvoiceRequested: parsed.data.salesInvoiceRequested,
        modeOfDelivery: parsed.data.modeOfDelivery,
        deliveryMethod: parsed.data.deliveryMethod,
        paymentTerms: parsed.data.paymentTerms,
        specialInstructions: parsed.data.specialInstructions,
        customerNotes: parsed.data.customerNotes,
        internalNotes: parsed.data.internalNotes,
        sourceType: "MANUAL",
        confirmedAt: new Date(),
        createdById: actor.id,
        updatedById: actor.id,
        items: {
          create: orderInput.items.map((item, index) => {
            const calculatedItem = calculateOrderItem(item);

            return {
              quotationItemId: item.quotationItemId,
              productId: item.productId,
              itemType: item.itemType as QuotationItemType,
              sortOrder: item.sortOrder ?? index,
              snapshotProductCode: item.snapshotProductCode,
              itemName: item.itemName,
              description: item.description,
              specifications: item.specifications,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountType: item.discountType as DiscountType | undefined,
              discountValue: item.discountValue,
              discountAmount: calculatedItem.discountAmount,
              lineSubtotal: calculatedItem.lineSubtotal,
              lineTotal: calculatedItem.lineTotal,
              unitCostSnapshot: calculatedItem.unitCostSnapshot,
              lineCostTotal: calculatedItem.lineCostTotal,
              lineProfit: calculatedItem.lineProfit,
              customerNotes: item.customerNotes,
              internalNotes: item.internalNotes,
              images: item.images.length
                ? {
                    create: item.images.map((image: OrderItemInput["images"][number], imageIndex: number) => ({
                      sourceQuotationItemImageId: image.sourceQuotationItemImageId,
                      sourceProductImageId: image.sourceProductImageId,
                      cloudinaryPublicId: image.cloudinaryPublicId,
                      secureUrl: image.secureUrl,
                      resourceType: image.resourceType,
                      format: image.format,
                      width: image.width,
                      height: image.height,
                      bytes: image.bytes,
                      altText: image.altText,
                      sortOrder: image.sortOrder ?? imageIndex,
                      isPrimary: image.isPrimary || imageIndex === 0
                    }))
                  }
                : undefined
            };
          })
        }
      }
    });

    await tx.activityLog.create({
      data: {
        action: "ORDER_CREATED",
        actorId: actor.id,
        summary: `Created manual order for ${customer.displayName}.`,
        metadata: {
          orderId: created.id,
          orderNumber: created.orderNumber,
          customerId: customer.id,
          totalAmount: totals.totalAmount,
          totalCostAmount: totals.totalCostAmount,
          grossProfitAmount: totals.grossProfitAmount,
          needsAssembly: parsed.data.needsAssembly,
          salesInvoiceRequested: parsed.data.salesInvoiceRequested,
          paymentDueTiming: parsed.data.paymentDueTiming,
          paymentDueDate: parsed.data.paymentDueDate?.toISOString(),
          modeOfDelivery: parsed.data.modeOfDelivery,
          deliveryMethod: parsed.data.deliveryMethod,
          paymentTerms: parsed.data.paymentTerms
        }
      }
    });

    return created;
  });

  revalidatePath("/orders");

  return {
    ok: true,
    message: `Manual order saved for ${customer.displayName}: ${order.orderNumber ?? order.id}.`
  };
}

export async function createPaymentAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("PAYMENTS", "CREATE");
  const parsed = createPaymentSchema.safeParse({
    orderId: formData.get("orderId"),
    paymentType: formData.get("paymentType"),
    paymentDate: formData.get("paymentDate"),
    amount: formData.get("amount"),
    method: formData.get("method") || undefined,
    referenceNumber: formData.get("referenceNumber"),
    payerName: formData.get("payerName"),
    customerNotes: formData.get("customerNotes"),
    internalNotes: formData.get("internalNotes")
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: firstIssue(parsed.error, "Invalid payment details.")
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: {
          id: parsed.data.orderId
        },
        include: {
          payments: {
            where: {
              status: "RECORDED"
            }
          }
        }
      });

      if (!order || ["COMPLETED", "CANCELLED"].includes(order.status)) {
        throw new ActionError("Order is not available for payment.");
      }

      try {
        assertPaymentDoesNotOverpay({
          totalAmount: Number(order.totalAmount),
          existingPayments: order.payments.map((payment) => ({
            amount: Number(payment.amount),
            status: payment.status
          })),
          nextPaymentAmount: parsed.data.amount
        });
      } catch (error) {
        throw new ActionError(error instanceof Error ? error.message : "Payment amount is invalid.");
      }

      const paymentNumber = await generatePaymentNumber(tx);
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          paymentNumber,
          paymentType: parsed.data.paymentType,
          paymentDate: parsed.data.paymentDate,
          amount: parsed.data.amount,
          method: parsed.data.method,
          referenceNumber: parsed.data.referenceNumber,
          payerName: parsed.data.payerName,
          customerNotes: parsed.data.customerNotes,
          internalNotes: parsed.data.internalNotes,
          receivedById: actor.id,
          createdById: actor.id,
          updatedById: actor.id
        }
      });

      await updateOrderPaymentSummaryTx(tx, order.id, actor.id);

      await tx.activityLog.create({
        data: {
          action: "PAYMENT_RECORDED",
          actorId: actor.id,
          summary: `Recorded payment for order ${order.id}.`,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            paymentId: payment.id,
            paymentNumber: payment.paymentNumber,
            amount: parsed.data.amount,
            paymentType: parsed.data.paymentType,
            method: parsed.data.method
          }
        }
      });
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return {
        ok: false,
        message: error.message
      };
    }

    throw error;
  }

  revalidatePath("/orders");
  revalidatePath("/payments");

  return {
    ok: true,
    message: "Payment recorded and balance updated."
  };
}

export async function updatePaymentDueTimingAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("ORDERS", "UPDATE");
  const parsed = updatePaymentDueTimingSchema.safeParse({
    orderId: formData.get("orderId"),
    paymentDueTiming: formData.get("paymentDueTiming") || undefined,
    paymentDueDate: formData.get("paymentDueDate") || undefined
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: firstIssue(parsed.error, "Invalid payment due timing.")
    };
  }

  const order = await prisma.order.findUnique({
    where: {
      id: parsed.data.orderId
    },
    select: {
      id: true,
      balanceAmount: true,
      status: true
    }
  });

  if (!order || ["COMPLETED", "CANCELLED"].includes(order.status)) {
    return {
      ok: false,
      message: "Order is not available for payment due updates."
    };
  }

  if (Number(order.balanceAmount) <= 0) {
    return {
      ok: false,
      message: "Payment due timing can only be set while a balance remains."
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: {
        id: order.id
      },
      data: {
        paymentDueTiming: parsed.data.paymentDueTiming,
        paymentDueDate: parsed.data.paymentDueDate,
        updatedById: actor.id
      }
    });

    await updateOrderPaymentSummaryTx(tx, order.id, actor.id);

    await tx.activityLog.create({
      data: {
        action: "ORDER_UPDATED",
        actorId: actor.id,
        summary: `Updated payment due timing for order ${order.id}.`,
        metadata: {
          orderId: order.id,
          paymentDueTiming: parsed.data.paymentDueTiming,
          paymentDueDate: parsed.data.paymentDueDate?.toISOString()
        }
      }
    });
  });

  revalidatePath("/orders");
  revalidatePath("/payments");

  return {
    ok: true,
    message: "Payment due timing updated."
  };
}

export async function createDeliveryAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("DELIVERIES", "CREATE");
  const initialDeliveryStatus: DeliveryStatus = "SCHEDULED";
  const assignedStaffId = formString(formData, "assignedStaffId");
  const deliveryProviderType = formString(formData, "deliveryProviderType");
  const pdfDetailsInput = formString(formData, "pdfDetails") || "[]";
  const parsed = createDeliverySchema.safeParse({
    orderId: formString(formData, "orderId"),
    assignedStaffId: assignedStaffId || undefined,
    scheduledDate: formString(formData, "scheduledDate") || undefined,
    scheduledStartTime: formString(formData, "scheduledStartTime"),
    scheduledEndTime: undefined,
    scheduledTimeWindow: formString(formData, "scheduledTimeWindow"),
    deliveryProviderType: deliveryProviderType || undefined,
    deliveryProviderName: formString(formData, "deliveryProviderName"),
    deliveryProviderReference: formString(formData, "deliveryProviderReference"),
    recipientName: formString(formData, "recipientName"),
    recipientPhone: formString(formData, "recipientPhone"),
    deliveryAddress: formString(formData, "deliveryAddress"),
    deliveryNotes: formString(formData, "deliveryNotes"),
    pdfDetails: pdfDetailsInput,
    internalNotes: formString(formData, "internalNotes"),
    items: parseJsonArray(formData.get("items"))
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: firstIssue(parsed.error, "Invalid delivery details.")
    };
  }

  let createdDeliveryId: string | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      if (parsed.data.assignedStaffId) {
        const assignedStaff = await tx.userProfile.findUnique({
          where: {
            id: parsed.data.assignedStaffId
          },
          include: {
            permissions: true
          }
        });

        const canHandleDeliveries =
          assignedStaff?.status === "ACTIVE" &&
          (hasPermission(assignedStaff, "DELIVERIES", "VIEW") ||
            hasPermission(assignedStaff, "DELIVERIES", "CREATE") ||
            hasPermission(assignedStaff, "DELIVERIES", "UPDATE"));

        if (!canHandleDeliveries) {
          throw new ActionError("Choose an active staff member who can handle deliveries.");
        }
      }

      const order = await tx.order.findUnique({
        where: {
          id: parsed.data.orderId
        },
        include: {
          items: {
            include: {
              deliveryItems: {
                where: {
                  delivery: {
                    status: {
                      notIn: ["CANCELLED", "FAILED"]
                    }
                  }
                },
                include: {
                  delivery: {
                    select: {
                      status: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!order || order.status === "CANCELLED") {
        throw new ActionError("Order is not available for delivery scheduling.");
      }

      const orderItemsForDeliveryState = order.items.map((item) => ({
        id: item.id,
        itemName: item.itemName,
        quantity: Number(item.quantity),
        deliveryItems: item.deliveryItems.map((deliveryItem) => ({
          quantityPlanned: Number(deliveryItem.quantityPlanned),
          quantityDelivered: Number(deliveryItem.quantityDelivered),
          delivery: {
            status: deliveryItem.delivery.status
          }
        }))
      }));

      if (
        !canScheduleOrderDelivery({
          status: order.status,
          paymentStatus: order.paymentStatus,
          balanceAmount: order.balanceAmount,
          paymentDueTiming: order.paymentDueTiming,
          deliveryStatus: order.deliveryStatus,
          items: orderItemsForDeliveryState
        })
      ) {
        throw new ActionError("Order is not eligible for delivery scheduling.");
      }

      try {
        assertDeliveryPlanDoesNotExceedOrdered({
          orderItems: orderItemsForDeliveryState,
          requestedItems: parsed.data.items
        });
      } catch (error) {
        throw new ActionError(error instanceof Error ? error.message : "Delivery quantities are invalid.");
      }

      const deliveryAddressSnapshot = parsed.data.deliveryAddress
        ? {
            addressLine: parsed.data.deliveryAddress
          }
        : (order.deliveryAddressSnapshot ?? undefined);
      assertValidStatusTransition("delivery", "PLANNED", initialDeliveryStatus);

      const deliveryNumber = await generateDeliveryReceiptNumber(tx);
      const scheduledExactTimes = combineScheduledDateAndTime(
        parsed.data.scheduledDate,
        parsed.data.scheduledStartTime
      );
      const defaultPdfDetails = deliveryPdfDetailRows({
        orderNumber: order.orderNumber,
        deliveryNumber,
        scheduledDate: parsed.data.scheduledDate,
        scheduledTimeWindow: parsed.data.scheduledTimeWindow
      });
      const submittedPdfDetails = submittedPdfDetailsOrDefault(
        pdfDetailsInput,
        parsed.data.pdfDetails,
        defaultPdfDetails
      );
      const delivery = await tx.delivery.create({
        data: {
          orderId: order.id,
          deliveryNumber,
          status: initialDeliveryStatus,
          scheduledDate: parsed.data.scheduledDate,
          scheduledStartAt: scheduledExactTimes.scheduledStartAt,
          scheduledEndAt: scheduledExactTimes.scheduledEndAt,
          scheduledStartTime: parsed.data.scheduledStartTime,
          scheduledEndTime: parsed.data.scheduledStartTime ? undefined : parsed.data.scheduledEndTime,
          scheduledTimeWindow: parsed.data.scheduledTimeWindow,
          deliveryProviderType: parsed.data.deliveryProviderType as DeliveryProviderType | undefined,
          deliveryProviderName: parsed.data.deliveryProviderName,
          deliveryProviderReference: parsed.data.deliveryProviderReference,
          deliveryAddressSnapshot: deliveryAddressSnapshot as Prisma.InputJsonValue | undefined,
          recipientName: parsed.data.recipientName,
          recipientPhone: parsed.data.recipientPhone,
          deliveryNotes: parsed.data.deliveryNotes,
          pdfDetails: submittedPdfDetails as Prisma.InputJsonValue,
          internalNotes: parsed.data.internalNotes,
          assignedStaffId: parsed.data.assignedStaffId,
          createdById: actor.id,
          updatedById: actor.id,
          items: {
            create: parsed.data.items.map((item) => ({
              orderItemId: item.orderItemId,
              quantityPlanned: item.quantityPlanned,
              quantityDelivered: 0,
              notes: item.notes
            }))
          }
        }
      });
      createdDeliveryId = delivery.id;

      await updateOrderDeliverySummaryTx(tx, order.id, actor.id);

      await tx.activityLog.create({
        data: {
          action: "DELIVERY_SCHEDULED",
          actorId: actor.id,
          summary: `Scheduled delivery for order ${order.id}.`,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            deliveryNumber: delivery.deliveryNumber,
            entityType: "delivery",
            entityId: delivery.id,
            deliveryId: delivery.id,
            oldStatus: "PLANNED",
            newStatus: initialDeliveryStatus,
            sourceAction: "delivery_creation",
            deliveryProviderType: parsed.data.deliveryProviderType,
            deliveryProviderName: parsed.data.deliveryProviderName,
            deliveryProviderReference: parsed.data.deliveryProviderReference
          }
        }
      });
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return {
        ok: false,
        message: error.message
      };
    }

    throw error;
  }

  if (createdDeliveryId) {
    await syncDeliveryCalendarSafely(createdDeliveryId, createDeliveryCalendarEvent);
  }

  revalidatePath("/orders");
  revalidatePath("/deliveries");

  return {
    ok: true,
    message: "Delivery saved and delivery status updated."
  };
}

export async function updateDeliveryProgressAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("DELIVERIES", "UPDATE");
  const parsed = updateDeliveryProgressSchema.safeParse({
    deliveryId: formData.get("deliveryId"),
    status: formData.get("status"),
    deliveredAt: formData.get("deliveredAt") || undefined,
    markAllDelivered: formData.get("markAllDelivered"),
    notes: formData.get("notes"),
    items: parseJsonArray(formData.get("items"))
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: firstIssue(parsed.error, "Invalid delivery progress.")
    };
  }

  let updatedDeliveryId: string | null = null;
  let deliveryCalendarSyncOperation: ((deliveryId: string) => Promise<DeliveryCalendarSyncResult>) | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({
        where: {
          id: parsed.data.deliveryId
        },
        select: {
          id: true,
          status: true,
          orderId: true,
          deliveredAt: true,
          internalNotes: true,
          order: {
            select: {
              status: true,
              orderNumber: true
            }
          },
          items: {
            select: {
              id: true,
              quantityPlanned: true,
              quantityDelivered: true
            }
          }
        }
      });

      if (!delivery || delivery.order.status === "CANCELLED") {
        throw new ActionError("Delivery is not available for progress updates.");
      }

      const progressUpdate = prepareDeliveryProgressUpdate({
        currentStatus: delivery.status,
        nextStatus: parsed.data.status as DeliveryStatus,
        existingItems: delivery.items.map((item) => ({
          id: item.id,
          quantityPlanned: Number(item.quantityPlanned),
          quantityDelivered: Number(item.quantityDelivered)
        })),
        itemInputs: parsed.data.items,
        markAllDelivered: parsed.data.markAllDelivered
      });
      const nextStatus = progressUpdate.status as DeliveryStatus;
      updatedDeliveryId = delivery.id;
      deliveryCalendarSyncOperation =
        ["CANCELLED", "FAILED", "DELIVERED"].includes(nextStatus)
          ? deleteDeliveryCalendarEvent
          : updateDeliveryCalendarEvent;

      const deliveredAt =
        nextStatus === "DELIVERED"
          ? (parsed.data.deliveredAt ?? delivery.deliveredAt ?? new Date())
          : delivery.deliveredAt;

      await tx.delivery.update({
        where: {
          id: delivery.id
        },
        data: {
          status: nextStatus,
          deliveredAt,
          internalNotes: parsed.data.notes ?? delivery.internalNotes,
          updatedById: actor.id
        }
      });

      await Promise.all(
        progressUpdate.items.map((item) =>
          tx.deliveryItem.update({
            where: {
              id: item.id
            },
            data: {
              quantityDelivered: item.quantityDelivered,
              notes: item.notes
            }
          })
        )
      );

      await updateOrderDeliverySummaryTx(tx, delivery.orderId, actor.id);

      await tx.activityLog.create({
        data: {
          action: "DELIVERY_UPDATED",
          actorId: actor.id,
          summary: `Updated delivery progress for order ${delivery.orderId}.`,
          metadata: {
            entityType: "delivery",
            entityId: delivery.id,
            deliveryId: delivery.id,
            orderId: delivery.orderId,
            orderNumber: delivery.order.orderNumber,
            oldStatus: delivery.status,
            newStatus: nextStatus,
            sourceAction: "delivery_progress_update"
          }
        }
      });
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return {
        ok: false,
        message: error.message
      };
    }

    if (error instanceof Error) {
      return {
        ok: false,
        message: error.message
      };
    }

    throw error;
  }

  if (updatedDeliveryId && deliveryCalendarSyncOperation) {
    await syncDeliveryCalendarSafely(updatedDeliveryId, deliveryCalendarSyncOperation);
  }

  revalidatePath("/orders");
  revalidatePath("/deliveries");

  return {
    ok: true,
    message: "Delivery progress updated."
  };
}

export async function retryDeliveryCalendarSyncAction(formData: FormData) {
  await requirePermission("DELIVERIES", "UPDATE");

  const deliveryId = String(formData.get("deliveryId") ?? "").trim();
  const returnTo = safeReturnPath(formData.get("returnTo"), "/deliveries");
  const redirectUrl = new URL(returnTo, "http://localhost");

  function finish(status: "success" | "error", message: string): never {
    redirectUrl.searchParams.set("calendarSync", status);
    redirectUrl.searchParams.set("message", message);
    redirect(`${redirectUrl.pathname}${redirectUrl.search}`);
  }

  if (!deliveryId) {
    finish("error", "Choose a delivery to retry calendar sync.");
  }

  const delivery = await prisma.delivery.findUnique({
    where: {
      id: deliveryId
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!delivery) {
    finish("error", "Delivery was not found.");
  }

  if (delivery.status === "CANCELLED") {
    finish("error", "Cancelled deliveries cannot retry Google Calendar sync.");
  }

  const result = await updateDeliveryCalendarEvent(delivery.id);
  revalidatePath("/deliveries");
  revalidatePath("/orders");

  const synced = result.targets.filter((t) => t.syncStatus === "SYNCED");
  const failed = result.targets.filter((t) => t.syncStatus === "FAILED");

  if (failed.length > 0) {
    const messages = failed.map((t) => t.error ?? "Sync failed.").join(" ");
    finish("error", messages);
  }

  if (synced.length > 0) {
    finish("success", "Google Calendar sync updated.");
  }

  finish("success", "Calendar sync completed — some targets were skipped.");
}

export async function cancelOrderAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("ORDERS", "UPDATE");
  const parsed = cancelOrderSchema.safeParse({
    orderId: formData.get("orderId"),
    cancellationReason: formData.get("cancellationReason") || undefined
  });

  if (!parsed.success) {
    return { ok: false, message: firstIssue(parsed.error, "Invalid order.") };
  }

  const deliveryIdsForCalendarDelete: string[] = [];
  let orderNumber: string | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: parsed.data.orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          deliveryStatus: true,
          paidAmount: true,
          payments: { select: { id: true, status: true } },
          deliveries: {
            select: {
              id: true,
              status: true,
              googleCalendarEventId: true,
              calendarEvents: { select: { id: true } }
            }
          },
          _count: { select: { documents: true } }
        }
      });

      if (!order) {
        throw new ActionError("Order was not found.");
      }

      orderNumber = order.orderNumber;

      if (order.status === "COMPLETED") {
        throw new ActionError("Completed orders cannot be cancelled.");
      }

      if (order.status === "CANCELLED") {
        throw new ActionError("This order is already cancelled.");
      }

      if (order.deliveryStatus === "DELIVERED" || order.deliveries.some((delivery) => delivery.status === "DELIVERED")) {
        throw new ActionError("Orders with delivered deliveries cannot be cancelled. Handle this order manually.");
      }

      if (order.paymentStatus === "PAID") {
        throw new ActionError("Fully paid orders need manual review before cancellation.");
      }

      const activeDeliveries = order.deliveries.filter(
        (delivery) => !["DELIVERED", "CANCELLED", "FAILED"].includes(delivery.status)
      );
      deliveryIdsForCalendarDelete.push(
        ...activeDeliveries
          .filter((delivery) => delivery.googleCalendarEventId || delivery.calendarEvents.length > 0)
          .map((delivery) => delivery.id)
      );

      if (activeDeliveries.length > 0) {
        await tx.delivery.updateMany({
          where: { id: { in: activeDeliveries.map((delivery) => delivery.id) } },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            updatedById: actor.id
          }
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          deliveryStatus: "CANCELLED",
          cancelledAt: new Date(),
          updatedById: actor.id
        }
      });

      await tx.activityLog.create({
        data: {
          action: "ORDER_UPDATED",
          actorId: actor.id,
          summary: `Cancelled order ${order.orderNumber ?? order.id}.`,
          metadata: {
            entityType: "order",
            entityId: order.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            oldStatus: order.status,
            newStatus: "CANCELLED",
            oldDeliveryStatus: order.deliveryStatus,
            newDeliveryStatus: "CANCELLED",
            cancellationReason: parsed.data.cancellationReason,
            paymentCount: order.payments.length,
            documentCount: order._count.documents,
            sourceAction: "order_cancellation"
          }
        }
      });
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return { ok: false, message: error.message };
    }

    throw error;
  }

  await Promise.all(
    deliveryIdsForCalendarDelete.map((deliveryId) =>
      syncDeliveryCalendarSafely(deliveryId, deleteDeliveryCalendarEvent)
    )
  );

  revalidatePath("/orders");
  revalidatePath("/deliveries");
  revalidatePath("/payments");
  revalidatePath("/documents");

  return {
    ok: true,
    message: `Order cancelled: ${orderNumber ?? parsed.data.orderId}.`
  };
}

export async function deleteOrderAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("ORDERS", "DELETE");
  const parsed = deleteOrderSchema.safeParse({
    orderId: formData.get("orderId")
  });

  if (!parsed.success) {
    return { ok: false, message: firstIssue(parsed.error, "Invalid order.") };
  }

  let orderNumber: string | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: parsed.data.orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          customerDisplayNameSnapshot: true,
          companyNameSnapshot: true,
          contactPersonNameSnapshot: true,
          totalAmount: true,
          _count: { select: { payments: true, deliveries: true, documents: true, items: true } }
        }
      });

      if (!order) {
        throw new ActionError("Order was not found.");
      }

      orderNumber = order.orderNumber;

      if (order.status === "COMPLETED") {
        throw new ActionError("Completed orders cannot be deleted. Cancel or keep the order history instead.");
      }

      if (order._count.payments > 0 || order._count.deliveries > 0 || order._count.documents > 0) {
        throw new ActionError("This order has payments, deliveries, or documents. Cancel it instead to keep history intact.");
      }

      await tx.activityLog.create({
        data: {
          action: "ORDER_UPDATED",
          actorId: actor.id,
          summary: `Deleted order ${order.orderNumber ?? order.id}.`,
          metadata: {
            entityType: "order",
            entityId: order.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            customerSnapshot: {
              displayName: order.customerDisplayNameSnapshot,
              companyName: order.companyNameSnapshot,
              contactPersonName: order.contactPersonNameSnapshot
            },
            totalAmount: Number(order.totalAmount),
            itemCount: order._count.items,
            sourceAction: "order_deletion"
          }
        }
      });

      await tx.order.delete({ where: { id: order.id } });
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return { ok: false, message: error.message };
    }

    throw error;
  }

  revalidatePath("/orders");
  revalidatePath("/deliveries");
  revalidatePath("/payments");
  revalidatePath("/documents");
  revalidatePath("/sales-history");

  return {
    ok: true,
    message: `Order deleted: ${orderNumber ?? parsed.data.orderId}.`
  };
}

export async function completeOrderAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("ORDERS", "UPDATE");
  const parsed = completeOrderSchema.safeParse({
    orderId: formData.get("orderId")
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: firstIssue(parsed.error, "Invalid order.")
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: {
          id: parsed.data.orderId
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          paymentDueTiming: true,
          balanceAmount: true,
          deliveryStatus: true
        }
      });

      if (!order || order.status === "CANCELLED") {
        throw new ActionError("Order is not available for completion.");
      }

      if (order.status === "COMPLETED") {
        return;
      }

      if (
        !canCompleteOrder({
          status: order.status,
          paymentStatus: order.paymentStatus,
          balanceAmount: order.balanceAmount,
          paymentDueTiming: order.paymentDueTiming,
          deliveryStatus: order.deliveryStatus
        })
      ) {
        throw new ActionError("Only fully paid and fully delivered orders can be completed.");
      }

      try {
        assertValidStatusTransition("order", order.status, "COMPLETED");
      } catch (error) {
        throw new ActionError(
          error instanceof Error ? error.message : "Order cannot be completed from its current status."
        );
      }

      await tx.order.update({
        where: {
          id: order.id
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          updatedById: actor.id
        }
      });

      await tx.activityLog.create({
        data: {
          action: "ORDER_UPDATED",
          actorId: actor.id,
          summary: `Completed order ${order.id}.`,
          metadata: {
            entityType: "order",
            entityId: order.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            oldStatus: order.status,
            newStatus: "COMPLETED",
            sourceAction: "order_completion"
          }
        }
      });
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return {
        ok: false,
        message: error.message
      };
    }

    throw error;
  }

  revalidatePath("/orders");

  return {
    ok: true,
    message: "Order marked completed."
  };
}

export async function createOrderDocumentAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("DOCUMENTS", "CREATE");
  const parsed = createOrderDocumentSchema.safeParse({
    orderId: formData.get("orderId"),
    paymentId: formData.get("paymentId"),
    deliveryId: formData.get("deliveryId"),
    documentType: formData.get("documentType"),
    title: formData.get("title"),
    cloudinaryPublicId: formData.get("cloudinaryPublicId"),
    secureUrl: formData.get("secureUrl"),
    resourceType: formData.get("resourceType"),
    format: formData.get("format"),
    bytes: formData.get("bytes") || undefined,
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: firstIssue(parsed.error, "Invalid document details.")
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: {
          id: parsed.data.orderId
        },
        select: {
          id: true,
          quotationId: true
        }
      });

      if (!order) {
        throw new ActionError("Order was not found.");
      }

      const [validatedPayment, validatedDelivery] = await Promise.all([
        parsed.data.paymentId
          ? tx.payment.findFirst({
              where: {
                id: parsed.data.paymentId,
                orderId: order.id
              },
              select: {
                id: true,
                paymentNumber: true
              }
            })
          : Promise.resolve(null),
        parsed.data.deliveryId
          ? tx.delivery.findFirst({
              where: {
                id: parsed.data.deliveryId,
                orderId: order.id
              },
              select: {
                id: true,
                deliveryNumber: true
              }
            })
          : Promise.resolve(null)
      ]);

      if (parsed.data.paymentId && !validatedPayment) {
        throw new ActionError("Related payment was not found for this order.");
      }

      if (parsed.data.deliveryId && !validatedDelivery) {
        throw new ActionError("Related delivery was not found for this order.");
      }

      let documentNumber: string | null = null;

      if (parsed.data.documentType === "PAYMENT_RECEIPT" && parsed.data.paymentId && validatedPayment) {
        documentNumber = validatedPayment.paymentNumber ?? (await generatePaymentNumber(tx));

        if (!validatedPayment.paymentNumber) {
          await tx.payment.update({
            where: {
              id: validatedPayment.id
            },
            data: {
              paymentNumber: documentNumber
            }
          });
        }
      } else if (parsed.data.documentType === "DELIVERY_RECEIPT" && parsed.data.deliveryId && validatedDelivery) {
        documentNumber = validatedDelivery.deliveryNumber ?? (await generateDeliveryReceiptNumber(tx));

        if (!validatedDelivery.deliveryNumber) {
          await tx.delivery.update({
            where: {
              id: validatedDelivery.id
            },
            data: {
              deliveryNumber: documentNumber
            }
          });
        }
      } else if (parsed.data.documentType === "INVOICE") {
        documentNumber = await generateInvoiceNumber(tx);
      } else if (parsed.data.documentType === "FINAL_ORDER_SUMMARY") {
        documentNumber = await generateFinalSummaryNumber(tx);
      }

      const document = await tx.orderDocument.create({
        data: {
          orderId: order.id,
          quotationId: order.quotationId,
          paymentId: parsed.data.paymentId,
          deliveryId: parsed.data.deliveryId,
          documentType: parsed.data.documentType as DocumentType,
          documentNumber,
          title: parsed.data.title,
          cloudinaryPublicId: parsed.data.cloudinaryPublicId,
          secureUrl: parsed.data.secureUrl,
          resourceType: parsed.data.resourceType,
          format: parsed.data.format,
          bytes: parsed.data.bytes,
          generatedAt: new Date(),
          generatedById: actor.id,
          notes: parsed.data.notes
        }
      });

      if (document.documentType === "PAYMENT_RECEIPT" && document.paymentId) {
        await tx.payment.update({
          where: {
            id: document.paymentId
          },
          data: {
            receiptGenerated: true,
            updatedById: actor.id
          }
        });
      }

      await tx.activityLog.create({
        data: {
          action: "DOCUMENT_CREATED",
          actorId: actor.id,
          summary: `Created document record for order ${order.id}.`,
          metadata: {
            orderId: order.id,
            documentType: parsed.data.documentType,
            paymentId: parsed.data.paymentId,
            deliveryId: parsed.data.deliveryId
          }
        }
      });
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return {
        ok: false,
        message: error.message
      };
    }

    throw error;
  }

  revalidatePath("/orders");
  revalidatePath("/documents");

  return {
    ok: true,
    message: "Document record saved."
  };
}
