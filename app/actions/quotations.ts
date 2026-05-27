"use server";

import { revalidatePath } from "next/cache";
import type { DiscountType, QuotationItemType, QuotationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/server";
import { convertAcceptedQuotationToOrderTx } from "@/app/actions/orders";
import { generateQuotationNumber } from "@/lib/numbering";
import { calculateQuotationItem, calculateQuotationTotals } from "@/lib/quotations/calculations";
import { assertValidStatusTransition } from "@/lib/status-transitions";
import { createQuotationSchema, type CreateQuotationInput } from "@/lib/validation/quotations";

type ActionState = {
  ok: boolean;
  message: string;
  quotationId?: string;
  status?: QuotationStatus;
  deleted?: boolean;
  intent?: string;
};

function parseItems(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function friendlyValidationMessage(message: string | undefined, fallback: string) {
  if (!message) {
    return fallback;
  }

  if (message.includes("Expected string") || message.includes("received null")) {
    return "Some optional details were blank. Please check the required fields and try again.";
  }

  if (message === "Choose a customer.") {
    return "Select or enter a customer name.";
  }

  if (message === "Add at least one quotation item.") {
    return "Add at least one item to continue.";
  }

  return message;
}

function parseQuotationInput(formData: FormData) {
  return createQuotationSchema.safeParse({
    customerId: formData.get("customerId"),
    inquiryId: formData.get("inquiryId"),
    quotationDiscountType: formData.get("quotationDiscountType") || undefined,
    quotationDiscountValue: formData.get("quotationDiscountValue") || undefined,
    needsAssembly: formData.get("needsAssembly"),
    assemblyFeeRate: formData.get("assemblyFeeRate") || undefined,
    salesInvoiceRequested: formData.get("salesInvoiceRequested"),
    salesInvoiceFeePercentage: formData.get("salesInvoiceFeePercentage") || undefined,
    additionalFees: formData.get("additionalFees") || undefined,
    modeOfDelivery: formData.get("modeOfDelivery"),
    deliveryMethod: formData.get("deliveryMethod"),
    paymentTerms: formData.get("paymentTerms"),
    specialInstructions: formData.get("specialInstructions"),
    customerNotes: formData.get("customerNotes"),
    internalNotes: formData.get("internalNotes"),
    items: parseItems(formData.get("items"))
  });
}

async function validateQuotationReferences(input: CreateQuotationInput) {
  const [customer, inquiry] = await Promise.all([
    prisma.customer.findFirst({
      where: {
        id: input.customerId,
        archivedAt: null
      },
      select: {
        id: true,
        displayName: true
      }
    }),
    input.inquiryId
      ? prisma.inquiry.findFirst({
          where: {
            id: input.inquiryId,
            customerId: input.customerId
          },
          select: {
            id: true
          }
        })
      : Promise.resolve(null)
  ]);

  if (!customer) {
    return {
      ok: false as const,
      message: "Customer was not found."
    };
  }

  if (input.inquiryId && !inquiry) {
    return {
      ok: false as const,
      message: "Inquiry was not found for the selected customer."
    };
  }

  const productIds = input.items
    .filter((item) => item.itemType === "CATALOG_PRODUCT")
    .map((item) => item.productId)
    .filter((productId): productId is string => Boolean(productId));

  if (productIds.length) {
    const activeProducts = await prisma.product.findMany({
      where: {
        id: {
          in: productIds
        },
        status: "ACTIVE"
      },
      select: {
        id: true
      }
    });
    const activeProductIds = new Set(activeProducts.map((product) => product.id));
    const missingProduct = productIds.find((productId) => !activeProductIds.has(productId));

    if (missingProduct) {
      return {
        ok: false as const,
        message: "One selected catalog product is inactive or no longer available."
      };
    }
  }

  return {
    ok: true as const,
    customer,
    inquiry
  };
}

function quotationItemCreateData(item: CreateQuotationInput["items"][number], index: number) {
  const calculatedItem = calculateQuotationItem(item);

  return {
    productId: item.productId,
    itemType: item.itemType as QuotationItemType,
    sortOrder: item.sortOrder ?? index,
    snapshotProductCode: item.snapshotProductCode,
    snapshotVariantId: item.snapshotVariantId,
    snapshotVariantName: item.snapshotVariantName,
    snapshotVariantHex: item.snapshotVariantHex,
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
    requiresAssembly: item.requiresAssembly,
    customerNotes: item.customerNotes,
    internalNotes: item.internalNotes,
    images: item.images.length
      ? {
          create: item.images.map((image, imageIndex) => ({
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
}

export async function createQuotationAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("QUOTATIONS", "CREATE");
  const intent = String(formData.get("intent") ?? "save_draft");
  if (intent === "save_mark_sent" && !hasPermission(actor, "QUOTATIONS", "UPDATE")) {
    return {
      ok: false,
      message: "You don't have permission to mark quotations as sent."
    };
  }
  const parsed = parseQuotationInput(formData);

  if (!parsed.success) {
    return {
      ok: false,
      message: friendlyValidationMessage(
        parsed.error.issues[0]?.message,
        "Invalid quotation details."
      )
    };
  }

  const references = await validateQuotationReferences(parsed.data);

  if (!references.ok) {
    return references;
  }

  let totals;

  try {
    totals = calculateQuotationTotals(parsed.data);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Quotation totals are invalid."
    };
  }

  const quotation = await prisma.$transaction(async (tx) => {
    const quotationNumber = await generateQuotationNumber(tx);
    const nextStatus = intent === "save_mark_sent" ? "SENT" : "DRAFT";
    const created = await tx.quotation.create({
      data: {
        quotationNumber,
        customerId: parsed.data.customerId,
        inquiryId: parsed.data.inquiryId,
        status: nextStatus,
        currency: "PHP",
        subtotalAmount: totals.subtotalAmount,
        itemDiscountTotal: totals.itemDiscountTotal,
        quotationDiscountType: parsed.data.quotationDiscountType as DiscountType | undefined,
        quotationDiscountValue: parsed.data.quotationDiscountValue,
        quotationDiscountAmount: totals.quotationDiscountAmount,
        assemblyFeeTotal: totals.assemblyFeeTotal,
        salesInvoiceFeeTotal: totals.salesInvoiceFeeTotal,
        totalAmount: totals.totalAmount,
        needsAssembly: parsed.data.needsAssembly,
        salesInvoiceRequested: parsed.data.salesInvoiceRequested,
        modeOfDelivery: parsed.data.modeOfDelivery,
        deliveryMethod: parsed.data.deliveryMethod,
        paymentTerms: parsed.data.paymentTerms,
        specialInstructions: parsed.data.specialInstructions,
        customerNotes: parsed.data.customerNotes,
        internalNotes: parsed.data.internalNotes,
        createdById: actor.id,
        updatedById: actor.id,
        items: {
          create: parsed.data.items.map(quotationItemCreateData)
        }
      }
    });

    const sideEffects: Promise<unknown>[] = [
      tx.activityLog.create({
        data: {
          action: "QUOTATION_CREATED",
          actorId: actor.id,
          summary: `Created ${nextStatus.toLowerCase()} quotation for ${references.customer.displayName}.`,
          metadata: {
            quotationId: created.id,
            quotationNumber: created.quotationNumber,
            customerId: references.customer.id,
            inquiryId: parsed.data.inquiryId ?? "",
            totalAmount: totals.totalAmount,
            assemblyFeeTotal: totals.assemblyFeeTotal,
            salesInvoiceFeeTotal: totals.salesInvoiceFeeTotal,
            needsAssembly: parsed.data.needsAssembly,
            salesInvoiceRequested: parsed.data.salesInvoiceRequested,
            modeOfDelivery: parsed.data.modeOfDelivery,
            deliveryMethod: parsed.data.deliveryMethod,
            paymentTerms: parsed.data.paymentTerms
          }
        }
      })
    ];

    if (parsed.data.inquiryId) {
      sideEffects.push(
        tx.inquiry.update({
          where: {
            id: parsed.data.inquiryId
          },
          data: {
            status: "QUOTED"
          }
        })
      );
    }

    await Promise.all(sideEffects);

    return created;
  });

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${quotation.id}`);
  revalidatePath("/inquiries");

  return {
    ok: true,
    quotationId: quotation.id,
    intent,
    message: `Quotation saved for ${references.customer.displayName}: ${quotation.quotationNumber ?? quotation.id}. PHP ${Number(quotation.totalAmount).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}.`
  };
}

export async function updateDraftQuotationAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("QUOTATIONS", "UPDATE");
  const quotationId = String(formData.get("quotationId") ?? "");
  const intent = String(formData.get("intent") ?? "save_draft");
  const parsed = parseQuotationInput(formData);

  if (!quotationId) {
    return {
      ok: false,
      message: "Quotation was not found."
    };
  }

  if (!parsed.success) {
    return {
      ok: false,
      message: friendlyValidationMessage(
        parsed.error.issues[0]?.message,
        "Invalid quotation details."
      )
    };
  }

  const [existing, references] = await Promise.all([
    prisma.quotation.findUnique({
      where: {
        id: quotationId
      },
      select: {
        id: true,
        status: true,
        quotationNumber: true
      }
    }),
    validateQuotationReferences(parsed.data)
  ]);

  if (!existing) {
    return {
      ok: false,
      message: "Quotation was not found."
    };
  }

  if (!["DRAFT", "SENT"].includes(existing.status)) {
    return {
      ok: false,
      message: "Only draft or sent quotations can be edited."
    };
  }

  if (!references.ok) {
    return references;
  }

  let totals;

  try {
    totals = calculateQuotationTotals(parsed.data);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Quotation totals are invalid."
    };
  }

  const nextStatus = intent === "save_mark_sent" ? "SENT" : existing.status;

  try {
    assertValidStatusTransition("quotation", existing.status, nextStatus);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid quotation status transition."
    };
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all([
      tx.quotation.update({
        where: {
          id: existing.id
        },
        data: {
          customerId: parsed.data.customerId,
          inquiryId: parsed.data.inquiryId,
          status: nextStatus,
          subtotalAmount: totals.subtotalAmount,
          itemDiscountTotal: totals.itemDiscountTotal,
          quotationDiscountType: parsed.data.quotationDiscountType as DiscountType | undefined,
          quotationDiscountValue: parsed.data.quotationDiscountValue,
          quotationDiscountAmount: totals.quotationDiscountAmount,
          assemblyFeeTotal: totals.assemblyFeeTotal,
          salesInvoiceFeeTotal: totals.salesInvoiceFeeTotal,
          totalAmount: totals.totalAmount,
          needsAssembly: parsed.data.needsAssembly,
          salesInvoiceRequested: parsed.data.salesInvoiceRequested,
          modeOfDelivery: parsed.data.modeOfDelivery,
          deliveryMethod: parsed.data.deliveryMethod,
          paymentTerms: parsed.data.paymentTerms,
          specialInstructions: parsed.data.specialInstructions,
          customerNotes: parsed.data.customerNotes,
          internalNotes: parsed.data.internalNotes,
          updatedById: actor.id,
          items: {
            deleteMany: {},
            create: parsed.data.items.map(quotationItemCreateData)
          }
        }
      }),
      tx.activityLog.create({
        data: {
          action: "QUOTATION_UPDATED",
          actorId: actor.id,
          summary: `Updated quotation for ${references.customer.displayName}.`,
          metadata: {
            entityType: "quotation",
            entityId: existing.id,
            quotationId: existing.id,
            quotationNumber: existing.quotationNumber,
            customerId: references.customer.id,
            oldStatus: existing.status,
            newStatus: nextStatus,
            totalAmount: totals.totalAmount,
            assemblyFeeTotal: totals.assemblyFeeTotal,
            salesInvoiceFeeTotal: totals.salesInvoiceFeeTotal,
            sourceAction: "quotation_update"
          }
        }
      })
    ]);
  });

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${quotationId}`);

  return {
    ok: true,
    quotationId,
    intent,
    message: `Quotation updated: ${existing.quotationNumber ?? existing.id}.`
  };
}

export async function updateQuotationStatusAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const quotationId = String(formData.get("quotationId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!quotationId || !["DRAFT", "SENT", "ACCEPTED", "DECLINED", "CANCELLED"].includes(status)) {
    return {
      ok: false,
      message: "Invalid quotation status update."
    };
  }

  const nextStatus = status as QuotationStatus;
  const actor = await requirePermission(
    "QUOTATIONS",
    nextStatus === "ACCEPTED" || nextStatus === "DECLINED" ? "APPROVE" : "UPDATE"
  );

  if (nextStatus === "ACCEPTED" && !hasPermission(actor, "ORDERS", "CREATE")) {
    return {
      ok: false,
      quotationId,
      message: "Accepting a quotation creates an order. Ask an admin to grant order creation access or convert it from Orders."
    };
  }

  const quotation = await prisma.quotation.findUnique({
    where: {
      id: quotationId
    },
    select: {
      id: true,
      status: true,
      quotationNumber: true,
      customer: {
        select: {
          displayName: true
        }
      },
      _count: {
        select: {
          items: true
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

  if (status === "ACCEPTED" && quotation._count.items === 0) {
    return {
      ok: false,
      message: "Quotation needs at least one item before approval."
    };
  }

  try {
    assertValidStatusTransition("quotation", quotation.status, nextStatus);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid quotation status transition."
    };
  }

  let successMessage = `Quotation marked ${status}.`;

  try {
    await prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.quotation.update({
          where: {
            id: quotation.id
          },
          data: {
            status: nextStatus,
            updatedById: actor.id
          }
        }),
        tx.activityLog.create({
          data: {
            action: "QUOTATION_UPDATED",
            actorId: actor.id,
            summary: `Updated quotation status for ${quotation.customer.displayName} to ${status}.`,
            metadata: {
              entityType: "quotation",
              entityId: quotation.id,
              quotationId: quotation.id,
              oldStatus: quotation.status,
              newStatus: nextStatus,
              reason: String(formData.get("reason") ?? formData.get("note") ?? ""),
              sourceAction: "quotation_status_update"
            }
          }
        })
      ]);

      if (nextStatus === "ACCEPTED") {
        await convertAcceptedQuotationToOrderTx(tx, quotation.id, actor.id);
        successMessage = "Quotation accepted and converted to an order.";
      }
    });
  } catch (error) {
    return {
      ok: false,
      quotationId: quotation.id,
      message: error instanceof Error ? error.message : "Quotation status update failed."
    };
  }

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${quotation.id}`);
  revalidatePath("/orders");

  return {
    ok: true,
    quotationId: quotation.id,
    status: nextStatus,
    message: successMessage
  };
}

export async function deleteQuotationAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("QUOTATIONS", "DELETE");
  const quotationId = String(formData.get("quotationId") ?? "");

  if (!quotationId) {
    return {
      ok: false,
      message: "Quotation was not found."
    };
  }

  const quotation = await prisma.quotation.findUnique({
    where: {
      id: quotationId
    },
    select: {
      id: true,
      status: true,
      quotationNumber: true,
      order: {
        select: {
          id: true
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
    return {
      ok: false,
      quotationId,
      message: "Converted quotations cannot be deleted."
    };
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all([
      tx.quotation.delete({
        where: {
          id: quotation.id
        }
      }),
      tx.activityLog.create({
        data: {
          action: "QUOTATION_UPDATED",
          actorId: actor.id,
          summary: `Deleted quotation for ${quotation.customer.displayName}.`,
          metadata: {
            entityType: "quotation",
            entityId: quotation.id,
            quotationId: quotation.id,
            quotationNumber: quotation.quotationNumber,
            oldStatus: quotation.status,
            sourceAction: "quotation_delete"
          }
        }
      })
    ]);
  });

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${quotation.id}`);

  return {
    ok: true,
    quotationId,
    deleted: true,
    message: "Quotation deleted."
  };
}
