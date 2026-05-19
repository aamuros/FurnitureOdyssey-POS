"use server";

import { revalidatePath } from "next/cache";
import type {
  CustomerContactType,
  CustomerType,
  InquiryPriority,
  InquirySource,
  InquiryStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import {
  createCustomerSchema,
  createInquirySchema,
  type CreateCustomerInput
} from "@/lib/validation/customer-inquiries";

type ActionState = {
  ok: boolean;
  message: string;
  customerId?: string;
  customerDisplayName?: string;
};

function parseContacts(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed)
      ? parsed.filter(
          (contact) =>
            contact &&
            typeof contact === "object" &&
            "value" in contact &&
            typeof contact.value === "string" &&
            contact.value.trim()
        )
      : [];
  } catch {
    return [];
  }
}

function parseDate(value: string | undefined) {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

function buildDisplayName(input: CreateCustomerInput) {
  if (input.customerType === "COMPANY") {
    return input.companyName ?? input.displayName ?? "Company client";
  }

  return (
    input.displayName ??
    [input.firstName, input.lastName].filter(Boolean).join(" ") ??
    "Individual customer"
  );
}

function normalizedContacts(input: CreateCustomerInput) {
  const primaryIndex = input.contacts.findIndex((contact) => contact.isPrimary);

  return input.contacts.map((contact, index) => ({
    type: contact.type as CustomerContactType,
    label: contact.label,
    value: contact.value,
    notes: contact.notes,
    isPrimary: primaryIndex >= 0 ? index === primaryIndex : index === 0
  }));
}

function friendlyValidationMessage(message: string | undefined, fallback: string) {
  if (!message) {
    return fallback;
  }

  if (message.includes("Expected string") || message.includes("received null")) {
    return "Some optional details were blank. Please check the required fields and try again.";
  }

  return message;
}

export async function createCustomerAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("CUSTOMERS", "CREATE");
  const parsed = createCustomerSchema.safeParse({
    customerType: formData.get("customerType"),
    displayName: formData.get("displayName"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    companyName: formData.get("companyName"),
    contactPersonName: formData.get("contactPersonName"),
    source: formData.get("source") || undefined,
    assignedStaffId: formData.get("assignedStaffId"),
    notes: formData.get("notes"),
    contacts: parseContacts(formData.get("contacts"))
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: friendlyValidationMessage(
        parsed.error.issues[0]?.message,
        "Invalid customer details."
      )
    };
  }

  const customer = await prisma.$transaction(async (tx) => {
    const contacts = normalizedContacts(parsed.data);
    const created = await tx.customer.create({
      data: {
        customerType: parsed.data.customerType as CustomerType,
        displayName: buildDisplayName(parsed.data),
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        companyName: parsed.data.companyName,
        contactPersonName: parsed.data.contactPersonName,
        source: parsed.data.source as InquirySource | undefined,
        assignedStaffId: parsed.data.assignedStaffId,
        notes: parsed.data.notes,
        createdById: actor.id,
        contacts: contacts.length
          ? {
              createMany: {
                data: contacts
              }
            }
          : undefined
      }
    });

    await tx.activityLog.create({
      data: {
        action: "CUSTOMER_CREATED",
        actorId: actor.id,
        summary: `Created customer record for ${created.displayName}.`,
        metadata: {
          customerId: created.id,
          customerType: created.customerType,
          source: created.source ?? ""
        }
      }
    });

    return created;
  });

  revalidatePath("/customers");
  revalidatePath("/quotations");
  revalidatePath("/orders");
  return {
    ok: true,
    message: `Customer saved: ${customer.displayName}.`,
    customerId: customer.id,
    customerDisplayName: customer.displayName
  };
}

export async function createInquiryAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requirePermission("INQUIRIES", "CREATE");
  const parsed = createInquirySchema.safeParse({
    customerId: formData.get("customerId"),
    source: formData.get("source"),
    sourceReference: formData.get("sourceReference"),
    status: formData.get("status") || "NEW",
    priority: formData.get("priority") || "NORMAL",
    subject: formData.get("subject"),
    messageSummary: formData.get("messageSummary"),
    requestedItems: formData.get("requestedItems"),
    budgetRange: formData.get("budgetRange"),
    targetDeliveryDate: formData.get("targetDeliveryDate"),
    deliveryLocation: formData.get("deliveryLocation"),
    assignedStaffId: formData.get("assignedStaffId"),
    followUpAt: formData.get("followUpAt"),
    lastContactedAt: formData.get("lastContactedAt")
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid inquiry details."
    };
  }

  const customer = await prisma.customer.findUnique({
    where: {
      id: parsed.data.customerId
    },
    select: {
      id: true,
      displayName: true
    }
  });

  if (!customer) {
    return {
      ok: false,
      message: "Customer was not found."
    };
  }

  const inquiry = await prisma.$transaction(async (tx) => {
    const created = await tx.inquiry.create({
      data: {
        customerId: parsed.data.customerId,
        source: parsed.data.source as InquirySource,
        sourceReference: parsed.data.sourceReference,
        status: parsed.data.status as InquiryStatus,
        priority: parsed.data.priority as InquiryPriority,
        subject: parsed.data.subject,
        messageSummary: parsed.data.messageSummary,
        requestedItems: parsed.data.requestedItems,
        budgetRange: parsed.data.budgetRange,
        targetDeliveryDate: parseDate(parsed.data.targetDeliveryDate),
        deliveryLocation: parsed.data.deliveryLocation,
        assignedStaffId: parsed.data.assignedStaffId,
        createdById: actor.id,
        followUpAt: parseDate(parsed.data.followUpAt),
        lastContactedAt: parseDate(parsed.data.lastContactedAt),
        closedAt: ["CLOSED", "LOST", "CONVERTED_TO_ORDER"].includes(parsed.data.status)
          ? new Date()
          : undefined
      }
    });

    await tx.activityLog.create({
      data: {
        action:
          created.assignedStaffId && created.assignedStaffId !== actor.id
            ? "INQUIRY_ASSIGNED"
            : "INQUIRY_CREATED",
        actorId: actor.id,
        summary: `Recorded ${created.source} inquiry for ${customer.displayName}.`,
        metadata: {
          customerId: customer.id,
          inquiryId: created.id,
          assignedStaffId: created.assignedStaffId ?? ""
        }
      }
    });

    return created;
  });

  revalidatePath("/customers");
  revalidatePath("/inquiries");
  return {
    ok: true,
    message: `Inquiry saved: ${inquiry.subject}.`
  };
}
