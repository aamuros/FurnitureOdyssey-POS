# Delivery Scheduling and Partial Delivery Handling Phase

## Phase Goal

Create the internal delivery scheduling workflow that lets Admin and Staff plan one or more deliveries for an order, assign order item quantities to each delivery, track partial delivery progress, and prepare delivery receipt data from saved order and delivery records.

This phase supports Furniture Odyssey's real-world fulfillment process where a single order may be delivered in batches, some items may be scheduled earlier than others, and Staff need a structured record for delivery address, provider, schedule, included items, and delivery receipt preparation.

This phase must not introduce Lalamove integration, AP Cargo integration, map APIs, route optimization, live tracking, calendar sync, inventory reservation, warehouse allocation, final delivery staff assignment rules, or final delivery status transition policy.

## Primary Users

- Admin
- Staff

## Core Principles

- One order can have multiple delivery records.
- One delivery can include one or more order items.
- One order item can be split across multiple deliveries.
- Partial deliveries are represented through delivery item quantities linked to order items.
- Delivery scheduling does not require the order to be fully paid.
- Delivery scheduling does not require inventory reservation or stock deduction in the MVP.
- Delivery records should snapshot the address and recipient details used for that delivery.
- Delivery provider selection is manual and informational in this phase.
- Delivery receipt PDF data must come from saved order, customer, delivery, delivery item, and document records.
- Delivery receipt data preparation is in scope, but final React-PDF visual layout is not.
- Delivery status names may use the previously planned enum values, but final status transitions and staff assignment rules are deferred.
- Sensitive payment, balance, cost, profit, and internal financial data must remain permission-controlled.

## In Scope

- Delivery scheduling from an existing order.
- Multiple deliveries per order.
- Partial delivery support by assigning quantities from order items.
- Delivery provider selection as a manual field.
- Delivery address snapshot per delivery.
- Scheduled delivery date.
- Optional scheduled time or time window when Staff has the detail.
- Recipient name and contact details for the delivery.
- Delivery items linked to order items.
- Planned quantity per delivery item.
- Delivered quantity tracking when updating delivery progress.
- Delivery status planning using already proposed status values only.
- Order-level delivery progress summary.
- Delivery list and delivery detail view from the order.
- Delivery receipt PDF data requirements.
- Delivery receipt document relationship planning.
- Permission checks for viewing, creating, updating deliveries, and preparing delivery receipt data.
- Activity/history entries for delivery scheduling and delivery updates.

## Out of Scope

- Lalamove integration.
- AP Cargo integration.
- Any delivery provider API integration.
- Map, geocoding, distance, route, or ETA APIs.
- Tracking APIs or customer-facing tracking links.
- Calendar sync.
- Automated dispatching.
- Final delivery staff assignment rules.
- Final delivery status transition rules beyond planning values.
- Inventory reservation, warehouse allocation, stock deduction, or required availability checks.
- Required full payment before scheduling delivery.
- Delivery fee calculation rules unless separately defined.
- Failed delivery fee, redelivery fee, return, exchange, or damage workflows.
- Customer portal delivery scheduling or self-service rescheduling.
- Final delivery receipt visual design.
- Legal receipt numbering, BIR/tax wording, or accounting compliance rules.

## Data Model Plan

### Delivery

Represents one scheduled delivery, delivery batch, or delivery attempt for an order.

Recommended fields:

- `id`
- `orderId`
- `deliveryNumber` nullable until numbering rules are defined
- `status` enum using previously planned values where available: `PLANNED`, `SCHEDULED`, `IN_TRANSIT`, `PARTIALLY_DELIVERED`, `DELIVERED`, `FAILED`, `CANCELLED`
- `scheduledDate`
- `scheduledTimeWindow` nullable text
- `deliveryProviderType` nullable enum or text: `IN_HOUSE`, `CUSTOMER_PICKUP`, `THIRD_PARTY`, `OTHER`
- `deliveryProviderName` nullable text
- `deliveryProviderReference` nullable text
- `deliveryAddressSnapshot` JSON or structured fields
- `recipientName` nullable
- `recipientPhone` nullable
- `deliveryNotes` nullable long text
- `internalNotes` nullable long text
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
- `deliveryProviderType`
- `createdById`
- `createdAt`

Rules:

- A delivery must belong to one order.
- Delivery creation requires at least one delivery item.
- `scheduledDate` is required for a scheduled delivery.
- `scheduledTimeWindow` is optional until Furniture Odyssey confirms whether exact time or time windows should be required.
- Delivery provider fields are manual records only and must not call external APIs.
- `deliveryAddressSnapshot` should copy the selected order/customer delivery address at scheduling time.
- Staff may edit the delivery address snapshot without changing the customer's saved default address.
- Recipient details are delivery-specific and may differ from the customer record.
- Delivery notes are customer-facing or receipt-relevant when appropriate.
- Internal notes must not appear on delivery receipts.
- This phase does not finalize assigned delivery staff rules; if an `assignedStaffId` field already exists, treat it as optional and non-blocking.
- Cancelled deliveries should remain in history and should not count toward delivered quantity.

### DeliveryItem

Represents which order item quantities are included in one delivery.

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

- A delivery item must belong to one delivery.
- A delivery item must link to one order item from the same order.
- `quantityPlanned` must be greater than zero.
- `quantityDelivered` defaults to zero until delivery progress is updated.
- `quantityPlanned` cannot exceed the remaining undelivered quantity for the order item unless Admin override is explicitly implemented.
- `quantityDelivered` cannot exceed `quantityPlanned` unless Admin override is explicitly implemented.
- Partial delivery is supported by assigning less than the order item quantity to a delivery.
- The same order item may appear in multiple deliveries as long as the total non-cancelled planned or delivered quantity does not exceed the ordered quantity.
- Delivery item notes may describe item-specific handling, packaging, color, size, or recipient instructions.

### Order Delivery Summary Fields

The order should expose delivery summary fields for list and detail views.

Recommended fields on `Order`:

- `deliveryStatus` enum using previously planned values: `NOT_SCHEDULED`, `SCHEDULED`, `PARTIALLY_DELIVERED`, `DELIVERED`, `CANCELLED`
- `firstScheduledDeliveryDate` nullable
- `lastScheduledDeliveryDate` nullable
- `deliveredItemCount` or calculated delivered quantity summary when useful
- `remainingDeliveryItemCount` or calculated remaining quantity summary when useful

Rules:

- `deliveryStatus` is recalculated server-side after delivery creation, update, cancellation, or delivery item quantity changes.
- If no active deliveries exist, `deliveryStatus = NOT_SCHEDULED`.
- If at least one active delivery exists and no quantities are delivered, `deliveryStatus = SCHEDULED`.
- If some but not all ordered quantities are delivered, `deliveryStatus = PARTIALLY_DELIVERED`.
- If all ordered quantities are delivered, `deliveryStatus = DELIVERED`.
- `CANCELLED` should be used only when order or delivery cancellation behavior is explicitly defined.
- Delivery summary calculations should ignore cancelled deliveries.
- Delivery summaries should use saved order item quantities and saved delivery item quantities.

### OrderDocument Delivery Receipt Link

Delivery receipt PDFs should be stored as order documents when generated.

Recommended fields already planned for `OrderDocument`:

- `id`
- `orderId`
- `deliveryId` nullable
- `documentType` enum includes `DELIVERY_RECEIPT`
- `status` enum: `GENERATED`
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

Rules:

- A delivery receipt document belongs to the order and should link to the specific delivery.
- Store generated delivery receipt PDF/media metadata only.
- Do not store PDF binaries in PostgreSQL.
- Delivery receipt documents should read saved delivery and order data, not live editable form state.
- This phase defines required delivery receipt data, not final receipt layout.

## Delivery Provider Planning

Provider selection should stay flexible for the MVP.

Recommended provider options:

- `IN_HOUSE`
- `CUSTOMER_PICKUP`
- `THIRD_PARTY`
- `OTHER`

Recommended manual fields:

- Provider type.
- Provider name.
- Provider reference number or note.
- Provider contact details only if Staff manually enters them.

Rules:

- Provider selection is optional unless Furniture Odyssey decides it is required operationally.
- Third-party provider names should be manually typed or selected from a simple internal list.
- Do not add provider-specific fields for Lalamove, AP Cargo, or any external delivery service in this phase.
- Do not store live tracking URLs, external status payloads, coordinates, or route data.
- Provider values should appear on internal delivery views and may appear on delivery receipt data when entered.

## Staff Delivery Workflow

### Schedule Delivery From Order

1. Staff opens an order detail page.
2. Staff opens the Deliveries tab.
3. The system shows order delivery status, ordered quantities, already scheduled quantities, delivered quantities, and remaining quantities.
4. Staff chooses "Add delivery."
5. Staff selects a delivery provider type and optionally enters provider name or reference.
6. Staff chooses the delivery address from the order/customer snapshot or enters a delivery-specific address.
7. Staff enters scheduled date.
8. Staff optionally enters scheduled time or time window when available.
9. Staff enters recipient name, recipient phone, customer-facing delivery notes, and internal notes when needed.
10. Staff selects one or more order items and enters quantities for this delivery.
11. The system validates that selected quantities do not exceed remaining deliverable quantities.
12. Staff saves the delivery.
13. The system creates the delivery and delivery item records, then recalculates order delivery summary fields.
14. The delivery appears in the order delivery list.
15. Staff may prepare delivery receipt data for that delivery when document generation is available.

### Schedule Partial Delivery

1. Staff opens an order with one or more undelivered order items.
2. Staff creates a delivery for only the items or quantities ready for delivery.
3. The system shows remaining quantities after the planned delivery.
4. Staff saves the partial delivery.
5. The order remains partially scheduled or partially delivered until all quantities are delivered.
6. Staff can schedule additional deliveries for remaining quantities later.

### Update Delivery Progress

1. Staff opens an existing delivery.
2. Staff updates delivery status using the currently allowed planning values.
3. Staff enters delivered quantities per delivery item when delivery progress is known.
4. The system validates delivered quantities against planned quantities.
5. The system recalculates order item delivery progress and order delivery status.
6. The delivery history records who made the update and when.

Rules:

- This phase plans status values but does not finalize every allowed transition.
- Updating delivered quantities should be permission-controlled.
- Delivery completion should not automatically complete the order unless a later phase defines completion rules.
- Delivery progress should not expose payment details to users without payment visibility permission.

## UI Plan

### Order Deliveries Tab

- Delivery summary with order delivery status, total ordered quantities, scheduled quantities, delivered quantities, and remaining quantities.
- Action to add a delivery for permitted users.
- Delivery list with scheduled date, optional time window, provider, address summary, recipient, status, and receipt status.
- Delivery item breakdown by order item.
- Empty state when no deliveries have been scheduled.
- Delivery receipt link when generated.
- Hide or restrict the tab for users without delivery visibility permission.

### Add Delivery Form

- Delivery provider type selector.
- Optional provider name field.
- Optional provider reference field.
- Scheduled date field.
- Optional scheduled time or time window field.
- Delivery address selector or editable address snapshot field.
- Recipient name field.
- Recipient phone field.
- Customer-facing delivery notes field.
- Internal notes field.
- Order item selector with remaining quantity display.
- Quantity field per selected order item.
- Read-only preview of remaining quantities after save.
- Save action gated by delivery create permission.

### Delivery Detail View

- Delivery header with status, scheduled date, optional time window, provider, and receipt document state.
- Address and recipient section.
- Delivery item table with item name, ordered quantity, previously delivered quantity, planned quantity for this delivery, delivered quantity, and remaining quantity.
- Customer-facing notes and internal notes shown separately.
- Action to update delivery progress for permitted users.
- Action to prepare or generate delivery receipt data for permitted users.

### Delivery List Page

- Table of deliveries across orders for operational planning.
- Columns: scheduled date, optional time window, order number or fallback order ID, customer, provider, recipient, address summary, status, and created by.
- Filters for scheduled date range, status, provider type, customer, and order when supported.
- Row action to open the related order or delivery detail based on permissions.
- Do not add calendar sync or external map display.

## Calculation Rules

- `orderedQuantity = orderItem.quantity`.
- `activeDeliveryItems = delivery items from deliveries that are not cancelled`.
- `plannedQuantityForOrderItem = sum(quantityPlanned from active delivery items for the order item)`.
- `deliveredQuantityForOrderItem = sum(quantityDelivered from active delivery items for the order item)`.
- `remainingUnplannedQuantity = max(orderedQuantity - plannedQuantityForOrderItem, 0)`.
- `remainingUndeliveredQuantity = max(orderedQuantity - deliveredQuantityForOrderItem, 0)`.
- `deliveryItem.quantityPlanned` must be less than or equal to remaining undelivered quantity at creation unless Admin override exists.
- `deliveryItem.quantityDelivered` must be less than or equal to `deliveryItem.quantityPlanned` unless Admin override exists.
- An order is fully delivered only when every order item has delivered quantity equal to ordered quantity.
- Use decimal-safe quantity handling because furniture quantities may still need consistent numeric storage.
- Client-side calculations are for preview only; server-side calculation is authoritative.

## Validation Rules

- Delivery scheduling requires an existing order.
- Delivery scheduling requires `DELIVERIES:CREATE`.
- Delivery visibility requires `DELIVERIES:VIEW`.
- Delivery updates require `DELIVERIES:UPDATE`.
- A delivery requires at least one delivery item.
- A scheduled delivery requires a scheduled date.
- Scheduled time or time window is optional until clarified.
- Delivery provider type is optional unless Furniture Odyssey confirms it is required.
- Delivery address is required for delivery types that go to a customer location.
- Delivery address may be optional for customer pickup if that provider type is selected.
- Each delivery item must link to an order item from the same order.
- Delivery item planned quantity must be greater than zero.
- Delivery item planned quantity cannot exceed remaining undelivered quantity unless Admin override is explicitly implemented.
- Delivered quantity cannot be negative.
- Delivered quantity cannot exceed planned quantity unless Admin override is explicitly implemented.
- Delivery receipt data generation requires a saved delivery record.
- Delivery receipt PDF metadata must include at least order ID, delivery ID, document type, generated timestamp, and generated by user when a PDF is generated.

## Delivery Receipt PDF Data Requirements

Delivery receipt generation should have access to the following saved data.

### Company Data

- Company display name.
- Company address if configured.
- Company contact details if configured.
- Company logo Cloudinary metadata if configured.

### Customer Data

- Customer display name.
- Customer type.
- Company name when applicable.
- Contact person when applicable.
- Selected phone, Viber, Facebook, or email contact values when available.
- Delivery address snapshot used for this delivery.

### Order Data

- Order ID.
- Order number when numbering rules exist.
- Order date or confirmed date.
- Customer-facing order notes when relevant.
- Order item snapshots for items included in the delivery.
- Payment balance only when the user has permission and receipt rules require it.

### Delivery Data

- Delivery ID.
- Delivery number when numbering rules exist.
- Delivery status.
- Scheduled date.
- Scheduled time or time window when entered.
- Delivery provider type when entered.
- Delivery provider name when entered.
- Delivery provider reference when entered.
- Delivery address snapshot.
- Recipient name when entered.
- Recipient phone when entered.
- Customer-facing delivery notes.
- Created by user display name when available.
- Updated by user display name when available.

### Delivery Item Data

- Order item ID.
- Product code snapshot when available.
- Item name.
- Description and specifications when relevant.
- Quantity ordered.
- Quantity included in this delivery.
- Quantity delivered for this delivery when available.
- Remaining undelivered quantity after this delivery when useful.
- Item-specific delivery notes.

### Delivery Receipt Document Data

- Document ID.
- Document type: `DELIVERY_RECEIPT`.
- Generated date and time.
- Generated by user display name.
- Linked order ID.
- Linked delivery ID.
- Cloudinary public ID and secure URL after generation.

Rules:

- Delivery receipts should show saved delivery data, not values retyped during document generation.
- Delivery receipts should include only the items and quantities assigned to that delivery.
- Delivery receipts may show remaining undelivered quantities if useful for partial delivery clarity.
- Delivery receipts should not include cost, margin, profit, or internal notes.
- Delivery receipts should not expose payment details unless a later document policy explicitly includes balance due and the user has permission.
- Final delivery receipt numbering, signature blocks, legal wording, and visual layout are deferred.

## Permissions Plan

Use the existing role and permission model.

Recommended permissions:

- Admin can view, create, update, and cancel deliveries for all orders.
- Staff can view deliveries for orders they can access when they have delivery permissions.
- Staff can create deliveries for accessible orders when they have `DELIVERIES:CREATE`.
- Staff can update delivery progress when they have `DELIVERIES:UPDATE`.
- Delivery list/detail visibility requires `DELIVERIES:VIEW`.
- Delivery receipt data preparation or generation requires `DOCUMENTS:CREATE` or `DOCUMENTS:EXPORT`.
- Viewing balance due on delivery requires payment visibility permission.
- Sensitive financial summaries require explicit financial visibility permission.

Implementation notes:

- Gate the Deliveries tab under `DELIVERIES:VIEW`.
- Gate Add Delivery under `DELIVERIES:CREATE`.
- Gate delivery progress updates under `DELIVERIES:UPDATE`.
- Gate delivery receipt preparation under document permissions.
- Do not expose payment, cost, margin, profit, or internal financial summaries through delivery views without the correct permissions.

## Relationship Plan

- A customer has many orders.
- An order has many order items.
- An order has many deliveries.
- A delivery belongs to one order.
- A delivery has many delivery items.
- A delivery item belongs to one delivery.
- A delivery item links to one order item.
- An order item can appear in many delivery items across multiple deliveries.
- An order has many documents.
- A delivery may have zero or more related delivery receipt documents.
- A delivery receipt document belongs to one order and should link to one delivery.
- Delivery history views should primarily read from delivery records joined to orders, customers, delivery items, and order items.

## Reporting Impact

- Delivery reports should use saved delivery and delivery item records.
- Order delivery progress should use order item quantities and non-cancelled delivery item quantities.
- Staff can report scheduled deliveries by date range, status, provider type, customer, and order.
- Partial delivery reports can show ordered, planned, delivered, and remaining quantities per order item.
- Sales tracking can distinguish not scheduled, scheduled, partially delivered, and delivered orders.
- Provider reporting should remain manual and flexible until final provider rules are defined.
- Cost, profit, margin, delivery cost, and commission reporting are outside this phase unless separately defined.

## Acceptance Criteria

- Staff can schedule a delivery against an existing order.
- Staff can schedule more than one delivery for the same order.
- Staff can assign one or more order items to a delivery.
- Staff can assign partial quantities from an order item to a delivery.
- The system prevents delivery quantities from exceeding remaining undelivered quantities unless Admin override is explicitly implemented.
- Staff can choose or enter a delivery provider manually without external provider integration.
- Staff can save a delivery address snapshot for each delivery.
- Staff can set a scheduled date.
- Staff can optionally set scheduled time or a time window.
- The order delivery summary shows scheduled, delivered, and remaining quantities.
- Partial deliveries update order delivery progress.
- Delivery receipt PDF data can be prepared from saved company, customer, order, delivery, delivery item, and document records.
- Delivery receipt data includes only the items and quantities assigned to that delivery.
- Delivery views and actions are permission-controlled.
- No Lalamove, AP Cargo, map API, tracking API, calendar sync, inventory reservation, or final delivery staff assignment rule is introduced.

## Implementation Sequence

1. Add or refine Prisma enums for delivery status, order delivery status, provider type, and document type.
2. Add or refine the `Delivery` model with order, status, schedule, provider, address snapshot, recipient, notes, and audit fields.
3. Add or refine the `DeliveryItem` model with delivery, order item, planned quantity, delivered quantity, and notes fields.
4. Add order delivery summary fields for delivery status and useful scheduled date summaries.
5. Add `DELIVERY_RECEIPT` to the order document type enum if not already present.
6. Add Zod schemas for delivery creation, delivery item quantity selection, and delivery progress updates.
7. Add server helpers for planned quantity, delivered quantity, remaining quantity, and order delivery status calculation.
8. Add a transactional server action to create a delivery and delivery items, then recalculate order delivery summary fields.
9. Add a server action to update delivery progress and delivered quantities.
10. Add queries for order delivery history and operational delivery lists.
11. Add permission checks for delivery tab visibility, delivery creation, delivery update, and delivery receipt preparation.
12. Build the order Deliveries tab summary, delivery list, and Add Delivery form.
13. Build delivery item quantity selection with remaining quantity previews.
14. Define delivery receipt PDF data fetchers that return saved company, customer, order, delivery, delivery item, and document data.
15. Add activity log entries for delivery scheduling, delivery progress updates, and delivery receipt generation.
16. Add tests for multiple deliveries, partial deliveries, quantity limits, delivery status summary, provider fields, address snapshots, permissions, and delivery receipt data completeness.

## Future Extensions

- Final delivery status transition rules.
- Final assigned delivery staff rules.
- Delivery receipt React-PDF visual layout.
- Delivery receipt numbering rules.
- Signature capture or received-by confirmation.
- Delivery fee handling.
- Failed delivery, redelivery, return, exchange, and damage workflows.
- Inventory reservation, allocation, stock deduction, or warehouse workflow.
- Calendar view after internal scheduling rules are clear.
- External provider integrations only after manual provider workflows are stable.
- Map, route, ETA, and tracking integrations only after provider and operations rules are defined.
