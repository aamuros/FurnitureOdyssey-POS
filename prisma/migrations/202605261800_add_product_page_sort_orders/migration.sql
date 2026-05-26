ALTER TABLE "Product"
ADD COLUMN "websitePageSortOrders" JSONB NOT NULL DEFAULT '{}'::jsonb;

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
  ORDER BY pi."isPrimary" DESC, pi."sortOrder" ASC, pi."createdAt" ASC
  LIMIT 1
) primary_image ON true
WHERE p."isWebsiteVisible" = true
  AND p."status" = 'ACTIVE';

GRANT SELECT ON public.public_catalog_products TO anon, authenticated;
