import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (value === null ? undefined : value),
  z
    .string()
    .trim()
    .transform((value) => (value.length ? value : undefined))
    .optional()
);

const optionalTextMax = (max: number, message: string) =>
  z.preprocess(
    (value) => (value === null ? undefined : value),
    z
      .string()
      .trim()
      .max(max, message)
      .transform((value) => (value.length ? value : undefined))
      .optional()
  );

const formBoolean = z.preprocess(
  (value) => value === true || value === "true" || value === "on" || value === "1" || value === "yes",
  z.boolean()
);

const money = z.coerce
  .number({
    invalid_type_error: "Enter a valid amount."
  })
  .min(0, "Amount cannot be negative.");

const quantity = z.coerce
  .number({
    invalid_type_error: "Enter a valid quantity."
  })
  .int("Quantity must be a whole number.")
  .min(1, "Quantity must be at least 1.");

export const quotationImageSchema = z.object({
  sourceProductImageId: optionalText,
  cloudinaryPublicId: z.string().trim().min(1, "Image public ID is required."),
  secureUrl: z.string().trim().url("Image URL must be valid."),
  resourceType: z.string().trim().default("image"),
  format: optionalText,
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
  bytes: z.coerce.number().int().positive().optional(),
  altText: optionalText,
  sortOrder: z.coerce.number().int().min(0).default(0),
  isPrimary: z.boolean().default(false)
});

export const quotationItemSchema = z
  .object({
    productId: optionalText,
    itemType: z.enum(["CATALOG_PRODUCT", "CUSTOM_ITEM"]),
    sortOrder: z.coerce.number().int().min(0).default(0),
    snapshotProductCode: optionalText,
    itemName: z.string().trim().min(1, "Item name is required."),
    description: optionalText,
    specifications: optionalText,
    quantity,
    unitPrice: money,
    unitCostSnapshot: money.optional(),
    unitCost: money.optional(),
    discountType: z.enum(["FIXED_AMOUNT", "PERCENTAGE"]).optional(),
    discountValue: money.optional(),
    customerNotes: optionalText,
    internalNotes: optionalText,
    images: z.array(quotationImageSchema).default([])
  })
  .superRefine((value, context) => {
    if (value.itemType === "CATALOG_PRODUCT" && !value.productId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Catalog items need a product reference.",
        path: ["productId"]
      });
    }

    if (value.discountType === "PERCENTAGE" && (value.discountValue ?? 0) > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percentage discounts cannot exceed 100.",
        path: ["discountValue"]
      });
    }
  });

export const createQuotationSchema = z
  .object({
    customerId: z.string().uuid("Choose a customer."),
    inquiryId: optionalText,
    quotationDiscountType: z.enum(["FIXED_AMOUNT", "PERCENTAGE"]).optional(),
    quotationDiscountValue: money.optional(),
    needsAssembly: formBoolean.default(false),
    salesInvoiceRequested: formBoolean.default(false),
    modeOfDelivery: optionalTextMax(255, "Mode of delivery is too long."),
    deliveryMethod: optionalTextMax(255, "Delivery method is too long."),
    paymentTerms: optionalTextMax(1000, "Payment terms must be 1000 characters or fewer."),
    specialInstructions: optionalTextMax(
      1000,
      "Remarks or special instructions must be 1000 characters or fewer."
    ),
    customerNotes: optionalText,
    internalNotes: optionalText,
    items: z.array(quotationItemSchema).min(1, "Add at least one quotation item.")
  })
  .superRefine((value, context) => {
    if (
      value.quotationDiscountType === "PERCENTAGE" &&
      (value.quotationDiscountValue ?? 0) > 100
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Quotation percentage discounts cannot exceed 100.",
        path: ["quotationDiscountValue"]
      });
    }
  });

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type QuotationItemInput = z.infer<typeof quotationItemSchema>;
