# Furniture Odyssey POS

Internal sales operations dashboard for Furniture Odyssey.

This application is focused on the manual sales workflow used by Admin and Staff: customer records, inquiries, quotations, negotiated orders, payments, deliveries, downloadable operational PDFs, permissions, and activity tracking. It is not a public ecommerce storefront, inventory-first system, chatbot, or customer portal.

## Current Scope

- Customer records for individual and company clients.
- Customer contacts for phone, Viber, Facebook, email, and other manual channels.
- Inquiry tracking from Facebook Marketplace, Facebook Page, Messenger, Viber, walk-in, phone, referral, and other sources.
- Manual-friendly quotation creation with catalog product references and custom items.
- Negotiated pricing with item-level and quotation-level discounts.
- Approved quotation conversion into an operational order.
- Manual order creation for sales that do not start from a quotation.
- Multiple payments per order with downpayment, partial payment, final payment, and delivery balance payment types.
- Multiple deliveries per order with partial delivery quantities.
- Document metadata records for generated or uploaded operational documents.
- React-PDF download routes for quotation, invoice, payment receipt, delivery receipt, and final order summary PDFs.
- Supabase Auth-backed login with Prisma user profiles, roles, permissions, and activity logs.

## Out of Scope for the MVP

- Public product catalog, cart, checkout, or customer accounts.
- Required inventory checks, stock reservation, stock deduction, or warehouse allocation.
- Facebook, Messenger, Viber, delivery provider, or payment gateway integrations.
- POS hardware, cashier sessions, receipt printers, barcode scanners, or cash drawer handling.
- Automated payment verification, accounting compliance, BIR/VAT rules, or final legal receipt numbering.
- Customer portal access to quotations, deliveries, or PDFs.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn-style local UI primitives
- Prisma
- Supabase PostgreSQL
- Supabase Auth
- React-PDF
- React Hook Form patterns through server actions and validated form payloads
- Zod validation

## Main App Areas

| Route | Purpose |
| --- | --- |
| `/login` | Supabase email/password login |
| `/dashboard` | Internal dashboard landing page |
| `/customers` | Customer creation, search, contacts, and customer context |
| `/inquiries` | Inquiry capture and follow-up context |
| `/quotations` | Draft quotations, custom items, discounts, and approval status updates |
| `/orders` | Quotation conversion, manual orders, payments, deliveries, and document records |
| `/payments` | Payment module entry point |
| `/deliveries` | Delivery module entry point |
| `/documents` | Document module entry point |
| `/sales-history` | Sales history module entry point |
| `/users` | Admin user and permission management |
| `/settings` | Admin settings placeholder |

Some module entry pages are placeholders while the working order, payment, delivery, and document workflows are available from the order workspace.

## Data Model Overview

The Prisma schema models the operational records used by the MVP:

- `UserProfile`, `UserPermission`, and `ActivityLog` for authenticated staff access, permissions, and audit history.
- `Customer`, `CustomerContact`, and `CustomerAddress` for customer records and manual communication context.
- `Inquiry` for inbound sales requests.
- `Product` and `ProductImage` as optional internal catalog references, not fixed ecommerce SKUs.
- `Quotation`, `QuotationItem`, and `QuotationItemImage` for negotiated quote preparation.
- `Order`, `OrderItem`, and `OrderItemImage` for confirmed operational sales records.
- `Payment` for multiple payment records and balance tracking.
- `Delivery` and `DeliveryItem` for scheduled and partial deliveries.
- `OrderDocument` for generated or uploaded document metadata.

Historical records use snapshots for customer, product, item, price, discount, image, payment, and delivery details so later edits do not silently change saved orders or documents.

## Environment Variables

For local development, copy `.env.example` to `.env` and `.env.local`, then fill in the Supabase keys from `supabase status` after the local stack starts:

```bash
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55522/postgres?schema=public"
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:55522/postgres?schema=public"
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:55521"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-local-or-hosted-supabase-publishable-key"
SUPABASE_SERVICE_ROLE_KEY="your-local-or-hosted-server-only-secret-key"
FIRST_ADMIN_AUTH_USER_ID=""
FIRST_ADMIN_EMAIL="admin@example.com"
FIRST_ADMIN_NAME="Furniture Odyssey Admin"
```

`FIRST_ADMIN_*` values are only needed when running the seed script to create the first active Admin profile. The auth user must already exist in Supabase Auth.

The committed Supabase local config uses a `555xx` port range to avoid conflicts with other local Supabase projects:

| Service | URL |
| --- | --- |
| Supabase API | `http://127.0.0.1:55521` |
| Supabase Studio | `http://127.0.0.1:55523` |
| Mailpit | `http://127.0.0.1:55524` |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:55522/postgres` |

## Local Development

Install dependencies:

```bash
npm install
```

Start Supabase locally. Docker Desktop must be running first.

```bash
supabase start
supabase status
```

Copy the `Project URL`, `Publishable`, and `Secret` values from `supabase status` into `.env` and `.env.local`.

Generate the Prisma client:

```bash
npm run prisma:generate
```

Push the Prisma schema to the configured database:

```bash
npm run prisma:push
```

Create a local Supabase Auth test user in Supabase Studio or through the Auth Admin API. Use that auth user's ID as `FIRST_ADMIN_AUTH_USER_ID`, then seed the first Admin profile:

```bash
npm run seed
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`. If that port is already in use, run:

```bash
PORT=3003 npm run dev
```

Then open `http://localhost:3003`.

## Verification Commands

```bash
npm run typecheck
npm run lint
npm run build
```

`npm run build` runs `prisma generate` before the Next.js production build.

## Documentation

Phase documents live in `docs/`:

- `docs/product-reference-catalog-for-quotations-phase.md`
- `docs/manual-friendly-quotation-builder-phase.md`
- `docs/approved-quotation-to-order-pos-workflow-phase.md`
- `docs/downpayment-partial-payment-balance-tracking-phase.md`
- `docs/delivery-scheduling-and-partial-delivery-handling-phase.md`
- `docs/operational-pdf-generation-phase.md`
- `docs/sales-history-unfinished-sales-basic-reports-phase.md`
- `docs/mvp-stabilization-and-furniture-odyssey-pilot-testing-phase.md`
- `docs/mvp-pilot-testing-execution-checklist.md`
- `docs/implementation-status.md`
