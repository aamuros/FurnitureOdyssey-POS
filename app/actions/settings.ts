"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import {
  getAppSettings,
  saveAppSettings
} from "@/lib/settings/get-settings";
import {
  companyProfileSettingsSchema,
  documentSettingsSchema,
  paymentSettingsSchema
} from "@/lib/validation/settings";

type ActionState = {
  ok: boolean;
  message: string;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

async function logSettingsUpdate(actorId: string, section: string) {
  await prisma.activityLog.create({
    data: {
      action: "SETTINGS_UPDATED",
      actorId,
      summary: `Updated ${section} settings.`,
      metadata: {
        section
      }
    }
  });
}

export async function updateCompanyProfileSettingsAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("SETTINGS", "UPDATE");
  const parsed = companyProfileSettingsSchema.safeParse({
    companyName: text(formData, "companyName"),
    registeredName: text(formData, "registeredName"),
    address: text(formData, "address"),
    contactNumber: text(formData, "contactNumber"),
    email: text(formData, "email"),
    facebookPage: text(formData, "facebookPage"),
    websiteUrl: text(formData, "websiteUrl"),
    logoUrl: text(formData, "logoUrl"),
    logoAltText: text(formData, "logoAltText")
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid company profile settings."
    };
  }

  const current = await getAppSettings();
  const next = {
    ...current,
    companyProfile: parsed.data
  };

  await saveAppSettings(next, actor.id);
  await logSettingsUpdate(actor.id, "company profile");

  revalidatePath("/settings");
  return {
    ok: true,
    message: "Company profile settings saved."
  };
}

export async function updatePaymentSettingsAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("SETTINGS", "UPDATE");
  const parsed = paymentSettingsSchema.safeParse({
    defaultPaymentInstructions: text(formData, "defaultPaymentInstructions"),
    bankDetails: text(formData, "bankDetails"),
    eWalletDetails: text(formData, "eWalletDetails"),
    otherPaymentNotes: text(formData, "otherPaymentNotes"),
    mopScript: text(formData, "mopScript")
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid payment settings."
    };
  }

  const current = await getAppSettings();
  const next = {
    ...current,
    payment: parsed.data
  };

  await saveAppSettings(next, actor.id);
  await logSettingsUpdate(actor.id, "payment and MOP");

  revalidatePath("/settings");
  return {
    ok: true,
    message: "Payment and MOP settings saved."
  };
}

export async function updateDocumentSettingsAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("SETTINGS", "UPDATE");
  const parsed = documentSettingsSchema.safeParse({
    quotationFooter: text(formData, "quotationFooter"),
    invoiceFooter: text(formData, "invoiceFooter"),
    paymentReceiptFooter: text(formData, "paymentReceiptFooter"),
    deliveryReceiptFooter: text(formData, "deliveryReceiptFooter"),
    finalSummaryFooter: text(formData, "finalSummaryFooter"),
    quotationPrefix: text(formData, "quotationPrefix"),
    orderPrefix: text(formData, "orderPrefix"),
    invoicePrefix: text(formData, "invoicePrefix"),
    paymentReceiptPrefix: text(formData, "paymentReceiptPrefix"),
    deliveryReceiptPrefix: text(formData, "deliveryReceiptPrefix"),
    finalSummaryPrefix: text(formData, "finalSummaryPrefix")
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid document settings."
    };
  }

  const current = await getAppSettings();
  const next = {
    ...current,
    documents: parsed.data
  };

  await saveAppSettings(next, actor.id);
  await logSettingsUpdate(actor.id, "document and PDF defaults");

  revalidatePath("/settings");
  return {
    ok: true,
    message: "Document and PDF settings saved."
  };
}
