# Product Reference Catalog for Quotations Phase

## Phase Goal

Create an internal product reference catalog that helps Admin and Staff prepare quotations faster while preserving Furniture Odyssey's negotiated sales workflow.

The catalog is a reusable reference source for product names, descriptions, optional reference prices, and Cloudinary-hosted images. It must not become ecommerce browsing, checkout, cart management, or inventory-first order creation.

## Primary Users

- Admin
- Staff

## Core Principles

- Products are references, not fixed sellable SKUs.
- Reference prices are optional and editable when used in quotations or orders.
- Staff can add catalog products to quotation line items, then override name, description, quantity, unit price, discount, and notes as needed.
- Custom/manual quotation items remain supported even when no catalog product exists.
- Inventory is not required to create a quotation or order in this phase.
- Product images are stored in Cloudinary; PostgreSQL stores only Cloudinary metadata and URLs.
- Inactive products stay available for historical quotation and order records but are hidden from normal product selection.

## In Scope

- Product reference records for internal use.
- Optional product code or short identifier for staff lookup.
- Product name, category, description, dimensions/specifications, notes, and tags.
- Optional reference price and optional reference cost fields.
- Permission-controlled access to sensitive cost/profit data.
- Cloudinary image metadata for product reference photos.
- Active/inactive catalog status.
- Product search/filtering for Admin and Staff while preparing quotations.
- Adding a product reference to a quotation item.
- Manual price override when a product is used in quotations or orders.
- Snapshotting product details into quotation/order items so historical documents do not change when the catalog changes.

## Out of Scope

- Public product listing pages.
- Ecommerce browsing experience.
- Customer-facing product detail pages.
- Carts, checkout, online payment flows, or customer accounts.
- Required inventory quantities, stock reservations, stock deductions, or warehouse tracking.
- Variant matrix management for ecommerce-style SKU selection.
- Automated Facebook, Messenger, or Viber product sync.
- Automated price enforcement.

## Data Model Plan

### Product

Represents the internal reference record.

Recommended fields:

- `id`
- `code` nullable, unique when present
- `name`
- `category` nullable text for MVP simplicity
- `description` nullable long text
- `specifications` nullable long text for dimensions, material, color, lead time, or inclusions
- `referencePrice` nullable decimal
- `referenceCost` nullable decimal, permission-protected
- `currency` default `PHP`
- `status` enum: `ACTIVE`, `INACTIVE`
- `internalNotes` nullable, permission-aware
- `createdById` nullable relation to `UserProfile`
- `updatedById` nullable relation to `UserProfile`
- `createdAt`
- `updatedAt`

Indexes:

- `status`
- `name`
- `code`
- `category`
- `createdAt`

### ProductImage

Stores Cloudinary references for product media.

Recommended fields:

- `id`
- `productId`
- `cloudinaryPublicId`
- `secureUrl`
- `resourceType`
- `format`
- `width`
- `height`
- `bytes`
- `altText` nullable
- `sortOrder`
- `isPrimary`
- `createdAt`
- `updatedAt`

Rules:

- Store Cloudinary identifiers, URLs, dimensions, and metadata only.
- Do not store binary image files in PostgreSQL.
- Allow multiple images per product.
- Use one primary image for search and quotation item selection.

### QuotationItem Product Reference

Quotation line items should support both catalog-backed and manual items.

Recommended fields for the quotation item model when quotations are implemented:

- `productId` nullable relation to `Product`
- `itemType` enum: `CATALOG_PRODUCT`, `CUSTOM_ITEM`
- `snapshotProductCode` nullable
- `snapshotProductName`
- `snapshotDescription` nullable
- `snapshotSpecifications` nullable
- `snapshotImageUrl` nullable
- `quantity`
- `unitPrice`
- `discountAmount` nullable
- `lineTotal`
- `staffNotes` nullable

Rules:

- `productId` is nullable so custom/manual items are first-class.
- Catalog data is copied into snapshot fields when selected.
- Staff can override copied fields before saving the quotation.
- Historical quotations must continue to show the quoted wording and pricing even if the product record later changes.

### OrderItem Product Reference

Order items should follow the same pattern as quotation items:

- nullable `productId`
- editable snapshot fields
- manually overridden final order price
- no required inventory dependency

When a quotation is converted to an order, copy the quotation item snapshots and final negotiated prices into order items.

## Permissions Plan

Use the existing role and permission model.

Recommended catalog permissions:

- Admin can view, create, update, deactivate, and reactivate catalog products.
- Staff can view active products and use them in quotations.
- Staff can create custom/manual quotation items without catalog permissions beyond quotation creation.
- Staff product editing should be configurable, but disabled by default unless Furniture Odyssey wants Staff to maintain the catalog.
- Reference cost and margin/profit-related fields must be hidden unless the user has financial visibility permission.

Implementation options:

- Add a `PRODUCTS` permission module if the catalog gets its own dashboard section.
- Otherwise, gate product selection under `QUOTATIONS:CREATE` and product maintenance under `SETTINGS:UPDATE` for MVP speed.

Preferred MVP approach:

- Add a dedicated `PRODUCTS` permission module because product maintenance is a reusable internal function and should not be hidden under Settings long term.

## Staff Quotation Workflow

1. Staff starts or edits a quotation for a customer inquiry.
2. Staff opens product search from the quotation item editor.
3. Staff searches by product name, code, category, tag, or description.
4. Staff selects an active product.
5. The system copies product name, description, specifications, primary image URL, and optional reference price into the quotation item.
6. Staff adjusts quantity, description, unit price, discount, and notes based on negotiation.
7. Staff can add custom/manual items in the same quotation.
8. Quotation totals use the final manually entered item prices, not enforced catalog reference prices.
9. PDF generation uses quotation snapshot fields, not live catalog fields.

## Admin Catalog Workflow

1. Admin opens Product Catalog.
2. Admin creates or edits a product reference record.
3. Admin adds descriptions, specifications, optional reference price, and optional reference cost.
4. Admin uploads one or more product images to Cloudinary.
5. The app stores Cloudinary metadata in PostgreSQL.
6. Admin marks products active or inactive.
7. Inactive products disappear from normal quotation product search but remain linked to historical quotation/order items.

## UI Plan

### Product Catalog List

- Table with product image thumbnail, code, name, category, reference price, status, and updated date.
- Search by name/code.
- Filters for status and category.
- Row actions for view/edit/deactivate/reactivate based on permissions.

### Product Form

- Product name required.
- Product code optional.
- Category optional.
- Description and specifications as multiline fields.
- Reference price optional.
- Reference cost visible only to permitted users.
- Image upload and image ordering.
- Active/inactive status control.

### Quotation Item Picker

- Compact searchable picker inside the quotation workflow.
- Show thumbnail, name, code, category, and reference price when available.
- Clearly allow "Add custom item" without choosing a product.
- After selection, item fields remain editable.

## Validation Rules

- Product name is required.
- Reference price is nullable and must be greater than or equal to zero when present.
- Reference cost is nullable and must be greater than or equal to zero when present.
- Product code is nullable but unique when provided.
- At least one quotation item field must identify the item: snapshot name for manual items or product snapshot name for catalog-backed items.
- Quotation and order item unit price must be editable and must not be overwritten automatically by later catalog changes.

## Reporting Impact

- Sales reports should use quotation/order item final prices, not catalog reference prices.
- Product reference links can support future reporting such as "sales by referenced product."
- Custom/manual items should remain reportable as manual lines without forcing them into the catalog.
- Cost/profit reporting must use permission checks and should not be part of this phase unless already planned for sales tracking.

## Acceptance Criteria

- Admin can maintain internal product reference records.
- Product records can include optional descriptions, specifications, optional reference prices, and Cloudinary image metadata.
- Products can be marked active or inactive.
- Staff can search active products while preparing a quotation.
- Staff can add a product to a quotation as a copied, editable line item.
- Staff can override item price and description after selecting a product.
- Staff can add custom/manual items without selecting a product.
- Historical quotation/order items keep their saved snapshots even when product records are edited or deactivated.
- No public ecommerce product browsing, carts, checkout, or inventory blocking is introduced.

## Implementation Sequence

1. Add Prisma enums and models for product catalog records and product images.
2. Add product permission module and default Admin/Staff permission behavior.
3. Create product validation schemas with Zod.
4. Create server actions for product list, create, update, image metadata save, and status changes.
5. Build Product Catalog dashboard list and form for Admin maintenance.
6. Build reusable product picker for quotation item creation.
7. Update quotation item schema during the quotations phase to support nullable `productId`, snapshot fields, and manual price override.
8. Ensure generated quotation PDFs read from quotation item snapshots.
9. Add tests for validation, permissions, and snapshot behavior once quotation models exist.

## Future Extensions

- Product tags as normalized records if search/filtering needs grow.
- Product categories as a managed table instead of plain text.
- Optional inventory context without blocking quotations or orders.
- Product image transformations through Cloudinary presets.
- Sales-by-product reference reporting.
- Bulk import from spreadsheet after catalog fields stabilize.
