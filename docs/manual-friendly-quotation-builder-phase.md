# Manual-Friendly Quotation Builder Phase

## Phase Goal

Create an internal quotation builder that lets Admin and Staff prepare customer quotations from catalog references and custom/manual items while preserving Furniture Odyssey's negotiated sales workflow.

The builder must make quotation preparation structured without forcing ecommerce-style fixed pricing, inventory dependency, final PDF layout decisions, tax/VAT assumptions, quotation numbering rules, or validity period rules.

## Primary Users

- Admin
- Staff

## Core Principles

- Quotations are internal business records prepared by Staff for customers.
- Staff can select an existing customer before creating a quotation.
- Staff can optionally connect a quotation to a customer inquiry when the quotation comes from an inquiry.
- Catalog products are reusable references, not fixed-price sellable SKUs.
- Custom/manual quotation items are first-class and do not require a catalog product.
- Every quotation item remains editable after selection or creation.
- Quantity, unit price, description, discount, images, and notes reflect the negotiated quotation, not the live catalog record.
- Catalog details must be snapshotted into quotation items so historical quotations do not change when catalog records change.
- Item and quotation totals must be calculated from saved quotation data.
- Item images must use Cloudinary-hosted media references only.
- Quotation PDF generation is not part of this phase, but this phase must save the data a future PDF renderer needs.

## In Scope

- Customer selection for new quotations.
- Optional inquiry association when a quotation is created from an inquiry.
- Quotation draft creation and editing.
- Catalog item search and selection from active product reference records.
- Custom/manual quotation items without a product reference.
- Editable item name, description, specifications, quantity, unit price, discount, image, and notes.
- Manual unit price override for all items.
- Quotation-level discount support.
- Item-level discount support.
- Subtotal, discount, and total calculations.
- Quotation notes for customer-facing context.
- Internal staff notes for non-customer-facing context.
- Snapshot fields required for future quotation PDF generation.
- Permission checks for quotation view, create, and update behavior.

## Out of Scope

- Generating quotation PDFs.
- Final PDF visual layout.
- Tax, VAT, withholding tax, service charge, or fee rules.
- Quotation numbering format or sequence rules.
- Quotation validity periods or expiration rules.
- Customer portal quotation acceptance.
- Ecommerce checkout, carts, online payment, or public product browsing.
- Required inventory availability checks, stock reservations, or stock deductions.
- Automated Facebook, Messenger, or Viber integration.
- Automated pricing enforcement from the catalog.
- Cost, margin, or profit display in the quotation builder unless permission-controlled in a later financial phase.

## Data Model Plan

### Quotation

Represents the quotation header and customer context.

Recommended fields:

- `id`
- `customerId`
- `inquiryId` nullable
- `status` enum: `DRAFT`, `SENT`, `ACCEPTED`, `DECLINED`, `CANCELLED`
- `currency` default `PHP`
- `subtotalAmount`
- `itemDiscountTotal`
- `quotationDiscountType` nullable enum: `FIXED_AMOUNT`, `PERCENTAGE`
- `quotationDiscountValue` nullable decimal
- `quotationDiscountAmount`
- `totalAmount`
- `customerNotes` nullable long text
- `internalNotes` nullable long text
- `createdById` nullable relation to `UserProfile`
- `updatedById` nullable relation to `UserProfile`
- `createdAt`
- `updatedAt`

Indexes:

- `customerId`
- `inquiryId`
- `status`
- `createdById`
- `createdAt`
- `updatedAt`

Rules:

- A quotation must belong to one customer.
- `inquiryId` is optional because Staff may create quotations outside the inquiry workflow.
- Monetary totals are stored for reporting and document consistency.
- Totals must be recalculated server-side when quotation items or discounts change.
- Status names may be adjusted during implementation, but the MVP needs at least a draft state.

### QuotationItem

Represents each quoted line item.

Recommended fields:

- `id`
- `quotationId`
- `productId` nullable relation to `Product`
- `itemType` enum: `CATALOG_PRODUCT`, `CUSTOM_ITEM`
- `sortOrder`
- `snapshotProductCode` nullable
- `itemName`
- `description` nullable long text
- `specifications` nullable long text
- `quantity`
- `unitPrice`
- `discountType` nullable enum: `FIXED_AMOUNT`, `PERCENTAGE`
- `discountValue` nullable decimal
- `discountAmount`
- `lineSubtotal`
- `lineTotal`
- `customerNotes` nullable long text
- `internalNotes` nullable long text
- `createdAt`
- `updatedAt`

Indexes:

- `quotationId`
- `productId`
- `itemType`
- `sortOrder`

Rules:

- `productId` is nullable so custom/manual items are not second-class records.
- Catalog item selection copies product reference fields into editable quotation item fields.
- `itemName`, `description`, `specifications`, `quantity`, `unitPrice`, and discount fields are quotation-specific values.
- `lineSubtotal` is `quantity * unitPrice`.
- `discountAmount` is calculated from item discount fields.
- `lineTotal` is `lineSubtotal - discountAmount`.
- Line totals must not go below zero.
- Later catalog edits must not mutate saved quotation item wording, price, images, or calculations.

### QuotationItemImage

Stores image references used by quotation items.

Recommended fields:

- `id`
- `quotationItemId`
- `sourceProductImageId` nullable relation to `ProductImage`
- `cloudinaryPublicId`
- `secureUrl`
- `resourceType`
- `format`
- `width` nullable
- `height` nullable
- `bytes` nullable
- `altText` nullable
- `sortOrder`
- `isPrimary`
- `createdAt`
- `updatedAt`

Rules:

- Store Cloudinary identifiers, URLs, dimensions, and metadata only.
- Do not store image binaries in PostgreSQL.
- When a catalog item is selected, Staff can use the product primary image by default.
- Staff can remove, replace, or add item images for the quotation without changing the catalog product.
- Future PDFs must read quotation item image records, not live product image records.

### Quotation PDF Data Snapshot

This phase must save enough normalized data for a future PDF renderer.

Required future PDF data:

- Quotation customer display name.
- Customer contact values selected or relevant to the quotation.
- Customer address selected or relevant to the quotation, if Staff provides one.
- Quotation item order.
- Quotation item names.
- Quotation item descriptions and specifications.
- Quotation item images selected for the quotation.
- Quantities.
- Manual unit prices.
- Item discounts.
- Line totals.
- Quotation-level discount.
- Subtotal.
- Total.
- Customer-facing quotation notes.

Rules:

- Do not define final PDF layout in this phase.
- Do not assume tax/VAT rows unless a later phase defines tax behavior.
- Do not assume quotation numbering or validity dates unless a later phase defines them.
- PDF data must come from quotation snapshots and quotation records, not mutable live product fields.

## Permissions Plan

Use the existing role and permission model.

Recommended quotation permissions:

- Admin can view, create, update, cancel, and manage all quotations.
- Staff can view and create quotations.
- Staff can update quotations they created or are assigned to through the related customer/inquiry workflow.
- Staff can use active catalog products in quotations.
- Staff can add custom/manual quotation items.
- Staff can manually override unit prices and discounts.
- Cost, margin, and profit fields must not be shown in the quotation builder unless the user has financial visibility permission.

Implementation notes:

- Gate the quotation builder under `QUOTATIONS:CREATE` for new quotations.
- Gate quotation editing under `QUOTATIONS:UPDATE`.
- Gate quotation list/detail visibility under `QUOTATIONS:VIEW`.
- If product catalog permissions exist, Staff still needs only product view/search access to use active products in quotations.

## Staff Quotation Workflow

1. Staff opens Quotations or starts a quotation from a customer or inquiry.
2. Staff selects an existing customer.
3. Staff optionally links the quotation to an inquiry.
4. Staff adds a catalog item by searching active product references.
5. The system copies product code, name, description, specifications, primary image, and optional reference price into a quotation item.
6. Staff edits item wording, selected image, quantity, unit price, discount, and notes.
7. Staff adds custom/manual items when no catalog item fits the request.
8. Staff enters manual item name, description, optional image, quantity, unit price, discount, and notes.
9. The system recalculates item subtotals, item discounts, line totals, quotation subtotal, quotation discount, and quotation total.
10. Staff saves the quotation as a draft.
11. Staff can reopen the draft and continue editing until the quotation is ready for a later PDF/export phase.

## UI Plan

### Quotation List

- Table with customer name, status, total amount, created by, updated date, and created date.
- Search by customer name and item text when supported.
- Filters for status and assigned/created staff when supported.
- Row action to open quotation detail based on permissions.

### Quotation Header

- Customer selector with search by display name, company name, contact person, phone, Viber, Facebook, or email.
- Selected customer summary showing primary contact and default address when available.
- Optional inquiry selector scoped to the selected customer.
- Customer-facing notes field.
- Internal notes field.
- Status display.

### Quotation Item Builder

- Add catalog item action.
- Add custom item action.
- Reorder items.
- Remove item with confirmation.
- Item editor with name, description, specifications, quantity, unit price, discount type, discount value, notes, and image controls.
- Clear visual distinction between customer-facing notes and internal notes.
- Totals panel that updates from current item values.

### Catalog Item Picker

- Compact searchable picker inside the quotation builder.
- Search by product name, code, category, tags, and description when available.
- Show thumbnail, product name, code, category, and reference price when available.
- Hide inactive products from normal selection.
- Selecting a product creates an editable quotation item snapshot.

### Custom Item Form

- Item name required.
- Description optional.
- Specifications optional.
- Image optional.
- Quantity required.
- Manual unit price required.
- Discount optional.
- Customer notes optional.
- Internal notes optional.

### Item Images

- Default to copied product primary image when a catalog product is selected.
- Allow Staff to remove the copied image from the quotation item.
- Allow Staff to choose a different product image when multiple product images exist.
- Allow Staff to upload a quotation-specific Cloudinary image.
- Store image metadata against the quotation item.

### Totals Panel

- Show subtotal before discounts.
- Show item discount total.
- Show quotation-level discount.
- Show final total.
- Do not show tax/VAT lines in this phase.
- Do not show cost, margin, or profit by default.

## Calculation Rules

- `lineSubtotal = quantity * unitPrice`
- Fixed item discount amount equals the entered fixed discount value.
- Percentage item discount amount equals `lineSubtotal * percentage / 100`.
- `lineTotal = max(lineSubtotal - itemDiscountAmount, 0)`
- `subtotalAmount = sum(lineSubtotal for all items)`
- `itemDiscountTotal = sum(item discount amounts)`
- Quotation-level fixed discount equals the entered fixed discount value.
- Quotation-level percentage discount is calculated against the post-item-discount amount.
- `totalAmount = max(sum(lineTotal for all items) - quotationDiscountAmount, 0)`
- Use decimal-safe money handling on the server.
- Server-side calculation is authoritative; client-side calculation is only for responsive UI feedback.

## Validation Rules

- Customer is required.
- At least one quotation item is required before a quotation can be considered ready for later export.
- Custom/manual items require an item name.
- Catalog-backed items require a copied item name snapshot.
- Quantity must be greater than zero.
- Unit price must be greater than or equal to zero.
- Discount values must be greater than or equal to zero.
- Percentage discounts must not exceed 100.
- Fixed item discount must not exceed that item's line subtotal.
- Quotation-level fixed discount must not exceed the post-item-discount total.
- A quotation item can have zero price only when Staff intentionally enters zero, such as a free add-on or included item.
- Notes are optional.
- Images are optional.
- Cloudinary image records must include at least a public ID and secure URL.

## Reporting Impact

- Sales and quotation reports should use saved quotation totals, not live catalog prices.
- Product-linked quotation items can support future reporting by referenced product.
- Custom/manual items remain reportable as manual lines without forcing catalog creation.
- Discount reporting should distinguish item-level discounts from quotation-level discounts.
- Financial or profit reporting remains permission-controlled and out of this phase unless separately planned.

## Acceptance Criteria

- Staff can create a quotation for an existing customer.
- Staff can optionally link a quotation to a customer inquiry.
- Staff can search and add active catalog items to a quotation.
- Catalog selections create editable quotation item snapshots.
- Staff can add custom/manual quotation items without selecting a product.
- Staff can edit item names, descriptions, specifications, quantities, unit prices, discounts, images, and notes.
- Staff can apply item-level discounts.
- Staff can apply a quotation-level discount.
- The system calculates subtotal, item discounts, quotation discount, and total from saved quotation values.
- Quotation totals are recalculated server-side before persistence.
- Item images are stored as Cloudinary metadata references.
- Saved quotations preserve item snapshots even if product catalog records later change.
- The phase stores the data needed for future quotation PDF generation without generating the PDF.
- No tax/VAT, quotation numbering, validity period, checkout, customer portal, or inventory blocking behavior is introduced.

## Implementation Sequence

1. Add Prisma enums and models for quotations, quotation items, quotation item images, item type, status, and discount type.
2. Add relations from quotations to customers, inquiries, users, products, and product images where applicable.
3. Add Zod schemas for quotation header, item creation/update, discounts, notes, and image metadata.
4. Add server-side calculation helpers for item totals and quotation totals.
5. Add server actions for quotation create, update, item add, item update, item reorder, item remove, and quotation detail fetch.
6. Build customer selection inside the quotation create flow.
7. Build reusable quotation item editor for catalog-backed and custom/manual items.
8. Integrate the catalog item picker from the product reference phase.
9. Add quotation item image selection/upload metadata handling through Cloudinary.
10. Build the totals panel using client-side preview calculations backed by server-side recalculation on save.
11. Add quotation list and detail pages under the existing Quotations dashboard module.
12. Add permission checks for view, create, and update flows.
13. Add tests for validation, calculations, permissions, custom items, catalog snapshots, and image metadata persistence.

## Future Extensions

- Quotation PDF generation with React-PDF.
- Quotation number generation once numbering rules are defined.
- Validity dates once validity period rules are defined.
- Tax/VAT handling once accounting rules are defined.
- Approval flow for large discounts or sensitive pricing changes.
- Convert accepted quotations into orders.
- Version history for revised quotations.
- Duplicate quotation action for repeat customer requests.
- Customer-facing quotation send tracking.
