import { z } from "zod";
import { quotationImageSchema } from "@/lib/validation/quotations";

const nullableStringInput = z.preprocess((value) => {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);
}, z.string());

const optionalText = nullableStringInput
  .pipe(z.string().trim())
  .transform((value) => (value.length ? value : undefined))
  .optional();

const optionalTextMax = (max: number, message: string) =>
  nullableStringInput
    .pipe(z.string().trim().max(max, message))
    .transform((value) => (value.length ? value : undefined))
    .optional();

const optionalTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time.")
  .optional()
  .or(z.literal("").transform(() => undefined));

const formBoolean = z.preprocess(
  (value) => value === true || value === "true" || value === "on" || value === "1" || value === "yes",
  z.boolean()
);

const money = z.coerce
  .number({
    invalid_type_error: "Enter a valid amount."
  })
  .min(0, "Amount cannot be negative.");

const positiveMoney = z.coerce
  .number({
    invalid_type_error: "Enter a valid amount."
  })
  .gt(0, "Amount must be greater than zero.");

const quantity = z.coerce
  .number({
    invalid_type_error: "Enter a valid quantity."
  })
  .int("Quantity must be a whole number.")
  .gt(0, "Quantity must be greater than zero.");

const percentage = z.coerce
  .number({
    invalid_type_error: "Enter a valid percentage."
  })
  .min(0, "Percentage cannot be negative.")
  .max(100, "Percentage cannot exceed 100.");

export const orderImageSchema = quotationImageSchema.extend({
  sourceQuotationItemImageId: optionalText
});

export const orderItemSchema = z
  .object({
    id: optionalText,
    orderItemId: optionalText,
    quotationItemId: optionalText,
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
    requiresAssembly: formBoolean.optional(),
    discountType: z.enum(["FIXED_AMOUNT", "PERCENTAGE"]).optional(),
    discountValue: money.optional(),
    customerNotes: optionalText,
    internalNotes: optionalText,
    images: z.array(orderImageSchema).default([])
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

export const createManualOrderSchema = z
  .object({
    customerId: z.string().uuid("Choose a customer."),
    orderDiscountType: z.enum(["FIXED_AMOUNT", "PERCENTAGE"]).optional(),
    orderDiscountValue: money.optional(),
    needsAssembly: formBoolean.default(false),
    salesInvoiceRequested: formBoolean.default(false),
    paymentDueTiming: z.enum(["BEFORE_DELIVERY", "UPON_DELIVERY", "AFTER_DELIVERY"]).optional(),
    paymentDueDate: z.coerce.date().optional(),
    modeOfDelivery: optionalTextMax(255, "Mode of delivery is too long."),
    deliveryMethod: optionalTextMax(255, "Delivery method is too long."),
    paymentTerms: optionalTextMax(1000, "Payment terms must be 1000 characters or fewer."),
    specialInstructions: optionalTextMax(
      1000,
      "Remarks or special instructions must be 1000 characters or fewer."
    ),
    customerNotes: optionalText,
    internalNotes: optionalText,
    items: z.array(orderItemSchema).min(1, "Add at least one order item.")
  })
  .superRefine((value, context) => {
    if (value.orderDiscountType === "PERCENTAGE" && (value.orderDiscountValue ?? 0) > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Order percentage discounts cannot exceed 100.",
        path: ["orderDiscountValue"]
      });
    }
  });

export const convertQuotationToOrderSchema = z.object({
  quotationId: z.string().uuid("Choose an approved quotation.")
});

export const createPaymentSchema = z.object({
  orderId: z.string().uuid("Choose an order."),
  paymentType: z.enum([
    "DOWNPAYMENT",
    "PARTIAL_PAYMENT",
    "FINAL_PAYMENT",
    "DELIVERY_BALANCE_PAYMENT"
  ]),
  paymentDate: z.coerce.date({
    invalid_type_error: "Choose a payment date."
  }),
  amount: positiveMoney,
  method: z.enum(["CASH", "BANK_TRANSFER", "GCASH", "CHECK", "CARD", "OTHER"]).optional(),
  referenceNumber: optionalText,
  payerName: optionalText,
  customerNotes: optionalText,
  internalNotes: optionalText
});

export const updatePaymentDueTimingSchema = z.object({
  orderId: z.string().uuid("Choose an order."),
  paymentDueTiming: z.enum(["BEFORE_DELIVERY", "UPON_DELIVERY", "AFTER_DELIVERY"]).optional(),
  paymentDueDate: z.coerce.date().optional()
});

export const deliveryItemSchema = z
  .object({
    orderItemId: z.string().uuid("Choose an order item."),
    quantityPlanned: quantity,
    quantityDelivered: z.coerce.number().int("Delivered quantity must be a whole number.").min(0).default(0),
    notes: optionalText
  })
  .superRefine((value, context) => {
    if (value.quantityDelivered > value.quantityPlanned) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Delivered quantity cannot exceed planned quantity.",
        path: ["quantityDelivered"]
      });
    }
  });

export const updateOrderCustomerSchema = z.object({
  orderId: z.string().uuid("Choose an order."),
  customerId: z.string().uuid("Choose a customer.")
});

export const updateOrderItemsSchema = z
  .object({
    orderId: z.string().uuid("Choose an order."),
    orderDiscountType: z.enum(["FIXED_AMOUNT", "PERCENTAGE"]).optional(),
    orderDiscountValue: money.optional(),
    needsAssembly: formBoolean.default(false),
    assemblyFeeRate: money.default(100),
    salesInvoiceRequested: formBoolean.default(false),
    salesInvoiceFeePercentage: percentage.default(8),
    additionalFees: money.default(0),
    items: z.array(orderItemSchema).min(1, "Add at least one order item.")
  })
  .superRefine((value, context) => {
    if (!value.needsAssembly) {
      value.items.forEach((item) => {
        item.requiresAssembly = false;
      });
    }

    if (value.orderDiscountType === "PERCENTAGE" && (value.orderDiscountValue ?? 0) > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Order percentage discounts cannot exceed 100.",
        path: ["orderDiscountValue"]
      });
    }
  });

export const pdfDisplayRowSchema = z.object({
  id: nullableStringInput.pipe(z.string().trim()).optional(),
  label: nullableStringInput.pipe(z.string().trim().max(80, "PDF detail labels must be 80 characters or fewer.")),
  value: nullableStringInput.pipe(z.string().trim().max(200, "PDF detail values must be 200 characters or fewer."))
});

export const pdfDetailsSchema = z
  .preprocess((value) => {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value !== "string" || !value.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, z.array(pdfDisplayRowSchema).max(12, "PDF details can include up to 12 rows."))
  .transform((rows) =>
    rows
      .map((row, index) => ({
        id: row.id?.trim() || `row-${index + 1}`,
        label: row.label.trim(),
        value: row.value.trim()
      }))
      .filter((row) => row.label || row.value)
  )
  .superRefine((rows, context) => {
    rows.forEach((row, index) => {
      if (row.value && !row.label) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PDF detail label is required when a value is entered.",
          path: [index, "label"]
        });
      }

      if (row.label && !row.value) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PDF detail value is required when a label is entered.",
          path: [index, "value"]
        });
      }
    });
  });

export const createDeliverySchema = z
  .object({
    orderId: z.string().uuid("Choose an order."),
    assignedStaffId: z.string().uuid("Choose an assigned staff member.").optional(),
    scheduledDate: z.coerce.date({
      invalid_type_error: "Choose a scheduled date.",
      required_error: "Choose a scheduled date."
    }),
    scheduledStartTime: optionalTime,
    scheduledEndTime: optionalTime.transform(() => undefined),
    scheduledTimeWindow: optionalText,
    deliveryProviderType: z.enum(["IN_HOUSE", "CUSTOMER_PICKUP", "THIRD_PARTY", "OTHER"]).optional(),
    deliveryProviderName: optionalText,
    deliveryProviderReference: optionalText,
    recipientName: optionalText,
    recipientPhone: optionalText,
    deliveryAddress: optionalText,
    deliveryNotes: optionalText,
    pdfDetails: pdfDetailsSchema.default([]),
    internalNotes: optionalText,
    items: z.array(deliveryItemSchema).min(1, "Add at least one delivery item.")
  });

export const completeOrderSchema = z.object({
  orderId: z.string().uuid("Choose an order."),
  force: formBoolean.default(false)
});

export const cancelOrderSchema = z.object({
  orderId: z.string().uuid("Choose an order."),
  cancellationReason: optionalTextMax(1000, "Cancellation reason must be 1000 characters or fewer.")
});

export const deleteOrderSchema = z.object({
  orderId: z.string().uuid("Choose an order.")
});

export const updateDeliveryProgressItemSchema = z.object({
  deliveryItemId: z.string().uuid("Choose a delivery item."),
  quantityDelivered: z.coerce
    .number()
    .int("Delivered quantity must be a whole number.")
    .min(0, "Delivered quantity cannot be negative."),
  notes: optionalText
});

export const updateDeliveryProgressSchema = z.object({
  deliveryId: z.string().uuid("Choose a delivery."),
  status: z.enum(["SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED", "DELIVERED", "FAILED", "CANCELLED"]),
  deliveredAt: z.coerce.date().optional(),
  markAllDelivered: formBoolean.default(false),
  notes: optionalText,
  items: z.array(updateDeliveryProgressItemSchema).default([])
});

export const createOrderDocumentSchema = z
  .object({
    orderId: z.string().uuid("Choose an order."),
    paymentId: optionalText,
    deliveryId: optionalText,
    documentType: z.enum([
      "QUOTATION_PDF",
      "ORDER_CONFIRMATION",
      "INVOICE",
      "PAYMENT_RECEIPT",
      "OFFICIAL_RECEIPT",
      "ACKNOWLEDGEMENT_RECEIPT",
      "DELIVERY_RECEIPT",
      "FINAL_ORDER_SUMMARY",
      "OTHER"
    ]),
    title: z.string().trim().min(1, "Document title is required."),
    cloudinaryPublicId: optionalText,
    secureUrl: optionalText,
    resourceType: optionalText,
    format: optionalText,
    bytes: z.coerce.number().int().positive().optional(),
    notes: optionalText
  })
  .superRefine((value, context) => {
    if (value.cloudinaryPublicId && !value.secureUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Document URL is required when a Cloudinary public ID is provided.",
        path: ["secureUrl"]
      });
    }

    if (value.documentType === "PAYMENT_RECEIPT" && !value.paymentId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Payment receipts need a related payment.",
        path: ["paymentId"]
      });
    }

    if (value.documentType === "DELIVERY_RECEIPT" && !value.deliveryId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Delivery receipts need a related delivery.",
        path: ["deliveryId"]
      });
    }
  });

export type CreateManualOrderInput = z.infer<typeof createManualOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type UpdateOrderItemsInput = z.infer<typeof updateOrderItemsSchema>;
