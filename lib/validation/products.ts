import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (value === null || value === undefined || value === "" ? undefined : value),
  z
    .string()
    .trim()
    .transform((value) => (value.length ? value : undefined))
    .optional()
);

const optionalMoney = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number({ invalid_type_error: "Enter a valid amount." }).min(0).optional()
);

const optionalInt = z.preprocess(
  (value) => (value === "" || value === null ? 0 : value),
  z.coerce.number().int().min(0).default(0)
);

const productCategory = z.preprocess((value) => {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "chair" || normalized === "chairs" || normalized === "stool" || normalized === "stools") {
    return "Chair";
  }

  if (normalized === "table" || normalized === "tables") {
    return "Table";
  }

  return "Others";
}, z.enum(["Chair", "Table", "Others"]));

const websitePage = z.enum(["home", "chairs", "tables", "collections"]);

export const productImageSchema = z.object({
  id: optionalText,
  cloudinaryPublicId: z.string().trim().min(1, "Image public ID is required."),
  secureUrl: z.string().trim().url("Image URL must be valid."),
  altText: optionalText,
  sortOrder: optionalInt,
  isPrimary: z.boolean().default(false)
});

const productFields = {
  code: optionalText,
  name: z.string().trim().min(1, "Product name is required."),
  category: productCategory,
  description: optionalText,
  specifications: optionalText,
  referencePrice: optionalMoney,
  referenceCost: optionalMoney,
  currency: z.string().trim().min(1).default("PHP"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  internalNotes: optionalText,
  isWebsiteVisible: z.boolean().default(false),
  websiteSortOrder: optionalInt,
  websitePages: z.array(websitePage).default([]),
  images: z.array(productImageSchema).default([])
};

function enforceSinglePrimaryImage<T extends { images: ProductImageInput[] }>(
  value: T,
  context: z.RefinementCtx
) {
  const primaryCount = value.images.filter((image) => image.isPrimary).length;

  if (primaryCount > 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only one product image can be primary.",
      path: ["images"]
    });
  }
}

export const createProductSchema = z
  .object(productFields)
  .superRefine(enforceSinglePrimaryImage);

export const updateProductSchema = z
  .object({
    productId: z.string().uuid("Choose a product to update."),
    ...productFields
  })
  .superRefine(enforceSinglePrimaryImage);

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductImageInput = z.infer<typeof productImageSchema>;
