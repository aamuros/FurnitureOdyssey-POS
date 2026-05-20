"use server";

import { revalidatePath } from "next/cache";
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
  convertQuotationToOrderSchema,
  createDeliverySchema,
  createManualOrderSchema,
  createOrderDocumentSchema,
  createPaymentSchema,
  updateDeliveryProgressSchema,
  updatePaymentDueTimingSchema,
  type OrderItemInput
} from "@/lib/validation/orders";

type ActionState = {
  ok: boolean;
  message: string;
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
  revalidatePath("/inquiries");

  return {
    ok: true,
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

  const catalogProductIds = parsed.data.items
    .filter((item) => item.itemType === "CATALOG_PRODUCT" && item.productId)
    .map((item) => item.productId as string);
  const productCosts = catalogProductIds.length
    ? await prisma.product.findMany({
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
    : [];
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

      if (!order || order.status === "CANCELLED") {
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
  const initialDeliveryStatus: DeliveryStatus = "SCHEDULED";
  const parsed = createDeliverySchema.safeParse({
    orderId: formData.get("orderId"),
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

      try {
        assertDeliveryPlanDoesNotExceedOrdered({
          orderItems: order.items.map((item) => ({
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
          })),
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
      const delivery = await tx.delivery.create({
        data: {
          orderId: order.id,
          deliveryNumber,
          status: initialDeliveryStatus,
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
              quantityDelivered: 0,
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

  try {
    await prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({
        where: {
          id: parsed.data.deliveryId
        },
        include: {
          order: true,
          items: true
        }
      });

      if (!delivery || delivery.order.status === "CANCELLED") {
        throw new ActionError("Delivery is not available for progress updates.");
      }

      const nextItems = prepareDeliveryProgressUpdate({
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

      const deliveredAt =
        parsed.data.status === "DELIVERED"
          ? (parsed.data.deliveredAt ?? delivery.deliveredAt ?? new Date())
          : delivery.deliveredAt;

      await tx.delivery.update({
        where: {
          id: delivery.id
        },
        data: {
          status: parsed.data.status as DeliveryStatus,
          deliveredAt,
          internalNotes: parsed.data.notes ?? delivery.internalNotes,
          updatedById: actor.id
        }
      });

      for (const item of nextItems) {
        await tx.deliveryItem.update({
          where: {
            id: item.id
          },
          data: {
            quantityDelivered: item.quantityDelivered,
            notes: item.notes
          }
        });
      }

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
            newStatus: parsed.data.status,
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

  revalidatePath("/orders");
  revalidatePath("/deliveries");

  return {
    ok: true,
    message: "Delivery progress updated."
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

      let documentNumber: string | null = null;

      if (parsed.data.documentType === "PAYMENT_RECEIPT" && parsed.data.paymentId) {
        const payment = await tx.payment.findUnique({
          where: {
            id: parsed.data.paymentId
          },
          select: {
            id: true,
            paymentNumber: true
          }
        });

        documentNumber = payment?.paymentNumber ?? (await generatePaymentNumber(tx));

        if (payment && !payment.paymentNumber) {
          await tx.payment.update({
            where: {
              id: payment.id
            },
            data: {
              paymentNumber: documentNumber
            }
          });
        }
      } else if (parsed.data.documentType === "DELIVERY_RECEIPT" && parsed.data.deliveryId) {
        const delivery = await tx.delivery.findUnique({
          where: {
            id: parsed.data.deliveryId
          },
          select: {
            id: true,
            deliveryNumber: true
          }
        });

        documentNumber = delivery?.deliveryNumber ?? (await generateDeliveryReceiptNumber(tx));

        if (delivery && !delivery.deliveryNumber) {
          await tx.delivery.update({
            where: {
              id: delivery.id
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
