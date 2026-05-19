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
  updateProductStatusSchema,
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

export async function createProductAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("PRODUCTS", "CREATE");
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
      message: parsed.error.issues[0]?.message ?? "Invalid product details."
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
  const parsed = updateProductSchema.safeParse({
    productId: formData.get("productId"),
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
    images: undefined
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid product details."
    };
  }

  const existing = await prisma.product.findUnique({
    where: {
      id: parsed.data.productId
    },
    select: {
      id: true,
      name: true
    }
  });

  if (!existing) {
    return {
      ok: false,
      message: "Product was not found."
    };
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: {
          id: parsed.data.productId
        },
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
          updatedById: actor.id
        }
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

export async function updateProductStatusAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("PRODUCTS", "UPDATE");
  const parsed = updateProductStatusSchema.safeParse({
    productId: formData.get("productId"),
    status: formData.get("status")
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid product status."
    };
  }

  const product = await prisma.product.update({
    where: {
      id: parsed.data.productId
    },
    data: {
      status: parsed.data.status,
      updatedById: actor.id
    }
  });

  await prisma.activityLog.create({
    data: {
      action: "PRODUCT_UPDATED",
      actorId: actor.id,
      summary: `Marked product ${product.name} as ${product.status}.`,
      metadata: {
        productId: product.id,
        status: product.status
      }
    }
  });

  revalidatePath("/products");
  revalidatePath("/quotations");
  revalidatePath("/orders");

  return {
    ok: true,
    message: `Product marked ${product.status}.`
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
    include: {
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
    include: {
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
