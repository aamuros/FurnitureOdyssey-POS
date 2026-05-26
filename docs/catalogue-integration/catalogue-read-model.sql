-- Catalogue public read model reference.
--
-- This file documents safe public read views for the separate catalogue website.
-- It is a reference file only unless an admin-dashboard migration explicitly
-- applies these views.
--
-- Architecture notes:
-- - The admin dashboard owns Prisma, migrations, and writes.
-- - The catalogue should only have SELECT access to public-safe data.
-- - Do not create public INSERT, UPDATE, or DELETE policies.
-- - Admin writes happen through Prisma/server actions with permission checks.
-- - Do not create old catalogue tables.
-- - Do not create table_options.
-- - Do not create option_incompatibilities.
-- - Do not create a duplicate products table.

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
  p."websitePages" AS website_pages
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
