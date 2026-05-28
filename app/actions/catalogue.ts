"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/auth/server";
import { hasPermission, type UserWithPermissions } from "@/lib/auth/permissions";
import { uploadFileToCloudinary } from "@/lib/uploads/server";

type ActionState = {
  ok: boolean;
  message: string;
  id?: string;
  fieldValue?: string;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function isImageFieldKey(fieldKey: string) {
  return fieldKey === "image" || fieldKey.startsWith("image");
}

export async function updatePageContentAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = (await requireActiveUser()) as UserWithPermissions;
  const id = text(formData, "id").trim();
  let fieldValue = text(formData, "fieldValue");
  const imageFile = formData.get("imageFile");
  const hasImageUpload = imageFile instanceof File && imageFile.size > 0;

  if (hasImageUpload) {
    if (!hasPermission(actor, "CATALOGUE", "UPLOAD")) {
      return {
        ok: false,
        message: "You do not have permission to upload catalogue images."
      };
    }
  } else if (!hasPermission(actor, "CATALOGUE", "UPDATE")) {
    return {
      ok: false,
      message: "You do not have permission to update catalogue content."
    };
  }

  if (!id) {
    return {
      ok: false,
      message: "Catalogue content record is missing."
    };
  }

  try {
    const existing = await prisma.pageContent.findUnique({
      where: { id },
      select: {
        id: true,
        page: true,
        section: true,
        fieldKey: true
      }
    });

    if (!existing) {
      return {
        ok: false,
        message: "Catalogue content record was not found."
      };
    }

    if (hasImageUpload) {
      if (!isImageFieldKey(existing.fieldKey)) {
        return {
          ok: false,
          message: "Only catalogue image fields accept image uploads."
        };
      }

      const uploaded = await uploadFileToCloudinary({
        category: "catalogue-static-image",
        file: imageFile,
        path: {
          pageContentId: existing.id,
          cataloguePage: existing.page,
          catalogueSection: existing.section,
          catalogueFieldKey: existing.fieldKey
        }
      });

      fieldValue = uploaded.secureUrl;
    }

    const updated = await prisma.pageContent.update({
      where: { id },
      data: { fieldValue },
      select: {
        id: true,
        page: true,
        section: true,
        fieldKey: true,
        fieldValue: true
      }
    });

    await prisma.activityLog.create({
      data: {
        action: "SETTINGS_UPDATED",
        actorId: actor.id,
        summary: `Updated catalogue content ${updated.page}/${updated.section}/${updated.fieldKey}.`,
        metadata: {
          pageContentId: updated.id,
          page: updated.page,
          section: updated.section,
          fieldKey: updated.fieldKey,
          uploadedImage: hasImageUpload
        }
      }
    });

    revalidatePath("/catalogue");

    return {
      ok: true,
      message: "Catalogue content saved.",
      id: updated.id,
      fieldValue: updated.fieldValue
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return {
        ok: false,
        message: "Catalogue content record was not found."
      };
    }

    throw error;
  }
}
