"use server";

import { revalidatePath } from "next/cache";
import type { DiscountType, QuotationItemType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { calculateQuotationItem, calculateQuotationTotals } from "@/lib/quotations/calculations";
import { createQuotationSchema } from "@/lib/validation/quotations";

type ActionState = {
  ok: boolean;
  message: string;
};

function parseItems(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function createQuotationAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("QUOTATIONS", "CREATE");
  const parsed = createQuotationSchema.safeParse({
    customerId: formData.get("customerId"),
    inquiryId: formData.get("inquiryId"),
    quotationDiscountType: formData.get("quotationDiscountType") || undefined,
    quotationDiscountValue: formData.get("quotationDiscountValue") || undefined,
    needsAssembly: formData.get("needsAssembly"),
    salesInvoiceRequested: formData.get("salesInvoiceRequested"),
    modeOfDelivery: formData.get("modeOfDelivery"),
    deliveryMethod: formData.get("deliveryMethod"),
    paymentTerms: formData.get("paymentTerms"),
    specialInstructions: formData.get("specialInstructions"),
    customerNotes: formData.get("customerNotes"),
    internalNotes: formData.get("internalNotes"),
    items: parseItems(formData.get("items"))
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid quotation details."
    };
  }

  const [customer, inquiry] = await Promise.all([
    prisma.customer.findFirst({
      where: {
        id: parsed.data.customerId,
        archivedAt: null
      },
      select: {
        id: true,
        displayName: true
      }
    }),
    parsed.data.inquiryId
      ? prisma.inquiry.findFirst({
          where: {
            id: parsed.data.inquiryId,
            customerId: parsed.data.customerId
          },
          select: {
            id: true
          }
        })
      : Promise.resolve(null)
  ]);

  if (!customer) {
    return {
      ok: false,
      message: "Customer was not found."
    };
  }

  if (parsed.data.inquiryId && !inquiry) {
    return {
      ok: false,
      message: "Inquiry was not found for the selected customer."
    };
  }

  const productIds = parsed.data.items
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
        ok: false,
        message: "One selected catalog product is inactive or no longer available."
      };
    }
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
    const created = await tx.quotation.create({
      data: {
        customerId: parsed.data.customerId,
        inquiryId: parsed.data.inquiryId,
        status: "DRAFT",
        currency: "PHP",
        subtotalAmount: totals.subtotalAmount,
        itemDiscountTotal: totals.itemDiscountTotal,
        quotationDiscountType: parsed.data.quotationDiscountType as DiscountType | undefined,
        quotationDiscountValue: parsed.data.quotationDiscountValue,
        quotationDiscountAmount: totals.quotationDiscountAmount,
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
          create: parsed.data.items.map((item, index) => {
            const calculatedItem = calculateQuotationItem(item);

            return {
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
          })
        }
      }
    });

    if (parsed.data.inquiryId) {
      await tx.inquiry.update({
        where: {
          id: parsed.data.inquiryId
        },
        data: {
          status: "QUOTED"
        }
      });
    }

    await tx.activityLog.create({
      data: {
        action: "QUOTATION_CREATED",
        actorId: actor.id,
        summary: `Created draft quotation for ${customer.displayName}.`,
        metadata: {
          quotationId: created.id,
          customerId: customer.id,
          inquiryId: parsed.data.inquiryId ?? "",
          totalAmount: totals.totalAmount,
          needsAssembly: parsed.data.needsAssembly,
          salesInvoiceRequested: parsed.data.salesInvoiceRequested,
          modeOfDelivery: parsed.data.modeOfDelivery,
          deliveryMethod: parsed.data.deliveryMethod,
          paymentTerms: parsed.data.paymentTerms
        }
      }
    });

    return created;
  });

  revalidatePath("/quotations");
  revalidatePath("/inquiries");

  return {
    ok: true,
    message: `Draft quotation saved for ${customer.displayName}: PHP ${Number(quotation.totalAmount).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}.`
  };
}

export async function updateQuotationStatusAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("QUOTATIONS", "APPROVE");
  const quotationId = String(formData.get("quotationId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!quotationId || !["ACCEPTED", "DECLINED", "CANCELLED", "SENT"].includes(status)) {
    return {
      ok: false,
      message: "Invalid quotation status update."
    };
  }

  const quotation = await prisma.quotation.findUnique({
    where: {
      id: quotationId
    },
    include: {
      customer: {
        select: {
          displayName: true
        }
      },
      items: {
        select: {
          id: true
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

  if (status === "ACCEPTED" && quotation.items.length === 0) {
    return {
      ok: false,
      message: "Quotation needs at least one item before approval."
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({
      where: {
        id: quotation.id
      },
      data: {
        status: status as "ACCEPTED" | "DECLINED" | "CANCELLED" | "SENT",
        updatedById: actor.id
      }
    });

    await tx.activityLog.create({
      data: {
        action: "QUOTATION_UPDATED",
        actorId: actor.id,
        summary: `Updated quotation status for ${quotation.customer.displayName} to ${status}.`,
        metadata: {
          quotationId: quotation.id,
          status
        }
      }
    });
  });

  revalidatePath("/quotations");
  revalidatePath("/orders");

  return {
    ok: true,
    message: `Quotation marked ${status}.`
  };
}
