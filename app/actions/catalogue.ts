"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
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
  const actor = await requirePermission("SETTINGS", "UPDATE");
  const id = text(formData, "id").trim();
  let fieldValue = text(formData, "fieldValue");
  const imageFile = formData.get("imageFile");

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

    if (imageFile instanceof File && imageFile.size > 0) {
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
          uploadedImage: imageFile instanceof File && imageFile.size > 0
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
