# AGENTS.md

## Global System Context

We are building an internal sales operations system for Furniture Odyssey.

This is not a full ecommerce platform, not a chatbot, and not an inventory-first system. It is primarily an internal dashboard for managing customer inquiries, quotations, orders, payments, deliveries, downloadable PDFs, and sales tracking.

Furniture Odyssey currently manages operations through Facebook Marketplace, Facebook Page/Messenger, Viber, Excel, Canva, OneNote, notebooks, and calendar tools. The current workflow is manual and fragmented.

Customers usually inquire through Facebook Marketplace, Facebook Page/Messenger, and Viber. Company clients often communicate through Viber. Sales staff manually respond to inquiries, prepare quotations, negotiate prices, confirm orders, record payments, schedule deliveries, and prepare documents such as quotations, invoices, receipts, and delivery receipts.

The MVP should help Admin and Staff replace scattered manual work with a structured internal system.

## Confirmed Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Table
- Supabase PostgreSQL
- Prisma
- Supabase Auth
- Cloudinary
- React-PDF
- Vercel
- React Hook Form
- Zod

## Main Users

- Admin
- Staff

## System Principles

- Do not force fixed pricing.
- Do not require inventory to create an order in MVP.
- Allow manual price override.
- Allow custom/manual items.
- Allow one order to have multiple payments.
- Allow one order to have multiple deliveries.
- Support partial payments.
- Support partial deliveries.
- Protect sensitive financial or cost/profit data through permissions.
- Use Cloudinary for images and generated media.
- Store only Cloudinary metadata in PostgreSQL.
- Use PostgreSQL for business records.
- Keep MVP focused on quotation, order, payment, delivery, PDF, and sales tracking.
- Defer full inventory, customer portal, AI chatbot, and messaging integrations.

## Implementation Guidance

- Prioritize internal Admin and Staff workflows over public customer-facing ecommerce behavior.
- Model quotations, orders, payments, deliveries, documents, and sales tracking as core business records.
- Treat inventory as optional supporting context in the MVP, not as a blocking dependency for order creation.
- Design pricing flows around negotiated and manually adjusted prices.
- Use permission checks before exposing sensitive cost, profit, payment, or financial summary data.
- Store uploaded/generated media in Cloudinary and persist only references, identifiers, URLs, and related metadata in PostgreSQL.
- Prefer focused MVP behavior over speculative integrations with Facebook, Messenger, Viber, AI chat, or customer portals.
