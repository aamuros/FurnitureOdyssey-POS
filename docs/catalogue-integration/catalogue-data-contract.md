# Catalogue Data Contract

## Purpose

This document is for the separate public catalogue website. It explains which admin dashboard database tables or views the catalogue may read from the shared Supabase/Postgres database.

The admin dashboard remains the source of truth for product, image, page content, and tag data.

## Architecture

- Admin dashboard owns the Prisma schema, migrations, and all writes.
- Catalogue only reads from Supabase.
- Catalogue should not use Prisma.
- Catalogue should not run migrations.
- Catalogue should not write products, page content, tags, or product tag assignments.
- Catalogue cart stays client-side for now.
- Catalogue checkout or ordering continues through Messenger for now.

## Environment Variables

Example only:

```env
VITE_SUPABASE_URL="http://127.0.0.1:55521"
VITE_SUPABASE_PUBLISHABLE_KEY="<same value as admin NEXT_PUBLIC_SUPABASE_ANON_KEY>"
```

Do not put these in the catalogue:

- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_API_KEY`
- Any admin-only secret

## Data Sources

### Products

Canonical admin model: `Product`

Safe public fields:

- `id`
- `code`
- `name`
- `category`
- `description`
- `specifications`
- `referencePrice`
- `currency`
- `status`
- `isWebsiteVisible`
- `websiteSortOrder`
- `websitePages`

Public read view aliases:

- `website_sort_order`
- `website_pages`

Valid `websitePages` / `website_pages` page keys:

- `home`
- `chairs`
- `tables`
- `collections`

Catalogue filter rule:

- Only show products where `isWebsiteVisible = true`.
- Only show products where `status = ACTIVE`.
- Use `website_pages` to decide which visible products appear on Home, Chairs, Tables, and Collections.

Do not expose:

- `referenceCost`
- `internalNotes`
- `createdById`
- `updatedById`
- Customer, order, payment, delivery, quotation, or user data

### Product Images

Canonical admin model: `ProductImage`

Safe public fields:

- `id`
- `productId`
- `secureUrl`
- `altText`
- `sortOrder`
- `isPrimary`

Rules:

- Use the primary image first.
- Fallback to the lowest `sortOrder` image.
- If no image exists, catalogue should use its existing placeholder.

### Page Content

Table: `page_content`

Fields:

- `id`
- `page`
- `section`
- `field_key`
- `field_value`
- `updated_at`

Use this for:

- Home hero text
- Curator's pick text
- Honest materials section
- Featured story section
- Chairs page hero
- Tables page hero
- Collections page hero
- Catalogue section titles

If a value is missing, catalogue should use existing hardcoded fallback text.

### Tags

Table: `tags`

Fields:

- `id`
- `name`
- `created_at`

### Product Tag Assignments

Table: `product_tag_assignments`

Fields:

- `product_id`
- `tag_id`

Rules:

- A product can have multiple tags.
- A tag can belong to multiple products.
- Use this for catalogue filters.

## Recommended Supabase Client Functions

Centralize catalogue database reads in a file like:

```ts
src/lib/catalogue-data.ts
```

Recommended functions:

- `getCatalogueProducts()` - read visible, active products and their primary image fields.
- `getCatalogueProductImages()` - read public product images for visible, active products.
- `getPageContent(page: string)` - read page content rows for one page and map them by section and field key.
- `getTags()` - read tag IDs and names for filter controls.
- `getProductTagAssignments()` - read product-to-tag assignments for visible, active products.

## Query Safety Rules

- Do not use `select("*")`.
- Select only public-safe columns.
- Prefer public read views if available.
- Never expose cost, profit, or internal fields.
- Never expose the service role key.
- Do not run insert, update, or delete operations from the catalogue.

## UI Mapping

- `Product.name` -> card title
- `Product.referencePrice` -> displayed price
- `Product.description` -> card or detail description
- `Product.specifications` -> detail specifications
- `ProductImage.secureUrl` -> card or detail image
- `page_content` -> page text configuration
- `tags` and `product_tag_assignments` -> filters

## Local Development

Admin local Supabase uses:

- API URL like `http://127.0.0.1:55521`
- DB URL like `127.0.0.1:55522`

Catalogue should use only the API URL and the publishable/anon key. It should not connect directly to the database.
