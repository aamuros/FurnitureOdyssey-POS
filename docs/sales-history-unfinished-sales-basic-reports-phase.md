# Sales History, Unfinished Sales, and Basic Reports Phase

## Phase Goal

Create basic operational reporting views that help Admin and Staff review sales history, quotation history, order history, unfinished sales, payment history, outstanding balances, delivery schedules, and customer sales history from saved business records.

This phase supports Furniture Odyssey's internal sales workflow by giving staff a searchable, filterable way to answer daily operational questions: which quotations are still open, which orders are unpaid or undelivered, which customers have balances, which deliveries are scheduled, and what happened historically for a customer or sale.

This phase must not introduce advanced analytics, chart-heavy dashboards, cost/profit reports, commission reporting, CSV exports, PDF exports, accounting reports, predictive metrics, or complex business intelligence features.

## Primary Users

- Admin
- Staff

## Core Principles

- Reports are operational lists and summaries, not advanced analytics.
- Sales history should read from saved orders, payments, deliveries, documents, customers, inquiries, and quotations.
- Quotation history should read from saved quotation records and preserve quoted snapshots.
- Order history should read from saved order records and preserve order snapshots.
- Unfinished sales should identify active work that still needs staff action.
- Outstanding balances should use saved order totals and saved payment summaries.
- Delivery schedule reporting should use saved delivery records and scheduled dates.
- Customer sales history should combine the customer's inquiries, quotations, orders, payments, balances, deliveries, and documents when permitted.
- Search and filters are required for practical daily use.
- Sensitive payment, balance, cost, profit, margin, and internal financial data must remain permission-controlled.
- Staff should only see records they are permitted to access.
- Reports must not mutate transactional records.
- Reports should prefer server-side filtering, sorting, pagination, and permission checks.

## In Scope

- Sales history list based on orders.
- Quotation history list.
- Order history list.
- Unfinished sales list.
- Payment history list.
- Outstanding balances list.
- Delivery schedule list.
- Customer sales history section or page.
- Basic report summary counts and totals where permitted.
- Search by customer, order, quotation, contact value, reference number, item name, and staff name when available.
- Filters by date range, status, customer, assigned staff, created by, payment status, delivery status, source, and document status where relevant.
- Sortable columns for common operational fields.
- Permission-aware visibility for report pages, rows, columns, and summary values.
- Links from report rows back to source records.
- Empty, loading, and no-permission states.
- Basic server-side query helpers for reports.
- Activity/history visibility when existing activity logs are useful for a record.

## Out of Scope

- Advanced analytics dashboards.
- Charts, graphs, trend visualizations, forecasting, cohorts, or funnels.
- Cost, margin, profit, commission, or staff performance reports.
- Tax, VAT, BIR, accounting, receivables aging, or general ledger reports.
- CSV, Excel, PDF, or bulk exports.
- Scheduled reports or email reports.
- Customer-facing reports or customer portal history.
- Automated notifications or follow-up reminders.
- AI-generated sales insights.
- Inventory reports, stock movement reports, warehouse reports, or SKU-first sales analytics.
- External integrations with Facebook, Messenger, Viber, payment providers, delivery providers, or accounting systems.
- Report builder functionality.
- New workflow state machines unless already planned in previous phases.

## Data Model Plan

This phase should primarily use existing models and saved summary fields. It should not add new transactional tables unless a specific reporting cache becomes necessary later.

### Existing Records Used

- `Customer`
- `CustomerContact`
- `CustomerAddress`
- `Inquiry`
- `Quotation`
- `QuotationItem`
- `Order`
- `OrderItem`
- `Payment`
- `Delivery`
- `DeliveryItem`
- `OrderDocument`
- `ActivityLog`
- `UserProfile`

### Order Report Fields

Sales history, order history, unfinished sales, and outstanding balance reports should read these saved order fields:

- `id`
- `orderNumber`
- `customerId`
- `customerDisplayNameSnapshot`
- `customerTypeSnapshot`
- `companyNameSnapshot`
- `contactPersonNameSnapshot`
- `status`
- `paymentStatus`
- `paymentDueTiming`
- `paymentDueDate`
- `deliveryStatus`
- `sourceType`
- `currency`
- `subtotalAmount`
- `itemDiscountTotal`
- `orderDiscountAmount`
- `totalAmount`
- `paidAmount`
- `balanceAmount`
- `lastPaymentAt`
- `confirmedAt`
- `cancelledAt`
- `completedAt`
- `createdById`
- `updatedById`
- `createdAt`
- `updatedAt`

Rules:

- Reports must use saved order totals and saved order snapshots.
- Sales history begins at confirmed or created order records, not quotation drafts.
- Cancelled orders should remain visible in history when the user has access.
- Cancelled orders should be excluded from active unfinished-sales counts unless the filter explicitly includes cancelled records.
- Outstanding balance reports should include only orders with `balanceAmount > 0` and a non-cancelled operational status by default.
- Payment-sensitive columns require payment or sales-history financial visibility.

### Quotation Report Fields

Quotation history should read these saved quotation fields:

- `id`
- `customerId`
- `inquiryId`
- `status`
- `currency`
- `subtotalAmount`
- `itemDiscountTotal`
- `quotationDiscountAmount`
- `totalAmount`
- `createdById`
- `updatedById`
- `createdAt`
- `updatedAt`
- related customer display fields
- related order ID when converted

Rules:

- Quotation history must use saved quotation totals, not live product reference prices.
- Accepted quotations with a related order should show the linked order.
- Declined and cancelled quotations should remain visible in quotation history.
- Quotation totals are financial values and must respect quotation and sales-history permissions.
- Internal notes should not be exposed in broad report tables unless the user has permission and the page intentionally includes internal context.

### Payment Report Fields

Payment history should read these saved payment fields:

- `id`
- `orderId`
- `customerId`
- `paymentNumber`
- `status`
- `paymentType`
- `paymentDate`
- `amount`
- `method`
- `referenceNumber`
- `payerName`
- `receivedById`
- `createdById`
- `createdAt`
- `updatedAt`
- related order number or fallback order ID
- related customer display name
- related order balance after current saved summary when available

Rules:

- Payment reports require payment visibility.
- Voided, refunded, or future correction statuses should be filterable if those statuses exist, but this phase should not implement correction workflows.
- Payment amount is sensitive financial data.
- Payment method and reference number should be visible only to users with payment visibility.
- Payment history should link back to the related order and payment receipt document when available.

### Delivery Report Fields

Delivery schedule reports should read these saved delivery fields:

- `id`
- `orderId`
- `deliveryNumber`
- `status`
- `scheduledDate`
- `scheduledTimeWindow`
- `deliveryProviderType`
- `deliveryProviderName`
- `deliveryProviderReference`
- `recipientName`
- `recipientPhone`
- `deliveredAt`
- `cancelledAt`
- `assignedStaffId`
- `createdById`
- `createdAt`
- `updatedAt`
- related order number or fallback order ID
- related customer display name
- related order payment status and balance only when permitted

Rules:

- Delivery schedule reports require delivery visibility.
- Default delivery schedule view should focus on active scheduled or planned deliveries.
- Cancelled and failed deliveries remain in delivery history and are available by filter.
- Balance due on delivery should be visible only to users permitted to see payment or balance information.
- Delivery reports should not require full payment before scheduling or display scheduling as an error when an order has a balance.

### Customer Sales History Fields

Customer sales history should combine:

- Customer identity and contact summary.
- Inquiry history.
- Quotation history.
- Order history.
- Payment history when permitted.
- Outstanding balances when permitted.
- Delivery history when permitted.
- Document history when permitted.
- Activity log entries when relevant and permitted.

Rules:

- Customer sales history should be a customer-centric operational timeline or grouped sections.
- Staff should be able to answer what the customer asked for, what was quoted, what was ordered, what was paid, what is still due, and what was delivered.
- Sensitive sections should be hidden or summarized according to permissions.
- Customer history should not expose unrelated customers or unrelated staff-only financial details.

## Report Definitions

### Sales History

Purpose:

- Show saved orders as historical sales records.
- Help Admin and Staff find completed, cancelled, active, paid, unpaid, delivered, and partially delivered orders.

Default rows:

- Orders sorted by `createdAt` or `confirmedAt` descending.

Recommended columns:

- Order number or fallback order ID.
- Customer.
- Source type.
- Order status.
- Payment status.
- Delivery status.
- Total amount when permitted.
- Paid amount when permitted.
- Balance amount when permitted.
- Confirmed date.
- Completed date.
- Created by.
- Last updated date.

Default filters:

- Date range.
- Order status.
- Payment status.
- Delivery status.
- Customer.
- Created by.
- Source type.

Default actions:

- Open order.
- Open customer.
- Open related quotation when available.

### Quotation History

Purpose:

- Show saved quotations across statuses.
- Help Staff find open, sent, accepted, declined, cancelled, and converted quotations.

Default rows:

- Quotations sorted by `updatedAt` or `createdAt` descending.

Recommended columns:

- Quotation ID or number if numbering exists.
- Customer.
- Inquiry link when available.
- Status.
- Total amount when permitted.
- Created by.
- Created date.
- Last updated date.
- Converted order when available.

Default filters:

- Date range.
- Quotation status.
- Customer.
- Created by.
- Has linked order.
- Inquiry source when joined through inquiry.

Default actions:

- Open quotation.
- Open customer.
- Open linked order when converted.

### Order History

Purpose:

- Provide an order-focused operational history separate from quotation and payment lists.
- Help Staff review order progress and linked operational records.

Default rows:

- Orders sorted by `updatedAt` descending.

Recommended columns:

- Order number or fallback order ID.
- Customer.
- Status.
- Payment status.
- Delivery status.
- Payment count.
- Delivery count.
- Document count.
- Total amount when permitted.
- Balance amount when permitted.
- Created date.
- Last updated date.

Default filters:

- Date range.
- Order status.
- Payment status.
- Delivery status.
- Customer.
- Created by.
- Has payments.
- Has deliveries.
- Has documents.

Default actions:

- Open order.
- Open customer.
- Open documents tab or documents page filtered to the order when available.

### Unfinished Sales

Purpose:

- Show active sales records that still need staff action.
- Keep daily work focused without introducing a complex task system.

Default rows:

- Quotations and orders with unfinished operational states, grouped by type or shown in a unified list.

Recommended unfinished quotation conditions:

- `DRAFT`
- `SENT`
- `ACCEPTED` without linked order

Recommended unfinished order conditions:

- Active order not `COMPLETED` and not `CANCELLED`.
- `balanceAmount > 0`.
- `paymentStatus` is `UNPAID`, `DOWNPAYMENT_PAID`, `PARTIALLY_PAID`, or `BALANCE_DUE_ON_DELIVERY`.
- `deliveryStatus` is `NOT_SCHEDULED`, `SCHEDULED`, or `PARTIALLY_DELIVERED`.
- Delivery date has passed while delivery is not delivered.
- Payment due date has passed while balance remains.

Recommended columns:

- Record type: quotation or order.
- Record ID or number.
- Customer.
- Current status.
- Needed action label.
- Total amount when permitted.
- Balance amount when permitted.
- Payment due date when applicable.
- Next scheduled delivery when applicable.
- Assigned or created staff.
- Last updated date.

Default filters:

- Record type.
- Needed action.
- Date range.
- Customer.
- Assigned or created staff.
- Payment status.
- Delivery status.
- Overdue only.

Default actions:

- Open source record.
- Open customer.
- Open payment area for permitted users.
- Open delivery area for permitted users.

Rules:

- Unfinished sales is a derived report, not a new status source of truth.
- The report should compute needed action from saved quotation, order, payment, and delivery fields.
- It must not silently change statuses.
- The default view should exclude completed and cancelled records.

### Payment History

Purpose:

- Show recorded payments across orders.
- Help Staff verify recent payments and find payment references.

Default rows:

- Payments sorted by `paymentDate` descending, then `createdAt` descending.

Recommended columns:

- Payment date.
- Payment type.
- Payment status.
- Amount.
- Method.
- Reference number.
- Payer name.
- Customer.
- Order.
- Received by.
- Receipt status or receipt document link when available.

Default filters:

- Date range.
- Payment type.
- Payment status.
- Method.
- Customer.
- Order.
- Received by.
- Receipt generated.

Default actions:

- Open order.
- Open customer.
- Open receipt document when available.

Rules:

- This report requires `PAYMENTS:VIEW`.
- Amount, method, reference number, and payer name should be hidden if the user cannot view payment data.

### Outstanding Balances

Purpose:

- Show customers and orders with unpaid balances.
- Help Staff identify payment follow-up work.

Default rows:

- Orders with `balanceAmount > 0`, sorted by payment due date, last payment date, or created date.

Recommended columns:

- Customer.
- Order.
- Order status.
- Payment status.
- Payment due timing.
- Payment due date.
- Total amount.
- Paid amount.
- Balance amount.
- Last payment date.
- Next scheduled delivery when available.
- Created by.

Default filters:

- Due date range.
- Overdue only.
- Payment status.
- Payment due timing.
- Customer.
- Created by.
- Has scheduled delivery.

Default actions:

- Open order.
- Open customer.
- Record payment when permitted.

Rules:

- This report requires permission to view payment or balance data.
- Cancelled orders should be excluded by default.
- Fully paid orders should be excluded by default.
- Cost, margin, profit, and accounting aging buckets are out of scope.

### Delivery Schedules

Purpose:

- Show scheduled and historical deliveries across orders.
- Help Staff plan upcoming deliveries and review completed or failed deliveries.

Default rows:

- Deliveries sorted by `scheduledDate` ascending for active schedule view.

Recommended columns:

- Scheduled date.
- Scheduled time window.
- Delivery status.
- Customer.
- Order.
- Provider type.
- Provider name.
- Recipient.
- Assigned staff.
- Payment due upon delivery indicator when permitted.
- Balance due when permitted.

Default filters:

- Scheduled date range.
- Delivery status.
- Provider type.
- Customer.
- Order.
- Assigned staff.
- Balance due upon delivery.

Default actions:

- Open delivery or order.
- Open customer.
- Record delivery balance payment when permitted.

Rules:

- This report requires `DELIVERIES:VIEW`.
- Payment-related delivery columns require payment or balance visibility.
- Cancelled and failed deliveries remain available by filter.

### Customer Sales History

Purpose:

- Show all sales-related records for one customer.
- Help Staff understand repeat orders, prior quotations, payments, balances, deliveries, and documents before responding to a customer.

Recommended sections:

- Customer summary.
- Open inquiries.
- Quotation history.
- Order history.
- Payment history when permitted.
- Outstanding balances when permitted.
- Delivery history when permitted.
- Document history when permitted.
- Recent activity when permitted.

Recommended filters inside customer history:

- Date range.
- Record type.
- Status.
- Payment status.
- Delivery status.

Default actions:

- Open inquiry.
- Open quotation.
- Open order.
- Open payment receipt when available.
- Open delivery record.
- Open document when available.

Rules:

- Customer sales history must respect each module permission independently.
- Hiding a section due to permissions is preferred over exposing empty or misleading financial data.
- Customer history should use saved order and quotation snapshots for historical accuracy.

## UI Plan

### Sales History Page

- Page-level permission gate for `SALES_HISTORY:VIEW`.
- Compact summary strip with counts and totals the user is allowed to see.
- Tabs or segmented view for sales history, unfinished sales, balances, and schedules if it keeps navigation simple.
- Server-backed table with search, filters, sorting, pagination, and row links.
- Clear empty state when no records match filters.
- Clear restricted state when the user has page access but not payment, delivery, document, or quotation details.

### Quotation History View

- Table of saved quotations.
- Status filter.
- Customer search.
- Date range filter.
- Created-by filter.
- Converted-to-order filter.
- Row links to quotation, customer, and order when available.

### Order History View

- Table of saved orders.
- Status, payment status, and delivery status filters.
- Customer search.
- Date range filter.
- Source type filter.
- Row links to order and customer.
- Payment, balance, and delivery columns shown only when permitted.

### Unfinished Sales View

- Table or grouped list of open quotations and active orders needing follow-up.
- Needed action labels such as:
  - Draft quotation not sent.
  - Sent quotation waiting for customer.
  - Accepted quotation not converted.
  - Order unpaid.
  - Order partially paid.
  - Balance due upon delivery.
  - Delivery not scheduled.
  - Delivery partially completed.
  - Payment due date overdue.
  - Scheduled delivery overdue.
- Filters for staff, status, action type, overdue only, and date range.
- Row links to the source record.

### Payment History View

- Table of recorded payments.
- Payment type, method, received by, and date filters.
- Reference number search.
- Receipt link when generated.
- Visible only to users with payment visibility.

### Outstanding Balances View

- Table of orders with remaining balances.
- Due date and overdue filters.
- Payment due timing filter.
- Payment status filter.
- Customer search.
- Shortcut to the order payment area when permitted.
- Hidden or restricted when the user cannot view payment/balance data.

### Delivery Schedule View

- Upcoming deliveries default view.
- Date range, status, provider, assigned staff, and customer filters.
- Completed, failed, and cancelled deliveries available by filter.
- Balance due upon delivery indicator only when permitted.
- Row link to order or delivery detail.

### Customer Detail History

- Add or refine a customer sales history area.
- Show related records grouped by inquiries, quotations, orders, payments, balances, deliveries, and documents.
- Respect each module's permission independently.
- Provide a single date range filter for the customer history when practical.

## Search and Filter Plan

### Global Search Inputs

Reports should support search across practical operational identifiers:

- Customer display name.
- Company name.
- Contact person name.
- Primary contact value where joined.
- Order number.
- Quotation ID or number when numbering exists.
- Payment reference number.
- Delivery provider reference.
- Item name where useful and efficient.
- Staff display name where joined.

### Common Filters

- Date range.
- Customer.
- Assigned staff.
- Created by.
- Record status.
- Payment status.
- Delivery status.
- Source type.
- Payment type.
- Payment method.
- Delivery provider type.
- Has linked order.
- Has payments.
- Has deliveries.
- Has generated documents.
- Overdue only.

### Sorting

Recommended sortable fields:

- Created date.
- Updated date.
- Confirmed date.
- Completed date.
- Payment date.
- Last payment date.
- Payment due date.
- Scheduled delivery date.
- Total amount when permitted.
- Paid amount when permitted.
- Balance amount when permitted.
- Customer display name.
- Status.

Rules:

- Filtering and sorting should happen server-side.
- Search should be trimmed and length-limited.
- Queries should use indexed fields where available.
- Item-name search may be slower and should be added only if the query remains acceptable.
- Pagination is required for broad report lists.

## Calculation Rules

- Sales totals use saved `Order.totalAmount`.
- Paid totals use saved `Order.paidAmount` or saved payment sums where a payment-specific report requires payment rows.
- Balance totals use saved `Order.balanceAmount`.
- Quotation totals use saved `Quotation.totalAmount`.
- Outstanding balance rows require `Order.balanceAmount > 0`.
- Payment history totals use saved non-voided payment records when payment status filtering is available.
- Delivery counts use saved delivery records.
- Unfinished sales needed-action labels are derived from saved status, payment, due date, and delivery fields.
- Cancelled records are included in history reports but excluded from default active unfinished-sales and outstanding-balance views.
- Financial summary totals should not be calculated or displayed when the user lacks permission to see the underlying financial values.
- Reports should use decimal-safe money formatting and server-side calculations.

## Validation Rules

- Report page access requires the relevant module permission.
- Date filters must use valid dates.
- Start date must be before or equal to end date.
- Status filters must use known enum values.
- Pagination parameters must be bounded.
- Sort fields must be allowlisted per report.
- Search input must be length-limited.
- Customer, staff, order, quotation, payment, delivery, and document IDs must be valid UUIDs when used as filters.
- Users without payment visibility cannot request payment reports or balance-only reports.
- Users without delivery visibility cannot request delivery schedule reports.
- Users without quotation visibility cannot request quotation history.
- Users without order visibility cannot request order history or sales history source rows.
- Users without document visibility cannot see document status or links.

## Permissions Plan

Use the existing role and permission model.

Recommended permissions:

- Sales history page visibility requires `SALES_HISTORY:VIEW`.
- Quotation history requires `QUOTATIONS:VIEW`.
- Order history requires `ORDERS:VIEW`.
- Payment history requires `PAYMENTS:VIEW`.
- Outstanding balances require `PAYMENTS:VIEW` or a dedicated financial visibility rule if introduced later.
- Delivery schedules require `DELIVERIES:VIEW`.
- Customer sales history requires `CUSTOMERS:VIEW` plus each related module permission.
- Document links and document counts require `DOCUMENTS:VIEW`.
- Export actions are out of scope even if `EXPORT` permissions exist.

Implementation notes:

- Admin can view all operational reports when permissions are enabled for the role.
- Staff can view records they are allowed to access through module permissions and customer/order access rules.
- Hide entire report pages when the user lacks the page permission.
- Hide restricted columns when the user can view the row but not sensitive values.
- Do not include restricted fields in server responses for unauthorized users.
- Do not show cost, margin, profit, commission, reference cost, supplier cost, tax, or accounting summaries in this phase.
- Payment and balance values require explicit payment or financial visibility.
- Delivery balance-due indicators require both delivery access and payment/balance visibility.
- Customer history should render each section independently according to permissions.

## Relationship Plan

- A customer has many inquiries.
- A customer has many quotations.
- A customer has many orders.
- A customer has many payments.
- A customer has many deliveries through orders.
- A quotation may belong to one inquiry.
- A quotation may convert to one order.
- An order may come from one quotation or be manual.
- An order has many payments.
- An order has many deliveries.
- An order has many documents.
- A payment belongs to one order and one customer.
- A delivery belongs to one order.
- A delivery has many delivery items.
- A document belongs to an order and may link to a quotation, payment, or delivery.
- Reports should link back to the source record instead of duplicating workflow screens.

## Reporting Impact

- Sales history becomes the primary read-only view for order-based operational history.
- Quotation history remains separate because quotations can exist without orders.
- Order history shows the operational sale record after conversion or manual creation.
- Unfinished sales identifies open work without adding a task system.
- Payment history centralizes recorded payment lookup.
- Outstanding balances makes unpaid and partially paid orders easier to follow up.
- Delivery schedules make upcoming deliveries visible outside individual order pages.
- Customer sales history gives Staff context before responding to repeat customers.
- Permission-aware visibility keeps payment, balance, and financial data protected.
- This phase provides operational reports but does not define advanced business analytics.

## Acceptance Criteria

- Staff with permission can view sales history based on saved orders.
- Staff with permission can view quotation history based on saved quotations.
- Staff with permission can view order history based on saved orders.
- Staff with permission can view unfinished sales derived from open quotations and active incomplete orders.
- Staff with payment permission can view payment history.
- Staff with balance visibility can view outstanding balances.
- Staff with delivery permission can view delivery schedules.
- Staff can open source records from report rows.
- Staff can search reports by practical operational identifiers.
- Staff can filter reports by date range and relevant statuses.
- Customer sales history shows that customer's related inquiries, quotations, orders, payments, balances, deliveries, and documents when permitted.
- Users without permission cannot access restricted report pages.
- Users without payment or balance permission do not receive payment amounts, paid amounts, balances, payment references, or balance-due indicators.
- Users without delivery permission do not receive delivery schedule details.
- Reports use saved order, quotation, payment, and delivery records instead of live catalog prices or unsaved form state.
- Cancelled and completed records remain available in history reports.
- Completed and cancelled records are excluded from unfinished sales by default.
- No advanced analytics, charts, cost/profit reporting, CSV exports, PDF exports, or complex dashboards are introduced.

## Implementation Sequence

1. Confirm the route structure for sales history, quotation history, order history, payments, balances, delivery schedules, and customer history.
2. Define allowlisted report filter, sort, search, and pagination parameter schemas with Zod.
3. Add shared permission helpers for report page visibility, row access, and sensitive column visibility.
4. Add server-side query helpers for sales history from orders.
5. Add server-side query helpers for quotation history.
6. Add server-side query helpers for order history.
7. Add server-side query helpers for unfinished sales derived from quotations and orders.
8. Add server-side query helpers for payment history.
9. Add server-side query helpers for outstanding balances.
10. Add server-side query helpers for delivery schedules.
11. Add customer sales history query helpers that compose permitted sections.
12. Build shared report table utilities for filters, sorting, pagination, empty states, and row links.
13. Implement the sales history page using server-backed data.
14. Implement quotation history and order history views or tabs.
15. Implement unfinished sales view with derived needed-action labels.
16. Implement payment history view or refine the existing payments page.
17. Implement outstanding balances view.
18. Implement delivery schedule view or refine the existing deliveries page.
19. Add customer sales history sections to the customer detail workflow.
20. Add restricted-column handling so unauthorized financial fields are not fetched or returned.
21. Add activity log links or recent activity sections where useful and permitted.
22. Add tests for report permissions, filters, sorting, pagination, unfinished-sales derivation, balance visibility, customer history composition, and restricted-field exclusion.

## Future Extensions

- Charts and visual analytics.
- CSV or Excel exports.
- PDF report exports.
- Scheduled reports.
- Receivables aging reports.
- Staff sales performance reports.
- Commission reports.
- Cost, margin, and profit reports with stricter permissions.
- Inventory and product sales analytics.
- Quotation conversion funnel analysis.
- Customer lifetime value analysis.
- Payment collection reminders.
- Delivery calendar sync.
- Custom report builder.
