# Implementation Status

This document maps the current codebase to the phase plans in `docs/`. It should be updated whenever a phase changes from planning to shipped behavior.

## Implemented Foundation

- Next.js App Router application with authenticated dashboard layout.
- Supabase Auth session handling through middleware and server clients.
- Prisma-backed user profiles, roles, permissions, and activity logs.
- Admin-only user management for inviting and updating staff records.
- Permission-gated navigation and server actions.
- Shared validation with Zod for customer, inquiry, quotation, order, payment, delivery, and document payloads.
- Shared calculation helpers for quotation totals, order totals, payment status, delivery status, and order progress.

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
- Calculate item totals, quotation subtotal, discounts, and final total on the server.
- Update quotation status to `SENT`, `ACCEPTED`, `DECLINED`, or `CANCELLED`.

### Orders

- Convert an `ACCEPTED` quotation into one order.
- Prevent duplicate order creation from the same quotation.
- Snapshot customer, contact, address, item, image, price, discount, and note data into the order.
- Create manual orders without requiring a quotation or inventory availability.
- Recalculate order subtotal, discounts, total, paid amount, balance, payment status, delivery status, and overall order status.
- Orders workspace now serves as a day-to-day order control center with server-side search, filters, unfinished sales mode, pagination, clearer customer/contact/staff identity, payment and delivery status summaries, related quotation/inquiry context, safe notes, and protected PDF action areas.
- Orders search covers order number, customer/company/contact values, item names/product codes, inquiry source references, and permission-safe payment or delivery provider references.
- Payment totals, payment history, delivery schedules, delivery details, and document export actions are conditionally shown according to the existing payment, delivery, and document permissions.

### Payments

- Record multiple payments against an order.
- Support downpayment, partial payment, final payment, and delivery balance payment records.
- Store payment date, method, amount, reference number, payer name, customer notes, and internal notes.
- Update order paid amount, balance, last payment date, payment status, and progress status.

### Deliveries

- Create multiple delivery records for an order.
- Store provider type, provider name, provider reference, scheduled date, scheduled time window, recipient, phone, address, customer notes, and internal notes.
- Add delivery items linked to order items.
- Track planned quantity and delivered quantity for partial delivery progress.
- Update order delivery status and overall order progress.

### Documents and PDFs

- Centralized static Furniture Odyssey PDF/business profile placeholders in code config.
- Shared PDF formatting helpers cover PHP currency, dates, quantities, fallback text, document numbers, and status labels.
- Store order document metadata, including type, title, Cloudinary public ID, secure URL, status, generated date, and notes.
- Generate downloadable PDFs with React-PDF for:
  - Quotation
  - Invoice
  - Payment receipt
  - Delivery receipt
  - Final order summary
- PDF output includes Furniture Odyssey branding, customer-facing notes, payment instructions, item images when snapshot image data exists, safer missing-value fallbacks, and clearer receipt/delivery handoff sections.
- Protect PDF download routes with document export permission and source module view permissions.

### Sales History and Basic Reports

- Sales history route provides permission-gated operational reporting for saved orders.
- Quotation history, order history, unfinished sales, payment history, outstanding balances, delivery schedules, and customer sales history are available as report views.
- Report views support search, status filters, staff filters, and date range filters.
- Payment and balance values are hidden from users without payment visibility.
- Delivery schedule details are hidden from users without delivery visibility.
- Customer sales history composes related records according to each module permission.

## Partially Implemented or Placeholder Areas

- Product reference catalog data model exists, but a dedicated product management screen is not listed in the dashboard navigation yet.
- Payment, delivery, document, and sales history routes exist as module entry points; the working payment, delivery, and document forms currently live inside the order workspace.
- Settings page is a placeholder.
- Legal numbering, finalized accounting wording, and production business details are not finalized.
- Assembly-required delivery data is not modeled yet; delivery receipt PDFs show this as not specified until a future workflow adds the field.
- Cloudinary upload integration is not automated in the UI; forms currently store Cloudinary metadata supplied to the application.

## Not Implemented in MVP

- Inventory availability checks, stock reservation, stock deduction, warehouse allocation, or SKU-first fulfillment.
- Public ecommerce storefront, checkout, customer account, or customer portal.
- Facebook, Messenger, Viber, delivery provider, or payment gateway integrations.
- Automated payment verification, refund workflows, overpayment handling, or accounting compliance.
- POS hardware integration, cashier sessions, barcode scanning, or receipt printer support.

## Maintenance Notes

- Keep phase documents as design references and update this status file when implementation catches up or scope changes.
- Add route-level documentation when placeholder modules become full workspaces.
- Update the README if setup, environment variables, or verification commands change.
