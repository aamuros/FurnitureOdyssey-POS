"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";

type ActionState = {
  ok: boolean;
  message: string;
  id?: string;
  fieldValue?: string;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function updatePageContentAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("SETTINGS", "UPDATE");
  const id = text(formData, "id").trim();
  const fieldValue = text(formData, "fieldValue");

  if (!id) {
    return {
      ok: false,
      message: "Catalogue content record is missing."
    };
  }

  try {
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
          fieldKey: updated.fieldKey
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
