# Approved Quotation to Order / POS Workflow Phase

## Phase Goal

Create the internal workflow that converts an approved quotation into an order, making the order the central operational record for payments, balances, delivery scheduling, documents, and sales history.

This phase must preserve the negotiated quotation details while allowing Furniture Odyssey staff to manage real-world order operations after customer approval. It must not introduce ecommerce checkout, cashier/POS hardware behavior, barcode workflows, inventory reservation, or required inventory availability checks.

## Primary Users

- Admin
- Staff

## Core Principles

- An order is the operational record after a customer approves a quotation.
- In the current quotation status model, an approved quotation maps to `ACCEPTED`.
- Approved quotation details must be copied into order snapshots so historical orders do not change when quotations or catalog products are edited later.
- Orders preserve customer details, selected contact/address context, items, quantities, prices, discounts, notes, and totals from the approved quotation.
- Staff can manually create an order when a sale does not start from a quotation, if they have permission.
- Order creation must not require inventory availability, stock reservation, barcode scanning, cashier sessions, or hardware integration.
- Order items remain manually editable according to order status and permissions.
- One order can have multiple payments.
- One order can have multiple deliveries.
- Partial payments and partial deliveries are supported.
- Payment, balance, delivery, document, and sales history views must use saved order data, not mutable quotation or product records.
- Sensitive payment, cost, profit, and financial summary data must be permission-controlled.
- Generated PDFs and uploaded document media must use Cloudinary metadata references in PostgreSQL.

## In Scope

- Convert an approved quotation into one order.
- Prevent accidental duplicate order creation from the same quotation.
- Copy customer, quotation, item, price, discount, image, and note snapshots into order records.
- Optional manual order creation for direct sales or legacy/offline transactions.
- Order status planning for internal operations.
- Order header and item editing rules.
- Payment tab for recording multiple payments and calculating balances.
- Delivery tab for scheduling and tracking multiple deliveries.
- Documents tab for generated PDFs and uploaded document references.
- Relationships between quotations, orders, payments, deliveries, and PDFs.
- Sales history impact after order creation and payment/delivery progress.
- Permission checks for viewing, creating, updating, payment recording, delivery updates, document generation, and financial visibility.

## Out of Scope

- POS hardware support.
- Cash drawer, receipt printer, barcode scanner, or terminal integration.
- Cashier shift/session management.
- Ecommerce checkout, carts, online customer payment flows, or public customer portal.
- Required inventory availability checks before order creation.
- Stock reservation, stock deduction, warehouse allocation, or inventory-first fulfillment.
- Automated Facebook, Messenger, Viber, or payment gateway integration.
- Tax, VAT, withholding tax, service charge, or fee rules unless defined in a later accounting phase.
- Profit, commission, or cost reporting unless permission-controlled in a later financial phase.
- Final PDF visual layout decisions beyond storing the document data and metadata needed by future PDF generation.

## Data Model Plan

### Order

Represents the central operational sales record.

Recommended fields:

- `id`
- `orderNumber` nullable until numbering rules are defined
- `quotationId` nullable, unique when present
- `customerId`
- `inquiryId` nullable
- `status` enum: `DRAFT`, `CONFIRMED`, `PARTIALLY_PAID`, `PAID`, `SCHEDULED_FOR_DELIVERY`, `PARTIALLY_DELIVERED`, `DELIVERED`, `COMPLETED`, `CANCELLED`
- `paymentStatus` enum: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `REFUNDED`, `PARTIALLY_REFUNDED`
- `deliveryStatus` enum: `NOT_SCHEDULED`, `SCHEDULED`, `PARTIALLY_DELIVERED`, `DELIVERED`, `CANCELLED`
- `currency` default `PHP`
- `customerDisplayNameSnapshot`
- `customerTypeSnapshot`
- `companyNameSnapshot` nullable
- `contactPersonNameSnapshot` nullable
- `primaryContactSnapshot` nullable JSON or structured fields
- `billingAddressSnapshot` nullable JSON or structured fields
- `deliveryAddressSnapshot` nullable JSON or structured fields
- `subtotalAmount`
- `itemDiscountTotal`
- `orderDiscountType` nullable enum: `FIXED_AMOUNT`, `PERCENTAGE`
- `orderDiscountValue` nullable decimal
- `orderDiscountAmount`
- `totalAmount`
- `paidAmount`
- `balanceAmount`
- `customerNotes` nullable long text
- `internalNotes` nullable long text
- `sourceType` enum: `QUOTATION`, `MANUAL`
- `confirmedAt` nullable
- `cancelledAt` nullable
- `completedAt` nullable
- `createdById` nullable relation to `UserProfile`
- `updatedById` nullable relation to `UserProfile`
- `createdAt`
- `updatedAt`

Indexes:

- `quotationId`
- `customerId`
- `inquiryId`
- `status`
- `paymentStatus`
- `deliveryStatus`
- `sourceType`
- `createdById`
- `createdAt`
- `updatedAt`

Rules:

- `quotationId` is nullable because manual orders are allowed.
- `quotationId` should be unique when present so one quotation cannot create multiple converted orders.
- Orders created from quotations copy quotation totals and item snapshots at conversion time.
- Orders do not depend on live product catalog details after creation.
- `paidAmount` and `balanceAmount` are recalculated server-side from saved payments.
- `paymentStatus` and `deliveryStatus` may drive the display of the main `status`, but they should remain separately queryable.
- Cancelled orders should not be deleted; they remain part of customer and sales history.

### OrderItem

Represents each item included in the order.

Recommended fields:

- `id`
- `orderId`
- `quotationItemId` nullable
- `productId` nullable
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

- `orderId`
- `quotationItemId`
- `productId`
- `itemType`
- `sortOrder`

Rules:

- `quotationItemId` is nullable because manual orders may not have quotations.
- `productId` is nullable so custom/manual items remain first-class.
- Quotation conversion copies quotation item fields into order item fields.
- Later quotation edits must not mutate the order.
- Later product edits must not mutate the order.
- Staff may edit order items only while the order is still editable under the rules in this phase.
- Line totals must not go below zero.

### OrderItemImage

Stores image references used by order items and future order documents.

Recommended fields:

- `id`
- `orderItemId`
- `sourceQuotationItemImageId` nullable relation to `QuotationItemImage`
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
- When converting from a quotation, copy quotation item image metadata into order item image records.
- Future PDFs must read order item images for order documents, not live quotation or product image records.

### Payment

Represents a payment made against an order.

Recommended fields:

- `id`
- `orderId`
- `paymentNumber` nullable until numbering rules are defined
- `status` enum: `RECORDED`, `VOIDED`, `REFUNDED`
- `paymentDate`
- `amount`
- `method` enum or text: `CASH`, `BANK_TRANSFER`, `GCASH`, `CHECK`, `CARD`, `OTHER`
- `referenceNumber` nullable
- `payerName` nullable
- `notes` nullable long text
- `receivedById` nullable relation to `UserProfile`
- `voidedAt` nullable
- `voidedById` nullable relation to `UserProfile`
- `createdAt`
- `updatedAt`

Indexes:

- `orderId`
- `status`
- `paymentDate`
- `method`
- `receivedById`
- `createdAt`

Rules:

- One order can have many payments.
- Payments can be partial.
- The sum of non-voided payment amounts determines `paidAmount`.
- `balanceAmount = max(order totalAmount - paidAmount, 0)`.
- Overpayment behavior should be blocked by default unless Admin explicitly allows an exception.
- Voiding a payment should preserve the original record and update order balances.
- Payment records should be visible only to users with payment/financial permissions.

### Delivery

Represents one delivery schedule or delivery attempt for an order.

Recommended fields:

- `id`
- `orderId`
- `status` enum: `PLANNED`, `SCHEDULED`, `IN_TRANSIT`, `PARTIALLY_DELIVERED`, `DELIVERED`, `FAILED`, `CANCELLED`
- `scheduledDate` nullable
- `scheduledTimeWindow` nullable text
- `deliveryAddressSnapshot` nullable JSON or structured fields
- `recipientName` nullable
- `recipientPhone` nullable
- `deliveryNotes` nullable long text
- `internalNotes` nullable long text
- `assignedStaffId` nullable relation to `UserProfile`
- `deliveredAt` nullable
- `cancelledAt` nullable
- `createdById` nullable relation to `UserProfile`
- `updatedById` nullable relation to `UserProfile`
- `createdAt`
- `updatedAt`

Indexes:

- `orderId`
- `status`
- `scheduledDate`
- `assignedStaffId`
- `createdAt`

Rules:

- One order can have many deliveries.
- Delivery creation does not require inventory reservation.
- Delivery records should snapshot the address and recipient details used for that delivery.
- Delivery status contributes to the order's `deliveryStatus`.
- Partial deliveries are supported through delivery line records.

### DeliveryItem

Represents which order items and quantities are included in a delivery.

Recommended fields:

- `id`
- `deliveryId`
- `orderItemId`
- `quantityPlanned`
- `quantityDelivered`
- `notes` nullable long text
- `createdAt`
- `updatedAt`

Indexes:

- `deliveryId`
- `orderItemId`

Rules:

- Delivery item quantities cannot exceed the remaining undelivered quantity for the related order item unless Admin explicitly overrides.
- The system calculates delivered and remaining quantities from non-cancelled delivery records.
- Partial delivery progress should be visible on the order detail page.

### OrderDocument

Represents generated PDFs or uploaded document references connected to an order.

Recommended fields:

- `id`
- `orderId`
- `quotationId` nullable
- `paymentId` nullable
- `deliveryId` nullable
- `documentType` enum: `QUOTATION_PDF`, `ORDER_CONFIRMATION`, `INVOICE`, `OFFICIAL_RECEIPT`, `ACKNOWLEDGEMENT_RECEIPT`, `DELIVERY_RECEIPT`, `OTHER`
- `status` enum: `DRAFT`, `GENERATED`, `VOIDED`
- `title`
- `cloudinaryPublicId` nullable
- `secureUrl` nullable
- `resourceType` nullable
- `format` nullable
- `bytes` nullable
- `generatedAt` nullable
- `generatedById` nullable relation to `UserProfile`
- `notes` nullable long text
- `createdAt`
- `updatedAt`

Indexes:

- `orderId`
- `quotationId`
- `paymentId`
- `deliveryId`
- `documentType`
- `status`
- `createdAt`

Rules:

- Documents belong primarily to the order once an order exists.
- Payment receipts may link to both an order and a specific payment.
- Delivery receipts may link to both an order and a specific delivery.
- Generated PDFs should read order, payment, and delivery snapshots.
- Store PDF/media references and metadata only; do not store binary files in PostgreSQL.

## Quotation to Order Conversion Rules

1. Only an approved quotation with status `ACCEPTED` can be converted into an order by default.
2. The conversion action requires `ORDERS:CREATE` and quotation view access.
3. If a quotation already has an active order, show the existing order instead of creating another.
4. The system creates the order and all order items inside one database transaction.
5. The order copies customer identity, contact, address, quotation totals, item details, discounts, notes, and image metadata.
6. The source quotation remains unchanged after conversion.
7. The source inquiry, when present, may move to `CONVERTED_TO_ORDER`.
8. The order starts with `paymentStatus = UNPAID` and `deliveryStatus = NOT_SCHEDULED`.
9. The order starts with `status = CONFIRMED` when created from an approved quotation.
10. Payment and delivery records are added after order creation.

## Manual Order Creation Rules

- Manual order creation is allowed for direct sales, offline sales, repeat orders, or legacy records.
- Manual orders require a customer.
- Manual orders can use catalog-backed or custom/manual items.
- Manual order item prices, discounts, notes, and images are editable at creation.
- Manual orders use the same order, payment, delivery, and document tabs as quotation-based orders.
- Manual order creation requires `ORDERS:CREATE`.
- Manual order creation must not require a quotation or inventory availability.

## Order Status Planning

Recommended main order statuses:

- `DRAFT`: Manual order is being prepared and is not yet operational.
- `CONFIRMED`: Order is active and ready for payments, delivery planning, and documents.
- `PARTIALLY_PAID`: At least one valid payment exists, but balance remains.
- `PAID`: Valid payments cover the full order total.
- `SCHEDULED_FOR_DELIVERY`: At least one active delivery is scheduled.
- `PARTIALLY_DELIVERED`: Some, but not all, ordered quantities have been delivered.
- `DELIVERED`: All ordered quantities have been delivered.
- `COMPLETED`: Admin marks the order operationally complete.
- `CANCELLED`: Order is cancelled but retained for history.

Status rules:

- Payment status and delivery status should be stored separately from the main order status.
- The UI can show combined badges such as "Confirmed / Partially paid / Scheduled."
- Payment updates should recalculate payment status.
- Delivery updates should recalculate delivery status.
- Completion should require Admin permission by default.
- Cancelled orders should block new payments, new deliveries, and new generated documents unless Admin reopens or duplicates the order.

## Order Detail Editing Rules

- Customer snapshot fields can be edited before the order is completed or cancelled.
- Order item names, descriptions, specifications, quantities, unit prices, discounts, images, and notes can be edited while the order has no payments and no delivery records.
- After payments exist, price and discount changes require Admin permission and must recalculate balances.
- After deliveries exist, quantity reductions below delivered quantity are blocked.
- After generated documents exist, Staff should be warned before edits that would make documents stale.
- Completed orders are read-only except for Admin notes, document uploads, or explicit Admin reopen behavior in a later phase.
- Cancelled orders are read-only except for cancellation notes and document history.
- Internal notes remain editable by permitted users while the order is not archived.
- Customer-facing notes affect future documents and should be tracked carefully after documents are generated.

## Permissions Plan

Use the existing role and permission model.

Recommended permissions:

- Admin can view, create, update, cancel, complete, and manage all orders.
- Staff can view orders assigned to them or related to customers/inquiries they can access.
- Staff can convert approved quotations to orders when they have `ORDERS:CREATE`.
- Staff can manually create orders when they have `ORDERS:CREATE`.
- Staff can update editable order details when they have `ORDERS:UPDATE`.
- Payment recording requires `PAYMENTS:CREATE`.
- Payment voiding or refund marking requires Admin or elevated payment permission.
- Delivery scheduling requires `DELIVERIES:CREATE`.
- Delivery status updates require `DELIVERIES:UPDATE`.
- Document generation requires `DOCUMENTS:CREATE` or `DOCUMENTS:EXPORT`.
- Sales history visibility requires `SALES_HISTORY:VIEW`.
- Sensitive financial summaries require explicit payment or financial visibility permission.

Implementation notes:

- Gate order list/detail under `ORDERS:VIEW`.
- Gate quotation conversion under `ORDERS:CREATE` plus the quotation status rule.
- Gate payment tab visibility under `PAYMENTS:VIEW`.
- Gate delivery tab visibility under `DELIVERIES:VIEW`.
- Gate documents tab visibility under `DOCUMENTS:VIEW`.
- Hide cost, margin, profit, and sensitive financial summaries unless a later financial permission explicitly allows them.

## Staff Workflow

### Convert Approved Quotation to Order

1. Staff opens an approved quotation.
2. Staff chooses "Convert to order."
3. The system checks quotation status, duplicate order prevention, and permissions.
4. Staff reviews customer, contact, delivery address, items, discounts, totals, and notes.
5. Staff confirms conversion.
6. The system creates the order, order items, image snapshots, and source links in one transaction.
7. The order detail page opens as the central operational record.
8. Staff records payments, schedules deliveries, and generates documents from the order.

### Manual Order

1. Staff opens Orders and chooses "New order."
2. Staff selects an existing customer.
3. Staff adds catalog-backed or custom/manual items.
4. Staff edits item details, quantities, unit prices, discounts, images, and notes.
5. The system calculates totals server-side.
6. Staff saves the order as draft or confirms it.
7. Once confirmed, Staff manages payments, deliveries, and documents from the order detail page.

## UI Plan

### Order List

- Orders page acts as the operational control center for open and historical orders.
- Header action launches a new order panel for approved quotation conversion or manual order creation when the user has `ORDERS:CREATE`.
- Search supports order number, customer/company/contact values, item names/product codes, inquiry source references, and permission-safe payment or delivery provider references.
- Primary filters cover order status, payment status, and delivery status.
- Quick filters cover unfinished orders, orders with balances, scheduled deliveries, and orders needing action.
- More filters cover assigned staff, created date range, balance state, and scheduled delivery state according to the user's permissions.
- Order summaries show customer context, staff/source context, status badges, payment/delivery summaries when permitted, and the next practical action.
- Pagination preserves the active search and filter state.

### Order Header

- Customer snapshot summary.
- Source quotation link when applicable.
- Source inquiry link when applicable.
- Main status, payment status, and delivery status badges.
- Totals summary: subtotal, discounts, total, paid, and balance.
- Customer-facing notes.
- Internal notes.
- Actions based on permissions: edit, cancel, complete, generate document.

### Items Section

- Order item table with item name, description/spec summary, quantity, unit price, discount, line total, and delivery progress.
- Item image thumbnails from order item image snapshots.
- Add/edit/remove item actions only when allowed by editing rules.
- Clear warning when edits may affect payment balance or previously generated documents.

### Payment Tab

- Payment summary: total amount, paid amount, balance amount, payment status.
- Payment list with date, amount, method, reference number, received by, status, and notes.
- Add payment action with amount, method, date, reference number, payer name, and notes.
- Void payment action for permitted users.
- Optional receipt document links for each payment.
- Do not expose payment details to users without payment permissions.

### Delivery Tab

- Delivery summary: delivery status, scheduled deliveries, delivered quantities, remaining quantities.
- Delivery list with schedule, address, recipient, status, assigned staff, and notes.
- Delivery item breakdown by order item quantity.
- Add delivery action with schedule, address snapshot, recipient, notes, and selected item quantities.
- Update delivery status action for permitted users.
- Optional delivery receipt document links for each delivery.

### Documents Tab

- Document list with type, title, status, generated/uploaded date, generated by, and related payment/delivery where applicable.
- Generate order confirmation, invoice, receipt, and delivery receipt actions when supported.
- Upload or attach external document references when needed.
- Document records store Cloudinary metadata and link back to the order.
- Regenerating a document should create a new document record or version, not silently overwrite history.

### Current Order Workspace Implementation Notes

- Current order details are presented as focused sections for overview, items, payments, deliveries, documents, and notes.
- Payment and delivery action forms open inline from the related section when the user has the required permission.
- Users without payment visibility see restricted payment panels instead of totals, balances, cost, profit, or payment history.
- Users without delivery visibility see restricted delivery panels instead of schedules, delivery provider data, recipient details, and delivery progress.
- PDF links remain permission-gated and use the existing document export checks.

## Calculation Rules

- `lineSubtotal = quantity * unitPrice`
- Fixed item discount amount equals the entered fixed discount value.
- Percentage item discount amount equals `lineSubtotal * percentage / 100`.
- `lineTotal = max(lineSubtotal - itemDiscountAmount, 0)`
- `subtotalAmount = sum(lineSubtotal for all items)`
- `itemDiscountTotal = sum(item discount amounts)`
- Order-level fixed discount equals the entered fixed discount value.
- Order-level percentage discount is calculated against the post-item-discount amount.
- `totalAmount = max(sum(lineTotal for all items) - orderDiscountAmount, 0)`
- `paidAmount = sum(non-voided payment amounts)`
- `balanceAmount = max(totalAmount - paidAmount, 0)`
- Use decimal-safe money handling on the server.
- Server-side calculation is authoritative; client-side calculation is only for responsive UI feedback.

## Validation Rules

- Quotation conversion requires quotation status `ACCEPTED`.
- A quotation can have at most one active converted order.
- Manual orders require a customer.
- Confirmed orders require at least one order item.
- Custom/manual items require an item name.
- Catalog-backed items require a copied item name snapshot.
- Quantity must be greater than zero.
- Unit price must be greater than or equal to zero.
- Discount values must be greater than or equal to zero.
- Percentage discounts must not exceed 100.
- Fixed item discount must not exceed that item's line subtotal.
- Order-level fixed discount must not exceed the post-item-discount total.
- Payment amount must be greater than zero.
- Payment amount must not exceed remaining balance unless Admin override is explicitly implemented.
- Delivery item quantity must be greater than zero.
- Delivery item quantity cannot exceed remaining undelivered quantity unless Admin override is explicitly implemented.
- Cloudinary document records must include at least a public ID and secure URL when a generated or uploaded file exists.

## Relationship Plan

- A customer can have many quotations.
- A customer can have many orders.
- A quotation can have zero or one converted order.
- An order can optionally come from one quotation.
- An order can optionally keep the originating inquiry link through the quotation or directly.
- An order has many order items.
- Order items may optionally reference quotation items.
- Order items may optionally reference catalog products.
- An order has many payments.
- An order has many deliveries.
- A delivery has many delivery items.
- A delivery item belongs to one order item.
- An order has many documents.
- Documents may optionally relate to a quotation, payment, or delivery.
- Sales history should primarily read from orders, payments, deliveries, and documents after conversion.

## Reporting Impact

- Sales history begins at confirmed order creation, not at quotation draft creation.
- Order totals should use saved order item values and order discounts.
- Payment reports should use saved payment records.
- Balance reports should use order total minus valid payments.
- Delivery reports should use delivery and delivery item records.
- Product-linked order items can support future sales by product reference.
- Custom/manual items remain reportable without forcing catalog creation.
- Quotation conversion rates can compare approved quotations against created orders.
- Cost, margin, profit, and commission reporting remain permission-controlled and outside this phase unless separately planned.

## Acceptance Criteria

- Staff can convert an approved quotation into an order.
- The system prevents duplicate converted orders from the same quotation.
- Converted orders preserve customer details, item details, quantities, prices, discounts, notes, totals, and images as order snapshots.
- Manual order creation is available for permitted users without requiring a quotation.
- Order creation does not require inventory availability, reservation, barcode scanning, cashier support, or ecommerce checkout.
- The order detail page becomes the central place for items, payments, deliveries, documents, and history.
- One order can have multiple payments.
- Partial payments update paid amount, balance, and payment status.
- One order can have multiple deliveries.
- Partial deliveries update delivery progress and delivery status.
- Documents can be linked to the order and optionally to specific payments or deliveries.
- Payment, delivery, and document tabs are permission-controlled.
- Order totals and balances are recalculated server-side before persistence.
- Historical orders do not change when source quotations or catalog products are edited later.

## Implementation Sequence

1. Add Prisma enums and models for orders, order items, order item images, payments, deliveries, delivery items, and order documents.
2. Add relations from customers, inquiries, quotations, products, quotation items, product images, and users to the new order records.
3. Add activity log actions for order creation/update, quotation conversion, payment recording, delivery scheduling, and document generation.
4. Add Zod schemas for order conversion, manual order creation, order item editing, payments, deliveries, delivery items, and documents.
5. Add server-side calculation helpers for order totals, payment totals, balances, and delivery progress.
6. Add a transactional server action to convert approved quotations into orders.
7. Add duplicate conversion protection with a unique nullable quotation-to-order relation.
8. Add server actions for manual order create/update and order detail fetch.
9. Add server actions for payment create, void, and payment summary recalculation.
10. Add server actions for delivery create/update and delivery progress recalculation.
11. Add server actions for document metadata creation and document list retrieval.
12. Build order list and order detail pages.
13. Build the order items section with editing rules.
14. Build payment, delivery, and documents tabs.
15. Add permission checks for orders, payments, deliveries, documents, and sales history.
16. Update quotation detail UI to show "Convert to order" only for approved quotations and permitted users.
17. Update inquiry status when related quotations convert to orders.
18. Add tests for conversion snapshots, duplicate prevention, calculations, permissions, payment balances, delivery progress, and document relationships.

## Future Extensions

- Order number generation once numbering rules are defined.
- React-PDF layouts for quotations, invoices, receipts, and delivery receipts.
- Document versioning and stale-document warnings.
- Admin reopen workflow for completed or cancelled orders.
- Optional inventory visibility that does not block order creation.
- Optional stock deduction after delivery confirmation in a later inventory phase.
- Payment gateway integrations.
- Customer portal order status tracking.
- Staff commission or sales performance reporting.
- Profit and margin reporting with explicit financial permissions.
