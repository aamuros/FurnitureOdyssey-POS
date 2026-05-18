import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : undefined))
  .optional();

export const customerContactSchema = z.object({
  type: z.enum(["PHONE", "VIBER", "FACEBOOK_PROFILE", "FACEBOOK_PAGE", "EMAIL", "OTHER"]),
  label: optionalText,
  value: z.string().trim().min(1, "Contact value is required."),
  isPrimary: z.boolean().default(false),
  notes: optionalText
});

export const createCustomerSchema = z
  .object({
    customerType: z.enum(["INDIVIDUAL", "COMPANY"]),
    displayName: optionalText,
    firstName: optionalText,
    lastName: optionalText,
    companyName: optionalText,
    contactPersonName: optionalText,
    assignedStaffId: optionalText,
    notes: optionalText,
    contacts: z.array(customerContactSchema).default([])
  })
  .superRefine((value, context) => {
    if (value.customerType === "INDIVIDUAL") {
      const hasName = Boolean(value.displayName || value.firstName || value.lastName);

      if (!hasName) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Individual customers need a name.",
          path: ["displayName"]
        });
      }
    }

    if (value.customerType === "COMPANY" && !value.companyName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Company clients need a company name.",
        path: ["companyName"]
      });
    }
  });

export const createInquirySchema = z.object({
  customerId: z.string().uuid("Choose a customer."),
  source: z.enum([
    "FACEBOOK_MARKETPLACE",
    "FACEBOOK_PAGE",
    "MESSENGER",
    "VIBER",
    "WALK_IN",
    "PHONE",
    "REFERRAL",
    "OTHER"
  ]),
  sourceReference: optionalText,
  status: z
    .enum([
      "NEW",
      "IN_PROGRESS",
      "WAITING_FOR_CUSTOMER",
      "QUOTED",
      "CONVERTED_TO_ORDER",
      "CLOSED",
      "LOST"
    ])
    .default("NEW"),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
  subject: z.string().trim().min(2, "Inquiry subject is required."),
  messageSummary: optionalText,
  requestedItems: optionalText,
  budgetRange: optionalText,
  targetDeliveryDate: optionalText,
  deliveryLocation: optionalText,
  assignedStaffId: optionalText,
  followUpAt: optionalText,
  lastContactedAt: optionalText
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
