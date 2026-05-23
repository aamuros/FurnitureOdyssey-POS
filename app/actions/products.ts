"use server";

import { Prisma } from "@prisma/client";
import type { ProductStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { uploadFileToCloudinary } from "@/lib/uploads/server";
import {
  createProductSchema,
  updateProductSchema,
  type ProductImageInput
} from "@/lib/validation/products";

type ActionState = {
  ok: boolean;
  message: string;
};

function parseImages(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function imageCreateData(images: ProductImageInput[]) {
  return images.map((image, index) => ({
    cloudinaryPublicId: image.cloudinaryPublicId,
    secureUrl: image.secureUrl,
    altText: image.altText,
    sortOrder: image.sortOrder ?? index,
    isPrimary: image.isPrimary || index === 0
  }));
}

function uniqueCodeMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "Product code is already used by another product.";
  }

  return null;
}

function productValidationMessage(error: { issues: { message: string; path: (string | number)[] }[] }) {
  const issue = error.issues[0];
  const field = issue?.path[0];

  if (field === "name") {
    return "Product name is required.";
  }

  if (field === "referencePrice") {
    return "Unit price must be a valid amount.";
  }

  if (field === "referenceCost") {
    return "Product cost must be a valid amount.";
  }

  if (field === "status") {
    return "Choose a valid product status.";
  }

  if (issue?.message && !issue.message.toLowerCase().includes("expected")) {
    return issue.message;
  }

  return "Please check the product details and try again.";
}

export async function createProductAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("PRODUCTS", "CREATE");
  const imageFile = formData.get("imageFile");
  const parsed = createProductSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description"),
    specifications: formData.get("specifications"),
    referencePrice: formData.get("referencePrice"),
    referenceCost: formData.get("referenceCost"),
    currency: formData.get("currency") || "PHP",
    status: formData.get("status") || "ACTIVE",
    internalNotes: formData.get("internalNotes"),
    isWebsiteVisible: formData.get("isWebsiteVisible") === "on",
    websiteSortOrder: formData.get("websiteSortOrder"),
    images: parseImages(formData.get("images"))
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: productValidationMessage(parsed.error)
    };
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          code: parsed.data.code,
          name: parsed.data.name,
          category: parsed.data.category,
          description: parsed.data.description,
          specifications: parsed.data.specifications,
          referencePrice: parsed.data.referencePrice,
          referenceCost: parsed.data.referenceCost,
          currency: parsed.data.currency,
          status: parsed.data.status as ProductStatus,
          isWebsiteVisible: parsed.data.isWebsiteVisible,
          websiteSortOrder: parsed.data.websiteSortOrder,
          internalNotes: parsed.data.internalNotes,
          createdById: actor.id,
          updatedById: actor.id,
          images: parsed.data.images.length
            ? {
                create: imageCreateData(parsed.data.images)
              }
            : undefined
        }
      });

      await tx.activityLog.create({
        data: {
          action: "PRODUCT_CREATED",
          actorId: actor.id,
          summary: `Created product ${created.name}.`,
          metadata: {
            productId: created.id,
            code: created.code ?? "",
            status: created.status
          }
        }
      });

      return created;
    });

    if (imageFile instanceof File && imageFile.size > 0) {
      try {
        const uploaded = await uploadFileToCloudinary({
          category: "product-image",
          file: imageFile,
          path: {
            productId: product.id
          }
        });

        await prisma.$transaction(async (tx) => {
          const image = await tx.productImage.create({
            data: {
              productId: product.id,
              cloudinaryPublicId: uploaded.cloudinaryPublicId,
              secureUrl: uploaded.secureUrl,
              resourceType: uploaded.resourceType,
              format: uploaded.format,
              width: uploaded.width,
              height: uploaded.height,
              bytes: uploaded.bytes,
              altText: product.name,
              sortOrder: 0,
              isPrimary: true
            }
          });

          await tx.product.update({
            where: {
              id: product.id
            },
            data: {
              updatedById: actor.id
            }
          });

          await tx.activityLog.create({
            data: {
              action: "PRODUCT_UPDATED",
              actorId: actor.id,
              summary: `Uploaded image for product ${product.name}.`,
              metadata: {
                productId: product.id,
                productImageId: image.id,
                cloudinaryPublicId: uploaded.cloudinaryPublicId,
                originalFilename: uploaded.originalFilename,
                isPrimary: true
              }
            }
          });
        });
      } catch (error) {
        revalidatePath("/products");
        revalidatePath("/quotations");
        revalidatePath("/orders");

        return {
          ok: true,
          message: `Product saved: ${product.name}. Image upload was skipped: ${
            error instanceof Error ? error.message : "Unable to upload product image."
          }`
        };
      }
    }

    revalidatePath("/products");
    revalidatePath("/quotations");
    revalidatePath("/orders");

    return {
      ok: true,
      message: `Product saved: ${product.name}.`
    };
  } catch (error) {
    return {
      ok: false,
      message: uniqueCodeMessage(error) ?? "Unable to create product."
    };
  }
}

export async function updateProductAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("PRODUCTS", "UPDATE");
  const productId = String(formData.get("productId") ?? "");

  if (!productId) {
    return {
      ok: false,
      message: "Choose a product to update."
    };
  }

  const existing = await prisma.product.findUnique({
    where: {
      id: productId
    },
    select: {
      id: true,
      name: true,
      referenceCost: true,
      currency: true,
      isWebsiteVisible: true,
      websiteSortOrder: true,
      internalNotes: true
    }
  });

  if (!existing) {
    return {
      ok: false,
      message: "Product was not found."
    };
  }

  const parsed = updateProductSchema.safeParse({
    productId,
    code: formData.get("code"),
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description"),
    specifications: formData.get("specifications"),
    referencePrice: formData.get("referencePrice"),
    referenceCost: formData.has("referenceCost")
      ? formData.get("referenceCost")
      : existing.referenceCost?.toString(),
    currency: formData.get("currency") || existing.currency || "PHP",
    status: formData.get("status") || "ACTIVE",
    internalNotes: formData.has("internalNotes") ? formData.get("internalNotes") : existing.internalNotes,
    isWebsiteVisible: formData.has("isWebsiteVisible")
      ? formData.get("isWebsiteVisible") === "on"
      : existing.isWebsiteVisible,
    websiteSortOrder: formData.has("websiteSortOrder")
      ? formData.get("websiteSortOrder")
      : existing.websiteSortOrder,
    images: undefined
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: productValidationMessage(parsed.error)
    };
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const data: Prisma.ProductUpdateInput = {
        code: parsed.data.code,
        name: parsed.data.name,
        category: parsed.data.category,
        description: parsed.data.description,
        specifications: parsed.data.specifications,
        referencePrice: parsed.data.referencePrice,
        status: parsed.data.status as ProductStatus,
        updatedBy: {
          connect: {
            id: actor.id
          }
        }
      };

      if (formData.has("referenceCost")) {
        data.referenceCost = parsed.data.referenceCost;
      }

      if (formData.has("currency")) {
        data.currency = parsed.data.currency;
      }

      if (formData.has("isWebsiteVisible")) {
        data.isWebsiteVisible = parsed.data.isWebsiteVisible;
      }

      if (formData.has("websiteSortOrder")) {
        data.websiteSortOrder = parsed.data.websiteSortOrder;
      }

      if (formData.has("internalNotes")) {
        data.internalNotes = parsed.data.internalNotes;
      }

      const updated = await tx.product.update({
        where: {
          id: parsed.data.productId
        },
        data
      });

      await tx.activityLog.create({
        data: {
          action: "PRODUCT_UPDATED",
          actorId: actor.id,
          summary: `Updated product ${updated.name}.`,
          metadata: {
            productId: updated.id,
            previousName: existing.name,
            code: updated.code ?? "",
            status: updated.status
          }
        }
      });

      return updated;
    });

    revalidatePath("/products");
    revalidatePath("/quotations");
    revalidatePath("/orders");

    return {
      ok: true,
      message: `Product updated: ${product.name}.`
    };
  } catch (error) {
    return {
      ok: false,
      message: uniqueCodeMessage(error) ?? "Unable to update product."
    };
  }
}

export async function deleteProductAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("PRODUCTS", "DELETE");
  const productId = String(formData.get("productId") ?? "");

  if (!productId) {
    return {
      ok: false,
      message: "Choose a product to delete."
    };
  }

  const product = await prisma.product.findUnique({
    where: {
      id: productId
    },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      _count: {
        select: {
          quotationItems: true,
          orderItems: true,
          images: true
        }
      }
    }
  });

  if (!product) {
    return {
      ok: false,
      message: "Product was not found."
    };
  }

  if (product._count.quotationItems > 0 || product._count.orderItems > 0) {
    return {
      ok: false,
      message:
        "This product is already used in quotations or orders. Deactivate it instead to keep history intact."
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.activityLog.create({
      data: {
        action: "PRODUCT_UPDATED",
        actorId: actor.id,
        summary: `Deleted product ${product.name}.`,
        metadata: {
          productId: product.id,
          code: product.code ?? "",
          status: product.status,
          quotationItemCount: product._count.quotationItems,
          orderItemCount: product._count.orderItems,
          imageCount: product._count.images
        }
      }
    });

    await tx.product.delete({
      where: {
        id: product.id
      }
    });
  });

  revalidatePath("/products");
  revalidatePath("/quotations");
  revalidatePath("/orders");

  return {
    ok: true,
    message: `Product deleted: ${product.name}.`
  };
}

export async function updateProductStatusAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("PRODUCTS", "UPDATE");
  const productId = String(formData.get("productId") ?? "");
  const nextStatus = String(formData.get("status") ?? "");

  if (!productId) {
    return {
      ok: false,
      message: "Choose a product to update."
    };
  }

  if (nextStatus !== "ACTIVE" && nextStatus !== "INACTIVE") {
    return {
      ok: false,
      message: "Choose a valid product status."
    };
  }

  const existing = await prisma.product.findUnique({
    where: {
      id: productId
    },
    select: {
      id: true,
      name: true,
      code: true,
      status: true
    }
  });

  if (!existing) {
    return {
      ok: false,
      message: "Product was not found."
    };
  }

  if (existing.status === nextStatus) {
    return {
      ok: true,
      message: `${existing.name} is already ${nextStatus.toLowerCase()}.`
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: {
        id: productId
      },
      data: {
        status: nextStatus as ProductStatus,
        updatedById: actor.id
      }
    });

    await tx.activityLog.create({
      data: {
        action: "PRODUCT_UPDATED",
        actorId: actor.id,
        summary: `${nextStatus === "ACTIVE" ? "Reactivated" : "Deactivated"} product ${product.name}.`,
        metadata: {
          productId: product.id,
          code: product.code ?? "",
          previousStatus: existing.status,
          status: product.status
        }
      }
    });

    return product;
  });

  revalidatePath("/products");
  revalidatePath("/quotations");
  revalidatePath("/orders");

  return {
    ok: true,
    message: `${updated.name} ${updated.status === "ACTIVE" ? "reactivated" : "deactivated"}.`
  };
}

export async function uploadProductImageAction(formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("PRODUCTS", "UPDATE");
  const productId = String(formData.get("productId") ?? "");
  const file = formData.get("file");
  const altText = String(formData.get("altText") ?? "").trim() || undefined;
  const sortOrderValue = Number(formData.get("sortOrder") ?? 0);
  const requestedPrimary = formData.get("isPrimary") === "on";

  if (!productId) {
    return {
      ok: false,
      message: "Choose a product before uploading an image."
    };
  }

  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      message: "Choose an image file to upload."
    };
  }

  const product = await prisma.product.findUnique({
    where: {
      id: productId
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          images: true
        }
      }
    }
  });

  if (!product) {
    return {
      ok: false,
      message: "Product was not found."
    };
  }

  try {
    const uploaded = await uploadFileToCloudinary({
      category: "product-image",
      file,
      path: {
        productId
      }
    });
    const isPrimary = requestedPrimary || product._count.images === 0;
    const sortOrder = Number.isFinite(sortOrderValue) ? sortOrderValue : product._count.images;

    await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.productImage.updateMany({
          where: {
            productId
          },
          data: {
            isPrimary: false
          }
        });
      }

      const image = await tx.productImage.create({
        data: {
          productId,
          cloudinaryPublicId: uploaded.cloudinaryPublicId,
          secureUrl: uploaded.secureUrl,
          resourceType: uploaded.resourceType,
          format: uploaded.format,
          width: uploaded.width,
          height: uploaded.height,
          bytes: uploaded.bytes,
          altText,
          sortOrder,
          isPrimary
        }
      });

      await tx.product.update({
        where: {
          id: productId
        },
        data: {
          updatedById: actor.id
        }
      });

      await tx.activityLog.create({
        data: {
          action: "PRODUCT_UPDATED",
          actorId: actor.id,
          summary: `Uploaded image for product ${product.name}.`,
          metadata: {
            productId,
            productImageId: image.id,
            cloudinaryPublicId: uploaded.cloudinaryPublicId,
            originalFilename: uploaded.originalFilename,
            isPrimary
          }
        }
      });
    });

    revalidatePath("/products");
    revalidatePath("/quotations");
    revalidatePath("/orders");

    return {
      ok: true,
      message: "Product image uploaded."
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to upload product image."
    };
  }
}

export async function setPrimaryProductImageAction(formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("PRODUCTS", "UPDATE");
  const productId = String(formData.get("productId") ?? "");
  const imageId = String(formData.get("imageId") ?? "");

  const image = await prisma.productImage.findFirst({
    where: {
      id: imageId,
      productId
    },
    select: {
      id: true,
      product: {
        select: {
          name: true
        }
      }
    }
  });

  if (!image) {
    return {
      ok: false,
      message: "Product image was not found."
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.productImage.updateMany({
      where: {
        productId
      },
      data: {
        isPrimary: false
      }
    });

    await tx.productImage.update({
      where: {
        id: imageId
      },
      data: {
        isPrimary: true
      }
    });

    await tx.product.update({
      where: {
        id: productId
      },
      data: {
        updatedById: actor.id
      }
    });

    await tx.activityLog.create({
      data: {
        action: "PRODUCT_UPDATED",
        actorId: actor.id,
        summary: `Set primary image for product ${image.product.name}.`,
        metadata: {
          productId,
          productImageId: imageId
        }
      }
    });
  });

  revalidatePath("/products");
  revalidatePath("/quotations");
  revalidatePath("/orders");

  return {
    ok: true,
    message: "Primary product image updated."
  };
}

export async function removeProductImageAction(formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("PRODUCTS", "UPDATE");
  const productId = String(formData.get("productId") ?? "");
  const imageId = String(formData.get("imageId") ?? "");

  const image = await prisma.productImage.findFirst({
    where: {
      id: imageId,
      productId
    },
    select: {
      id: true,
      isPrimary: true,
      cloudinaryPublicId: true,
      product: {
        select: {
          name: true
        }
      }
    }
  });

  if (!image) {
    return {
      ok: false,
      message: "Product image was not found."
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({
      where: {
        id: imageId
      }
    });

    if (image.isPrimary) {
      const nextPrimary = await tx.productImage.findFirst({
        where: {
          productId
        },
        orderBy: [
          {
            sortOrder: "asc"
          },
          {
            createdAt: "asc"
          }
        ]
      });

      if (nextPrimary) {
        await tx.productImage.update({
          where: {
            id: nextPrimary.id
          },
          data: {
            isPrimary: true
          }
        });
      }
    }

    await tx.product.update({
      where: {
        id: productId
      },
      data: {
        updatedById: actor.id
      }
    });

    await tx.activityLog.create({
      data: {
        action: "PRODUCT_UPDATED",
        actorId: actor.id,
        summary: `Removed image metadata from product ${image.product.name}.`,
        metadata: {
          productId,
          productImageId: imageId,
          cloudinaryPublicId: image.cloudinaryPublicId,
          deletionMode: "metadata-only"
        }
      }
    });
  });

  revalidatePath("/products");
  revalidatePath("/quotations");
  revalidatePath("/orders");

  return {
    ok: true,
    message: "Product image metadata removed."
  };
}
