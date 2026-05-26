-- Public catalogue read views.
--
-- The catalogue reads safe public data from these views instead of directly
-- querying admin tables. Admin writes still happen through Prisma/server actions.
-- Do not create old catalogue tables, table_options, option_incompatibilities,
-- or a duplicate products table.

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
  primary_image."altText" AS primary_image_alt
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

CREATE OR REPLACE VIEW public.public_catalog_product_images AS
SELECT
  pi."id",
  pi."productId" AS product_id,
  pi."secureUrl" AS secure_url,
  pi."altText" AS alt_text,
  pi."sortOrder" AS sort_order,
  pi."isPrimary" AS is_primary
FROM public."ProductImage" pi
INNER JOIN public."Product" p ON p."id" = pi."productId"
WHERE p."isWebsiteVisible" = true
  AND p."status" = 'ACTIVE';

CREATE OR REPLACE VIEW public.public_catalog_page_content AS
SELECT
  pc.id,
  pc.page,
  pc.section,
  pc.field_key,
  pc.field_value,
  pc.updated_at
FROM public.page_content pc;

CREATE OR REPLACE VIEW public.public_catalog_tags AS
SELECT
  t.id,
  t.name,
  t.created_at
FROM public.tags t;

CREATE OR REPLACE VIEW public.public_catalog_product_tags AS
SELECT
  pta.product_id,
  pta.tag_id,
  t.name AS tag_name
FROM public.product_tag_assignments pta
INNER JOIN public.tags t ON t.id = pta.tag_id
INNER JOIN public."Product" p ON p."id" = pta.product_id
WHERE p."isWebsiteVisible" = true
  AND p."status" = 'ACTIVE';

GRANT SELECT ON public.public_catalog_products TO anon, authenticated;
GRANT SELECT ON public.public_catalog_product_images TO anon, authenticated;
GRANT SELECT ON public.public_catalog_page_content TO anon, authenticated;
GRANT SELECT ON public.public_catalog_tags TO anon, authenticated;
GRANT SELECT ON public.public_catalog_product_tags TO anon, authenticated;
