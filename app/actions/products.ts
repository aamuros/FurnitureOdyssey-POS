"use server";

import { Prisma } from "@prisma/client";
import type { ProductStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActiveUser, requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { uploadFileToCloudinary } from "@/lib/uploads/server";
import {
  createProductSchema,
  updateProductSchema
} from "@/lib/validation/products";

type ActionState = {
  ok: boolean;
  message: string;
  tagId?: string;
  tagName?: string;
};

function parseWebsitePages(formData: FormData) {
  return formData
    .getAll("websitePages")
    .map((value) => String(value))
    .filter(Boolean);
}

function parseTagIds(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll("tagIds")
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );
}

async function validateTagIds(tagIds: string[]) {
  if (tagIds.length === 0) {
    return true;
  }

  const count = await prisma.tag.count({
    where: {
      id: {
        in: tagIds
      }
    }
  });

  return count === tagIds.length;
}

function slugifyTagId(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueTagId(name: string) {
  const baseId = slugifyTagId(name) || "tag";
  let candidate = baseId;
  let suffix = 2;

  while (await prisma.tag.findUnique({ where: { id: candidate }, select: { id: true } })) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function tagNameFromForm(formData: FormData) {
  return String(formData.get("name") ?? "").trim();
}

function tagConflictMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "A tag with this name already exists.";
  }

  return null;
}

async function requireProductCreateOrUpdate() {
  const actor = await requireActiveUser();

  if (!hasPermission(actor, "PRODUCTS", "CREATE") && !hasPermission(actor, "PRODUCTS", "UPDATE")) {
    redirect("/dashboard?error=forbidden");
  }

  return actor;
}

type ImageManifestItem = {
  clientId: string;
  id?: string;
  colorVariantClientId?: string | null;
  cloudinaryPublicId?: string;
  secureUrl?: string;
  altText?: string;
  sortOrder: number;
  isPrimary: boolean;
  remove?: boolean;
};

type ColorVariantManifestItem = {
  clientId: string;
  id?: string;
  name: string;
  hex?: string | null;
  sortOrder: number;
  isActive: boolean;
  remove?: boolean;
};

function parseImageManifest(value: FormDataEntryValue | null): ImageManifestItem[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index) => ({
        clientId: String(item.clientId ?? item.id ?? `image-${index}`),
        id: item.id ? String(item.id) : undefined,
        colorVariantClientId:
          item.colorVariantClientId === null || item.colorVariantClientId === undefined
            ? null
            : String(item.colorVariantClientId),
        cloudinaryPublicId: item.cloudinaryPublicId ? String(item.cloudinaryPublicId) : undefined,
        secureUrl: item.secureUrl ? String(item.secureUrl) : undefined,
        altText: item.altText ? String(item.altText) : undefined,
        sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
        isPrimary: Boolean(item.isPrimary),
        remove: Boolean(item.remove)
      }));
  } catch {
    return [];
  }
}

function parseColorVariantManifest(value: FormDataEntryValue | null): ColorVariantManifestItem[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index) => ({
        clientId: String(item.clientId ?? item.id ?? `variant-${index}`),
        id: item.id ? String(item.id) : undefined,
        name: String(item.name ?? "").trim(),
        hex: item.hex ? String(item.hex).trim() : undefined,
        sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
        isActive: item.isActive !== false,
        remove: Boolean(item.remove)
      }))
      .filter((item) => item.remove || item.name.length > 0);
  } catch {
    return [];
  }
}

const validWebsitePages = ["home", "chairs", "tables", "collections"] as const;

function parseWebsitePageSortOrders(formData: FormData, selectedPages: string[]) {
  const selectedPageSet = new Set(selectedPages);

  return Object.fromEntries(
    validWebsitePages
      .filter((page) => selectedPageSet.has(page))
      .map((page) => {
        const rawValue = formData.get(`websitePageSortOrder_${page}`);
        const sortOrder = Number(rawValue ?? 0);

        return [page, Number.isFinite(sortOrder) ? Math.max(0, Math.trunc(sortOrder)) : 0];
      })
  );
}

async function uploadManifestImages(productId: string, formData: FormData, images: ImageManifestItem[]) {
  const uploadedByClientId = new Map<string, Awaited<ReturnType<typeof uploadFileToCloudinary>>>();

  for (const image of images) {
    if (image.remove) {
      continue;
    }

    const file = formData.get(`imageFile_${image.clientId}`);

    if (file instanceof File && file.size > 0) {
      uploadedByClientId.set(
        image.clientId,
        await uploadFileToCloudinary({
          category: "product-image",
          file,
          path: {
            productId
          }
        })
      );
    }
  }

  return uploadedByClientId;
}

function normalizePrimaryImages(images: ImageManifestItem[]) {
  const keptGeneralImages = images
    .filter((image) => !image.remove && !image.colorVariantClientId)
    .sort((first, second) => first.sortOrder - second.sortOrder);
  const primary = keptGeneralImages.find((image) => image.isPrimary) ?? keptGeneralImages[0];

  return images.map((image) => ({
    ...image,
    isPrimary: primary ? image.clientId === primary.clientId : false
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

  if (field === "category") {
    return "Choose Chair, Table, or Others.";
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
  const websitePages = formData.has("websitePagesMode") ? parseWebsitePages(formData) : [];
  const tagIds = parseTagIds(formData);
  const imageManifest = normalizePrimaryImages(parseImageManifest(formData.get("imageManifest")));
  const colorVariantManifest = parseColorVariantManifest(formData.get("colorVariantManifest"));
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
    websitePages,
    websitePageSortOrders: parseWebsitePageSortOrders(formData, websitePages),
    tagIds,
    images: []
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: productValidationMessage(parsed.error)
    };
  }

  if (!(await validateTagIds(tagIds))) {
    return {
      ok: false,
      message: "Some selected tags no longer exist. Refresh and try again."
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
          websitePages: parsed.data.websitePages,
          websitePageSortOrders: parsed.data.websitePageSortOrders,
          internalNotes: parsed.data.internalNotes,
          createdById: actor.id,
          updatedById: actor.id,
          tagAssignments: parsed.data.tagIds.length
            ? {
                createMany: {
                  data: parsed.data.tagIds.map((tagId) => ({ tagId })),
                  skipDuplicates: true
                }
              }
            : undefined,
          images: undefined
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

    if (imageManifest.some((image) => !image.remove) || colorVariantManifest.some((variant) => !variant.remove)) {
      try {
        const uploadedByClientId = await uploadManifestImages(product.id, formData, imageManifest);

        await prisma.$transaction(async (tx) => {
          const variantIdByClientId = new Map<string, string>();

          for (const variant of colorVariantManifest.filter((item) => !item.remove)) {
            const createdVariant = await tx.productColorVariant.create({
              data: {
                productId: product.id,
                name: variant.name,
                hex: variant.hex,
                sortOrder: variant.sortOrder,
                isActive: variant.isActive
              }
            });

            variantIdByClientId.set(variant.clientId, createdVariant.id);
          }

          for (const image of imageManifest.filter((item) => !item.remove)) {
            const uploaded = uploadedByClientId.get(image.clientId);

            if (!uploaded) {
              continue;
            }

            await tx.productImage.create({
              data: {
                productId: product.id,
                colorVariantId: image.colorVariantClientId
                  ? variantIdByClientId.get(image.colorVariantClientId)
                  : undefined,
                cloudinaryPublicId: uploaded.cloudinaryPublicId,
                secureUrl: uploaded.secureUrl,
                resourceType: uploaded.resourceType,
                format: uploaded.format,
                width: uploaded.width,
                height: uploaded.height,
                bytes: uploaded.bytes,
                altText: image.altText || product.name,
                sortOrder: image.sortOrder,
                isPrimary: image.isPrimary
              }
            });
          }

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
                imageCount: uploadedByClientId.size,
                colorVariantCount: variantIdByClientId.size
              }
            }
          });
        });
      } catch (error) {
        revalidatePath("/products");
        revalidatePath("/quotations");
        revalidatePath("/orders");
        revalidatePath("/catalogue");

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
    revalidatePath("/catalogue");

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
  const tagIds = parseTagIds(formData);
  const imageManifest = normalizePrimaryImages(parseImageManifest(formData.get("imageManifest")));
  const colorVariantManifest = parseColorVariantManifest(formData.get("colorVariantManifest"));

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
      websitePages: true,
      websitePageSortOrders: true,
      internalNotes: true
    }
  });

  if (!existing) {
    return {
      ok: false,
      message: "Product was not found."
    };
  }

  const websitePages = formData.has("websitePagesMode") ? parseWebsitePages(formData) : existing.websitePages;
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
    websitePages,
    websitePageSortOrders: formData.has("websitePagesMode")
      ? parseWebsitePageSortOrders(formData, websitePages)
      : existing.websitePageSortOrders,
    tagIds,
    images: []
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: productValidationMessage(parsed.error)
    };
  }

  if (!(await validateTagIds(tagIds))) {
    return {
      ok: false,
      message: "Some selected tags no longer exist. Refresh and try again."
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

      if (formData.has("websitePagesMode")) {
        data.websitePages = parsed.data.websitePages;
        data.websitePageSortOrders = parsed.data.websitePageSortOrders;
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

      await tx.productTagAssignment.deleteMany({
        where: {
          productId: updated.id
        }
      });

      if (parsed.data.tagIds.length) {
        await tx.productTagAssignment.createMany({
          data: parsed.data.tagIds.map((tagId) => ({
            productId: updated.id,
            tagId
          })),
          skipDuplicates: true
        });
      }

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

    if (formData.has("imageManifest") || formData.has("colorVariantManifest")) {
      try {
        const uploadedByClientId = await uploadManifestImages(product.id, formData, imageManifest);

        await prisma.$transaction(async (tx) => {
          const variantIdByClientId = new Map<string, string>();

          for (const variant of colorVariantManifest) {
            if (variant.id && variant.remove) {
              await tx.productColorVariant.deleteMany({
                where: {
                  id: variant.id,
                  productId: product.id
                }
              });
              continue;
            }

            if (variant.remove) {
              continue;
            }

            if (variant.id) {
              const updatedVariant = await tx.productColorVariant.update({
                where: {
                  id: variant.id
                },
                data: {
                  name: variant.name,
                  hex: variant.hex,
                  sortOrder: variant.sortOrder,
                  isActive: variant.isActive
                }
              });

              variantIdByClientId.set(variant.clientId, updatedVariant.id);
            } else {
              const createdVariant = await tx.productColorVariant.create({
                data: {
                  productId: product.id,
                  name: variant.name,
                  hex: variant.hex,
                  sortOrder: variant.sortOrder,
                  isActive: variant.isActive
                }
              });

              variantIdByClientId.set(variant.clientId, createdVariant.id);
            }
          }

          for (const image of imageManifest) {
            if (image.id && image.remove) {
              await tx.productImage.deleteMany({
                where: {
                  id: image.id,
                  productId: product.id
                }
              });
              continue;
            }

            if (image.remove) {
              continue;
            }

            const uploaded = uploadedByClientId.get(image.clientId);
            const colorVariantId = image.colorVariantClientId
              ? variantIdByClientId.get(image.colorVariantClientId)
              : null;

            if (image.id) {
              await tx.productImage.updateMany({
                where: {
                  id: image.id,
                  productId: product.id
                },
                data: {
                  colorVariantId,
                  ...(uploaded
                    ? {
                        cloudinaryPublicId: uploaded.cloudinaryPublicId,
                        secureUrl: uploaded.secureUrl,
                        resourceType: uploaded.resourceType,
                        format: uploaded.format,
                        width: uploaded.width,
                        height: uploaded.height,
                        bytes: uploaded.bytes
                      }
                    : {}),
                  altText: image.altText || product.name,
                  sortOrder: image.sortOrder,
                  isPrimary: image.isPrimary
                }
              });
            } else if (uploaded) {
              await tx.productImage.create({
                data: {
                  productId: product.id,
                  colorVariantId,
                  cloudinaryPublicId: uploaded.cloudinaryPublicId,
                  secureUrl: uploaded.secureUrl,
                  resourceType: uploaded.resourceType,
                  format: uploaded.format,
                  width: uploaded.width,
                  height: uploaded.height,
                  bytes: uploaded.bytes,
                  altText: image.altText || product.name,
                  sortOrder: image.sortOrder,
                  isPrimary: image.isPrimary
                }
              });
            }
          }

          await tx.productImage.updateMany({
            where: {
              productId: product.id,
              colorVariantId: {
                not: null
              }
            },
            data: {
              isPrimary: false
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
                imageCount: imageManifest.filter((image) => !image.remove).length,
                colorVariantCount: colorVariantManifest.filter((variant) => !variant.remove).length
              }
            }
          });
        });
      } catch (error) {
        revalidatePath("/products");
        revalidatePath("/quotations");
        revalidatePath("/orders");
        revalidatePath("/catalogue");

        return {
          ok: true,
          message: `Product updated: ${product.name}. Image upload was skipped: ${
            error instanceof Error ? error.message : "Unable to upload product image."
          }`
        };
      }
    }

    revalidatePath("/products");
    revalidatePath("/quotations");
    revalidatePath("/orders");
    revalidatePath("/catalogue");

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

export async function createTagAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requireProductCreateOrUpdate();
  const name = tagNameFromForm(formData);

  if (!name) {
    return {
      ok: false,
      message: "Tag name is required."
    };
  }

  if (name.length > 60) {
    return {
      ok: false,
      message: "Tag name must be 60 characters or fewer."
    };
  }

  try {
    const tag = await prisma.$transaction(async (tx) => {
      const created = await tx.tag.create({
        data: {
          id: await uniqueTagId(name),
          name
        }
      });

      await tx.activityLog.create({
        data: {
          action: "PRODUCT_UPDATED",
          actorId: actor.id,
          summary: `Created catalogue tag ${created.name}.`,
          metadata: {
            tagId: created.id,
            tagName: created.name,
            tagAction: "created"
          }
        }
      });

      return created;
    });

    revalidatePath("/products");
    revalidatePath("/catalogue");

    return {
      ok: true,
      message: `Tag created: ${tag.name}.`,
      tagId: tag.id,
      tagName: tag.name
    };
  } catch (error) {
    return {
      ok: false,
      message: tagConflictMessage(error) ?? "Unable to create tag."
    };
  }
}

export async function updateTagAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("PRODUCTS", "UPDATE");
  const tagId = String(formData.get("tagId") ?? "").trim();
  const name = tagNameFromForm(formData);

  if (!tagId) {
    return {
      ok: false,
      message: "Choose a tag to update."
    };
  }

  if (!name) {
    return {
      ok: false,
      message: "Tag name is required."
    };
  }

  if (name.length > 60) {
    return {
      ok: false,
      message: "Tag name must be 60 characters or fewer."
    };
  }

  try {
    const tag = await prisma.$transaction(async (tx) => {
      const updated = await tx.tag.update({
        where: {
          id: tagId
        },
        data: {
          name
        }
      });

      await tx.activityLog.create({
        data: {
          action: "PRODUCT_UPDATED",
          actorId: actor.id,
          summary: `Renamed catalogue tag ${updated.name}.`,
          metadata: {
            tagId: updated.id,
            tagName: updated.name,
            tagAction: "updated"
          }
        }
      });

      return updated;
    });

    revalidatePath("/products");
    revalidatePath("/catalogue");

    return {
      ok: true,
      message: `Tag updated: ${tag.name}.`,
      tagId: tag.id,
      tagName: tag.name
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return {
        ok: false,
        message: "Tag was not found."
      };
    }

    return {
      ok: false,
      message: tagConflictMessage(error) ?? "Unable to update tag."
    };
  }
}

export async function deleteTagAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("PRODUCTS", "DELETE");
  const tagId = String(formData.get("tagId") ?? "").trim();

  if (!tagId) {
    return {
      ok: false,
      message: "Choose a tag to delete."
    };
  }

  const tag = await prisma.tag.findUnique({
    where: {
      id: tagId
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          products: true
        }
      }
    }
  });

  if (!tag) {
    return {
      ok: false,
      message: "Tag was not found."
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.activityLog.create({
      data: {
        action: "PRODUCT_UPDATED",
        actorId: actor.id,
        summary: `Deleted catalogue tag ${tag.name}.`,
        metadata: {
          tagId: tag.id,
          tagName: tag.name,
          tagAction: "deleted",
          assignedProductCount: tag._count.products
        }
      }
    });

    await tx.tag.delete({
      where: {
        id: tag.id
      }
    });
  });

  revalidatePath("/products");
  revalidatePath("/catalogue");

  return {
    ok: true,
    message: "Tag deleted and removed from assigned products.",
    tagId: tag.id,
    tagName: tag.name
  };
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
  revalidatePath("/catalogue");

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
  revalidatePath("/catalogue");

  return {
    ok: true,
    message: `${updated.name} ${updated.status === "ACTIVE" ? "reactivated" : "deactivated"}.`
  };
}

export async function updateProductWebsiteVisibilityAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("PRODUCTS", "UPDATE");
  const productId = String(formData.get("productId") ?? "");
  const isWebsiteVisible = formData.get("isWebsiteVisible") === "on";

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
      code: true,
      isWebsiteVisible: true
    }
  });

  if (!existing) {
    return {
      ok: false,
      message: "Product was not found."
    };
  }

  if (existing.isWebsiteVisible === isWebsiteVisible) {
    return {
      ok: true,
      message: `${existing.name} is already ${isWebsiteVisible ? "visible" : "hidden"} on the website.`
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: {
        id: productId
      },
      data: {
        isWebsiteVisible,
        updatedById: actor.id
      }
    });

    await tx.activityLog.create({
      data: {
        action: "PRODUCT_UPDATED",
        actorId: actor.id,
        summary: `${isWebsiteVisible ? "Showed" : "Hid"} product ${product.name} on the website.`,
        metadata: {
          productId: product.id,
          code: product.code ?? "",
          previousIsWebsiteVisible: existing.isWebsiteVisible,
          isWebsiteVisible: product.isWebsiteVisible
        }
      }
    });

    return product;
  });

  revalidatePath("/products");
  revalidatePath("/quotations");
  revalidatePath("/orders");
  revalidatePath("/catalogue");

  return {
    ok: true,
    message: `${updated.name} is now ${updated.isWebsiteVisible ? "visible" : "hidden"} on the website.`
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
    revalidatePath("/catalogue");

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
