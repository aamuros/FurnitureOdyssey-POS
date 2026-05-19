# Implementation Status

This document maps the current codebase to the phase plans in `docs/`. It should be updated whenever a phase changes from planning to shipped behavior.

## Implemented Foundation

- Next.js App Router application with authenticated dashboard layout.
- Supabase Auth session handling through middleware and server clients.
- Prisma-backed user profiles, roles, permissions, and activity logs.
- Admin-only user management for inviting and updating staff records.
- Permission-gated navigation and server actions.
- Shared validation with Zod for customer, inquiry, quotation, order, payment, delivery, and document payloads.
- Central upload foundation now defines reusable category policy, allowed MIME types/extensions, size limits, Cloudinary path conventions, server-side validation, permission mapping, server-side Cloudinary upload helpers, image transformation helpers, deletion/replacement policy, and PDF storage behavior in `lib/uploads`.
- Shared calculation helpers for quotation totals, order totals, order cost/profit snapshots, payment status, delivery status, and order progress.
- Automated Node test coverage now protects quotation totals, order totals, fixed and percentage discounts, payment balances/statuses, delivery progress, order progress, validation schemas, and cost/profit snapshot calculations.
- Central status lifecycle rules now define valid quotation, order, order delivery, delivery, and payment transitions. Server actions use these rules before mutating protected workflow statuses.

## Implemented Workflows

### Customers and Inquiries

- Create customer records for individual and company clients.
- Store multiple customer contact methods.
- Assign customers and inquiries to staff.
- Create inquiries from manual sales channels.
- Track inquiry status, priority, requested items, budget range, delivery location, follow-up date, and last contact date.

### Quotations

- Create draft quotations for a customer.
- Optionally link quotations to inquiries.
- Add catalog product items or custom/manual items.
- Snapshot product and item details into quotation items.
- Override item names, descriptions, specifications, quantities, unit prices, discounts, customer notes, internal notes, and Cloudinary image metadata.
- Capture client-required sales details: sales invoice request, assembly requirement, delivery mode, delivery method, payment terms, and remarks or special instructions.
- Calculate item totals, quotation subtotal, discounts, and final total on the server.
- Update quotation status to `SENT`, `ACCEPTED`, `DECLINED`, or `CANCELLED`.
- Quotation status updates are controlled internally through server actions and logged with old status, new status, and source action metadata.

### Products

- Product management supports server-side Cloudinary image upload from the product workspace.
- Product image uploads require `PRODUCTS:UPDATE`, validate the product exists, validate file type/extension/size through the central upload policy, sniff file signatures server-side, and store normalized Cloudinary metadata in `ProductImage`.
- Product image management supports alt text, sort order, primary image selection, metadata removal, and activity logging.
- Product image removal detaches database metadata only. Cloudinary asset destruction is intentionally not implemented yet so historical quotation/order snapshots and generated PDFs keep their copied image references.

### Orders

- Convert an `ACCEPTED` quotation into one order.
- Prevent duplicate order creation from the same quotation.
- Snapshot customer, contact, address, item, image, price, cost, discount, profit, and note data into the order.
- Preserve quotation sales details during conversion, including sales invoice request, assembly requirement, delivery mode/method, payment terms, and special instructions.
- Create manual orders without requiring a quotation or inventory availability.
- Confirmed orders snapshot unit cost, line cost, line profit, total cost, and gross profit so historical profitability is preserved when product reference costs change later.
- Recalculate order subtotal, discounts, total, paid amount, balance, payment status, delivery status, and overall order status.
- Derived order progress status changes pass through the central lifecycle validator, preventing regressions such as delivered orders moving back to payment-only states.
- Orders workspace now serves as a day-to-day order control center with server-side search, filters, unfinished sales mode, pagination, clearer customer/contact/staff identity, payment and delivery status summaries, related quotation/inquiry context, safe notes, and protected PDF action areas.
- Orders search covers order number, customer/company/contact values, item names/product codes, inquiry source references, and permission-safe payment or delivery provider references.
- Payment totals, payment history, delivery schedules, delivery details, and document export actions are conditionally shown according to the existing payment, delivery, and document permissions.

### Payments

- Record multiple payments against an order.
- Support downpayment, partial payment, final payment, and delivery balance payment records.
- Store payment date, method, amount, reference number, payer name, customer notes, and internal notes.
- Update order paid amount, balance, last payment date, payment status, and progress status.
- Payment creation now writes the payment, activity log, and related order payment summary in one database transaction.
- Payment-driven order status changes are server-controlled and logged through activity metadata. Customer-submitted data cannot freely set order statuses.

### Deliveries

- Create multiple delivery records for an order.
- Store provider type, provider name, provider reference, scheduled date, scheduled time window, recipient, phone, address, customer notes, and internal notes.
- Add delivery items linked to order items.
- Track planned quantity and delivered quantity for partial delivery progress.
- Update order delivery status and overall order progress.
- Delivery creation now writes the delivery, delivery items, activity log, and related order delivery summary in one database transaction.
- Delivery creation schedules deliveries through the server-side lifecycle layer instead of trusting arbitrary client-submitted delivery statuses.

### Documents and PDFs

- Centralized static Furniture Odyssey PDF/business profile placeholders remain as safe fallbacks.
- Admin-managed Settings now store company profile, payment/MOP instructions, document footer notes, and conservative document display prefixes in PostgreSQL.
- Shared PDF formatting helpers cover PHP currency, dates, quantities, fallback text, document numbers, and status labels.
- Store order document records, including type, title, optional stored-file reference, status, generated date, and notes.
- Internal operational numbering is implemented for quotations, orders, invoices, payment receipts, delivery receipts, and final order summaries. Numbers use the configured document prefixes with `YYYY-######` sequences, for example `QT-2026-000001`, `ORD-2026-000001`, `INV-2026-000001`, `PAY-2026-000001`, `DR-2026-000001`, and `SUM-2026-000001`.
- Operational numbers are display/reference numbers only, not legal or BIR-compliance-grade invoice controls. UUIDs remain the internal database identifiers.
- Invoice, delivery receipt, and final summary PDF downloads generate a document number once, store it on `OrderDocument`, and reuse the same number on later downloads.
- Generate downloadable PDFs with React-PDF for:
  - Quotation
  - Invoice
  - Payment receipt
  - Delivery receipt
  - Final order summary
- PDF output includes Furniture Odyssey branding, customer-facing notes, sales invoice request, assembly requirement, delivery mode/method, payment terms, special instructions, payment instructions, item images when snapshot image data exists, safer missing-value fallbacks, and clearer receipt/delivery handoff sections.
- PDF data loads saved Settings values when available and falls back to static defaults when settings are missing or incomplete.
- Protect PDF download routes with document export permission and source module view permissions.
- Order document metadata creation now validates related payment/delivery ownership, updates receipt metadata when applicable, and writes activity logs in one database transaction.
- Documents route now provides a permission-gated document registry for generated operational documents, with document type/status/date/search filters, pagination, customer and related record context, generated-on-demand or stored status, download actions, and export/source links based on existing permissions.
- Upload and document storage policy is documented in `docs/upload-and-document-storage-policy.md`. Operational PDFs remain generated on demand by default, with optional `OrderDocument` metadata and stored Cloudinary PDF references only when a finalized/exported artifact is explicitly needed.

### Settings

- Settings route is implemented as an admin configuration workspace.
- Access uses the existing `SETTINGS:VIEW` and `SETTINGS:UPDATE` permission model; Admin users continue to pass permissions automatically.
- Company Profile settings cover company name, optional registered/display name, address, contact number, email, Facebook page, website URL, logo URL, and logo alt text.
- Payment / MOP settings cover default payment instructions, bank details, e-wallet details, other payment notes, and copyable MOP script text.
- Document / PDF Defaults settings cover quotation, invoice, payment receipt, delivery receipt, and final order summary footer notes plus display prefixes for quotation, order, invoice, payment receipt, delivery receipt, and final summary documents.

### Sales History and Basic Reports

- Sales history route provides a permission-gated operational reporting workspace for saved orders.
- Overview, unfinished sales, outstanding balances, payment history, delivery schedule, order history, quotation history, and customer sales history are available as report views.
- Overview summarizes total orders, completed orders, unfinished orders, gross sales, total cost, gross profit, gross margin, paid amount, outstanding balance, payments received, scheduled deliveries, and pending deliveries for the selected date range.
- Order-focused reports support search, date range, order status, payment status, delivery status, staff, has-balance, has-delivery, completed-only, and unfinished-only filters.
- Order history details include client-required sales details where space allows without overcrowding summary tables.
- Quotation, payment, and delivery reports support practical search, status, staff, date range filters, and safe pagination.
- Payment, cost, profit, and balance values are hidden from users without payment visibility.
- Delivery schedule details are hidden from users without delivery visibility.
- Customer sales history composes profile, inquiry, quotation, order, payment, delivery, balance, and latest activity details according to each module permission.
- PDF download links appear only when document export permission is available and the source record has the required ID.

## Partially Implemented or Future Scope Areas

- Payment route provides read-only payment history, customer balances, receipt links, and order balance tracking. Payment creation and editing still happen from the order workspace.
- Delivery route provides a read-only delivery schedule with partial delivery quantities, provider/recipient context, status, and receipt readiness. Delivery creation and progress updates still happen from the order workspace.
- Legal numbering, finalized accounting wording, and production business details are not finalized.
- Quotation item and order item image upload actions are not implemented yet. Existing quotation/order snapshot behavior still preserves image metadata copied from product images or manually supplied item metadata.
- Upload policy exists for customer attachments, payment proof, delivery proof, and generated documents, but those categories do not yet have dedicated upload UI/actions. Stored document references can be entered from the order workspace when a finalized/exported artifact needs to be tracked.
- Documents is a generated document registry and download/search area, not a document authoring system or compliance archive.

## Not Implemented in MVP

- Inventory availability checks, stock reservation, stock deduction, warehouse allocation, or SKU-first fulfillment.
- Public ecommerce storefront, checkout, customer account, or customer portal.
- Facebook, Messenger, Viber, delivery provider, or payment gateway integrations.
- Automated payment verification, refund workflows, overpayment handling, or accounting compliance.
- Legal/BIR-compliance-grade invoice controls, official accounting receipt workflows, and tax filing logic.
- POS hardware integration, cashier sessions, barcode scanning, or receipt printer support.

## Maintenance Notes

- Keep phase documents as design references and update this status file when implementation catches up or scope changes.
- Add route-level documentation when partial module views become full workspaces.
- Update the README if setup, environment variables, or verification commands change.
