"use server";

import { revalidatePath } from "next/cache";
import type {
  DeliveryProviderType,
  DeliveryStatus,
  DiscountType,
  DocumentType,
  Prisma,
  QuotationItemType
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import {
  calculateOrderItem,
  calculateOrderTotals,
  orderStatusFromProgress,
  paymentStatus
} from "@/lib/orders/calculations";
import {
  convertQuotationToOrderSchema,
  createDeliverySchema,
  createManualOrderSchema,
  createOrderDocumentSchema,
  createPaymentSchema,
  updatePaymentDueTimingSchema,
  type OrderItemInput
} from "@/lib/validation/orders";

type ActionState = {
  ok: boolean;
  message: string;
};

type OrderTx = Prisma.TransactionClient;

class ActionError extends Error {}

function parseJsonArray(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function firstIssue(error: { issues: Array<{ message: string }> }, fallback: string) {
  return error.issues[0]?.message ?? fallback;
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
    include: {
      payments: {
        where: {
          status: "RECORDED"
        },
        orderBy: {
          paymentDate: "desc"
        }
      }
    }
  });

  if (!order) {
    throw new Error("Order was not found.");
  }

  const paidAmount = order.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balanceAmount = Math.max(Number(order.totalAmount) - paidAmount, 0);
  const nextPaymentStatus = paymentStatus({
    totalAmount: Number(order.totalAmount),
    paidAmount,
    hasDownpayment: order.payments.some((payment) => payment.paymentType === "DOWNPAYMENT"),
    paymentDueTiming: order.paymentDueTiming
  });
  const lastPaymentAt = order.payments[0]?.paymentDate ?? null;
  const nextOrderStatus = orderStatusFromProgress({
    currentStatus: order.status,
    paymentStatus: nextPaymentStatus,
    deliveryStatus: order.deliveryStatus
  });

  await tx.order.update({
    where: {
      id: order.id
    },
    data: {
      paidAmount,
      balanceAmount,
      lastPaymentAt,
      paymentStatus: nextPaymentStatus,
      status: nextOrderStatus,
      updatedById: actorId
    }
  });
}

async function updateOrderDeliverySummaryTx(tx: OrderTx, orderId: string, actorId: string) {
  const order = await tx.order.findUnique({
    where: {
      id: orderId
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
            }
          }
        }
      },
      deliveries: {
        where: {
          status: {
            notIn: ["CANCELLED", "FAILED"]
          }
        }
      }
    }
  });

  if (!order) {
    throw new Error("Order was not found.");
  }

  const totalQuantity = order.items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const deliveredQuantity = order.items.reduce(
    (sum, item) =>
      sum +
      item.deliveryItems.reduce(
        (itemSum, deliveryItem) => itemSum + Number(deliveryItem.quantityDelivered),
        0
      ),
    0
  );

  const nextDeliveryStatus =
    deliveredQuantity > 0 && deliveredQuantity >= totalQuantity
      ? "DELIVERED"
      : deliveredQuantity > 0
        ? "PARTIALLY_DELIVERED"
        : order.deliveries.length > 0
          ? "SCHEDULED"
          : "NOT_SCHEDULED";
  const nextOrderStatus = orderStatusFromProgress({
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

  if (!quotation) {
    return {
      ok: false,
      message: "Quotation was not found."
    };
  }

  if (quotation.order) {
    return {
      ok: true,
      message: "This quotation already has a converted order."
    };
  }

  if (quotation.status !== "ACCEPTED") {
    return {
      ok: false,
      message: "Only approved quotations can be converted to orders."
    };
  }

  if (quotation.items.length === 0) {
    return {
      ok: false,
      message: "Quotation needs at least one item before conversion."
    };
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
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
        totalAmount: quotation.totalAmount,
        paidAmount: 0,
        balanceAmount: quotation.totalAmount,
        customerNotes: quotation.customerNotes,
        internalNotes: quotation.internalNotes,
        sourceType: "QUOTATION",
        confirmedAt: new Date(),
        createdById: actor.id,
        updatedById: actor.id,
        items: {
          create: quotation.items.map((item) => ({
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
          actorId: actor.id,
          summary: `Converted quotation for ${quotation.customer.displayName} to an order.`,
          metadata: {
            quotationId: quotation.id,
            orderId: created.id,
            customerId: quotation.customerId
          }
        },
        {
          action: "ORDER_CREATED",
          actorId: actor.id,
          summary: `Created order for ${quotation.customer.displayName}.`,
          metadata: {
            orderId: created.id,
            quotationId: quotation.id,
            totalAmount: Number(quotation.totalAmount)
          }
        }
      ]
    });

    return created;
  });

  revalidatePath("/orders");
  revalidatePath("/quotations");
  revalidatePath("/inquiries");

  return {
    ok: true,
    message: `Order created from approved quotation for ${quotation.customer.displayName}: ${order.id}.`
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

  const customer = await prisma.customer.findFirst({
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
  });

  if (!customer) {
    return {
      ok: false,
      message: "Customer was not found."
    };
  }

  let totals;

  try {
    totals = calculateOrderTotals(parsed.data);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Order totals are invalid."
    };
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        customerId: customer.id,
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
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
        paidAmount: 0,
        balanceAmount: totals.totalAmount,
        customerNotes: parsed.data.customerNotes,
        internalNotes: parsed.data.internalNotes,
        sourceType: "MANUAL",
        confirmedAt: new Date(),
        createdById: actor.id,
        updatedById: actor.id,
        items: {
          create: parsed.data.items.map((item, index) => {
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
          customerId: customer.id,
          totalAmount: totals.totalAmount
        }
      }
    });

    return created;
  });

  revalidatePath("/orders");

  return {
    ok: true,
    message: `Manual order saved for ${customer.displayName}: ${order.id}.`
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

      if (!order || order.status === "CANCELLED") {
        throw new ActionError("Order is not available for payment.");
      }

      const currentPaidAmount = order.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0
      );
      const remainingBalance = Math.max(Number(order.totalAmount) - currentPaidAmount, 0);

      if (parsed.data.amount > remainingBalance) {
        throw new ActionError("Payment amount exceeds the remaining balance.");
      }

      await tx.payment.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
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

  if (!order || order.status === "CANCELLED") {
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
  const parsed = createDeliverySchema.safeParse({
    orderId: formData.get("orderId"),
    status: formData.get("status") || "SCHEDULED",
    scheduledDate: formData.get("scheduledDate") || undefined,
    scheduledTimeWindow: formData.get("scheduledTimeWindow"),
    deliveryProviderType: formData.get("deliveryProviderType") || undefined,
    deliveryProviderName: formData.get("deliveryProviderName"),
    deliveryProviderReference: formData.get("deliveryProviderReference"),
    recipientName: formData.get("recipientName"),
    recipientPhone: formData.get("recipientPhone"),
    deliveryAddress: formData.get("deliveryAddress"),
    deliveryNotes: formData.get("deliveryNotes"),
    internalNotes: formData.get("internalNotes"),
    items: parseJsonArray(formData.get("items"))
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: firstIssue(parsed.error, "Invalid delivery details.")
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
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
                }
              }
            }
          }
        }
      });

      if (!order || order.status === "CANCELLED") {
        throw new ActionError("Order is not available for delivery scheduling.");
      }

      const orderItemsById = new Map(order.items.map((item) => [item.id, item]));

      for (const item of parsed.data.items) {
        const orderItem = orderItemsById.get(item.orderItemId);

        if (!orderItem) {
          throw new ActionError("Delivery item does not belong to this order.");
        }

        const plannedQuantity = orderItem.deliveryItems.reduce(
          (sum, deliveryItem) => sum + Number(deliveryItem.quantityPlanned),
          0
        );

        if (plannedQuantity + item.quantityPlanned > Number(orderItem.quantity)) {
          throw new ActionError(`Delivery quantity exceeds remaining quantity for ${orderItem.itemName}.`);
        }
      }

      const deliveryAddressSnapshot = parsed.data.deliveryAddress
        ? {
            addressLine: parsed.data.deliveryAddress
          }
        : (order.deliveryAddressSnapshot ?? undefined);

      await tx.delivery.create({
        data: {
          orderId: order.id,
          status: parsed.data.status as DeliveryStatus,
          scheduledDate: parsed.data.scheduledDate,
          scheduledTimeWindow: parsed.data.scheduledTimeWindow,
          deliveryProviderType: parsed.data.deliveryProviderType as DeliveryProviderType | undefined,
          deliveryProviderName: parsed.data.deliveryProviderName,
          deliveryProviderReference: parsed.data.deliveryProviderReference,
          deliveryAddressSnapshot: deliveryAddressSnapshot as Prisma.InputJsonValue | undefined,
          recipientName: parsed.data.recipientName,
          recipientPhone: parsed.data.recipientPhone,
          deliveryNotes: parsed.data.deliveryNotes,
          internalNotes: parsed.data.internalNotes,
          createdById: actor.id,
          updatedById: actor.id,
          items: {
            create: parsed.data.items.map((item) => ({
              orderItemId: item.orderItemId,
              quantityPlanned: item.quantityPlanned,
              quantityDelivered:
                parsed.data.status === "DELIVERED"
                  ? item.quantityDelivered || item.quantityPlanned
                  : item.quantityDelivered,
              notes: item.notes
            }))
          }
        }
      });

      await updateOrderDeliverySummaryTx(tx, order.id, actor.id);

      await tx.activityLog.create({
        data: {
          action: "DELIVERY_SCHEDULED",
          actorId: actor.id,
          summary: `Scheduled delivery for order ${order.id}.`,
          metadata: {
            orderId: order.id,
            status: parsed.data.status,
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

  revalidatePath("/orders");
  revalidatePath("/deliveries");

  return {
    ok: true,
    message: "Delivery saved and delivery status updated."
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

      if (parsed.data.paymentId) {
        const payment = await tx.payment.findFirst({
          where: {
            id: parsed.data.paymentId,
            orderId: order.id
          },
          select: {
            id: true
          }
        });

        if (!payment) {
          throw new ActionError("Related payment was not found for this order.");
        }
      }

      if (parsed.data.deliveryId) {
        const delivery = await tx.delivery.findFirst({
          where: {
            id: parsed.data.deliveryId,
            orderId: order.id
          },
          select: {
            id: true
          }
        });

        if (!delivery) {
          throw new ActionError("Related delivery was not found for this order.");
        }
      }

      const document = await tx.orderDocument.create({
        data: {
          orderId: order.id,
          quotationId: order.quotationId,
          paymentId: parsed.data.paymentId,
          deliveryId: parsed.data.deliveryId,
          documentType: parsed.data.documentType as DocumentType,
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
