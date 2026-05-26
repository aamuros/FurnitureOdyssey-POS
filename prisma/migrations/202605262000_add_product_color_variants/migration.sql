CREATE TABLE "ProductColorVariant" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "hex" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductColorVariant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProductColorVariant"
ADD CONSTRAINT "ProductColorVariant_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductImage"
ADD COLUMN "colorVariantId" UUID;

ALTER TABLE "ProductImage"
ADD CONSTRAINT "ProductImage_colorVariantId_fkey"
FOREIGN KEY ("colorVariantId") REFERENCES "ProductColorVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ProductColorVariant_productId_idx" ON "ProductColorVariant"("productId");
CREATE INDEX "ProductColorVariant_isActive_idx" ON "ProductColorVariant"("isActive");
CREATE INDEX "ProductColorVariant_sortOrder_idx" ON "ProductColorVariant"("sortOrder");
CREATE INDEX "ProductImage_colorVariantId_idx" ON "ProductImage"("colorVariantId");

CREATE OR REPLACE VIEW public.public_catalog_products AS
SELECT
  p."id",
  p."code",
  p."name",
  p."category",
  p."description",
  p."specifications",
  p."referencePrice" AS reference_price,
  p."currency",
  p."websiteSortOrder" AS website_sort_order,
  primary_image."secureUrl" AS primary_image_url,
  primary_image."altText" AS primary_image_alt,
  p."websitePages" AS website_pages,
  p."websitePageSortOrders" AS website_page_sort_orders
FROM public."Product" p
LEFT JOIN LATERAL (
  SELECT
    pi."secureUrl",
    pi."altText"
  FROM public."ProductImage" pi
  WHERE pi."productId" = p."id"
  ORDER BY
    CASE WHEN pi."colorVariantId" IS NULL AND pi."isPrimary" = true THEN 0 ELSE 1 END,
    pi."isPrimary" DESC,
    pi."sortOrder" ASC,
    pi."createdAt" ASC
  LIMIT 1
) primary_image ON true
WHERE p."isWebsiteVisible" = true
  AND p."status" = 'ACTIVE';

CREATE OR REPLACE VIEW public.public_catalog_product_images AS
SELECT
  pi."id",
  pi."productId" AS product_id,
  pi."secureUrl" AS secure_url,
  pi."altText" AS alt_text,
  pi."sortOrder" AS sort_order,
  pi."isPrimary" AS is_primary,
  pi."colorVariantId" AS color_variant_id
FROM public."ProductImage" pi
INNER JOIN public."Product" p ON p."id" = pi."productId"
LEFT JOIN public."ProductColorVariant" pcv ON pcv."id" = pi."colorVariantId"
WHERE p."isWebsiteVisible" = true
  AND p."status" = 'ACTIVE'
  AND (pcv."id" IS NULL OR pcv."isActive" = true);

CREATE OR REPLACE VIEW public.public_catalog_product_color_variants AS
SELECT
  pcv."id",
  pcv."productId" AS product_id,
  pcv."name",
  pcv."hex",
  pcv."sortOrder" AS sort_order,
  pcv."isActive" AS is_active
FROM public."ProductColorVariant" pcv
INNER JOIN public."Product" p ON p."id" = pcv."productId"
WHERE p."isWebsiteVisible" = true
  AND p."status" = 'ACTIVE'
  AND pcv."isActive" = true;

GRANT SELECT ON public.public_catalog_products TO anon, authenticated;
GRANT SELECT ON public.public_catalog_product_images TO anon, authenticated;
GRANT SELECT ON public.public_catalog_product_color_variants TO anon, authenticated;
