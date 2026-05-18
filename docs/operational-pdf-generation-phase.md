# Operational PDF Generation Phase

## Phase Goal

Create the internal document generation workflow that lets Admin and Staff generate downloadable operational PDFs from saved Furniture Odyssey business records.

This phase turns existing quotation, order, payment, delivery, and document data into generated PDFs using React-PDF. It must not finalize visual layouts, legal numbering, tax/VAT treatment, company header design, logo usage, bank details, signature blocks, or Canva template matching unless those rules are separately confirmed.

## Primary Users

- Admin
- Staff

## Core Principles

- PDFs are generated from saved internal records, not unsaved form state.
- React-PDF is the rendering tool for generated PDF documents.
- Each document type should have a dedicated data fetcher and React-PDF component.
- Shared document data should come from common server-side helpers so totals, customer snapshots, company settings, and generated metadata stay consistent.
- Quotation PDFs read quotation records and quotation item snapshots.
- Invoice PDFs read confirmed order records and order item snapshots.
- Payment receipt PDFs read one saved payment and its related order and customer records.
- Delivery receipt PDFs read one saved delivery and its delivery items.
- Final order summary PDFs read the full saved order, including items, payments, deliveries, balances, and generated document references when relevant.
- POS/order history PDFs are excluded from MVP unless Furniture Odyssey explicitly confirms that this document type is needed.
- PDFs must not expose internal notes, cost, margin, profit, or sensitive financial summaries unless the user has explicit permission and the document policy requires the field.
- Generated files may be downloaded directly without storage, or optionally uploaded to Cloudinary with PostgreSQL storing metadata only.
- PostgreSQL must not store PDF binaries.
- Regenerating a document should create a new document record or version instead of silently replacing the historical file.

## In Scope

- React-PDF setup for operational document generation.
- Shared PDF data source planning.
- Static company information source planning.
- Dynamic customer, item, payment, and delivery information source planning.
- Quotation PDF generation from quotation records.
- Invoice PDF generation from order records.
- Payment receipt PDF generation from payment records.
- Delivery receipt PDF generation from delivery records.
- Final order summary PDF generation from order, payment, delivery, and document records.
- POS/order history PDF planning only as a deferred, confirmation-gated document type.
- PDF generation actions from quotation detail and order detail workflows.
- Browser download behavior for generated PDFs.
- Optional Cloudinary upload strategy for generated PDFs.
- PostgreSQL metadata storage for stored PDFs.
- Permission checks for document visibility, generation, download, and financial data exposure.
- Activity/history entries for PDF generation.

## Out of Scope

- Final PDF visual layout design.
- Final company header, footer, logo placement, or brand treatment.
- Bank account details, payment instructions, or remittance wording unless later configured.
- Document numbering formats or sequence rules.
- Quotation validity period rules.
- Invoice, official receipt, VAT, withholding tax, service charge, BIR, or accounting compliance rules.
- Canva template matching.
- Customer portal PDF access.
- Email, Messenger, Facebook, or Viber sending workflows.
- E-signatures, signature capture, or signed PDF archival.
- PDF editing after generation.
- Merging multiple document types into a single packet.
- Public ecommerce receipts or checkout confirmations.

## Document Types

### Quotation PDF

Generated from a saved quotation.

Required data:

- Static company information if configured.
- Quotation ID.
- Quotation number only when numbering rules exist.
- Generated document metadata.
- Customer display name.
- Customer type, company name, and contact person when available.
- Selected customer contact and address context when saved on the quotation.
- Quotation item snapshots.
- Quotation item images selected for the quotation when included by the document policy.
- Quantities.
- Unit prices.
- Item discounts.
- Line totals.
- Quotation-level discount.
- Subtotal and total.
- Currency.
- Customer-facing quotation notes.

Rules:

- Use quotation records and quotation item snapshots, not live product records.
- Do not include internal quotation notes.
- Do not assume validity dates, tax rows, or quotation numbering.
- Do not require quotation acceptance before generating a quotation PDF unless a later workflow requires it.

### Invoice PDF

Generated from a saved order.

Required data:

- Static company information if configured.
- Order ID.
- Order number only when numbering rules exist.
- Invoice document metadata.
- Customer display name.
- Customer type, company name, and contact person when available.
- Billing address snapshot when saved.
- Order item snapshots.
- Quantities.
- Unit prices.
- Item discounts.
- Line totals.
- Order-level discount.
- Subtotal and total.
- Currency.
- Paid amount and balance only when invoice policy and permissions allow.
- Customer-facing order notes when relevant.

Rules:

- Use saved order and order item snapshots.
- Do not include cost, margin, profit, internal notes, or source quotation internal notes.
- Do not assume official invoice numbering, VAT, tax, withholding, or accounting language.
- Invoice generation should require an existing order, preferably a confirmed order unless manual draft invoice behavior is explicitly confirmed later.

### Payment Receipt PDF

Generated from one saved payment.

Required data:

- Static company information if configured.
- Payment receipt document metadata.
- Order ID and order number when available.
- Customer display name and selected contact context.
- Payment ID.
- Payment number only when numbering rules exist.
- Payment type.
- Payment date.
- Payment amount.
- Payment method when entered.
- Reference number when entered.
- Payer name when entered.
- Received by user display name when available.
- Order total.
- Paid amount before this payment when available.
- Paid amount after this payment.
- Remaining balance after this payment.
- Currency.
- Customer-facing receipt note.

Rules:

- Generate from saved payment records only.
- Link the document to both the order and the specific payment.
- Do not include internal payment notes, cost, margin, profit, or unapproved accounting/legal wording.
- Receipt data should show balance after payment so Staff and customer can understand what remains due.

### Delivery Receipt PDF

Generated from one saved delivery.

Required data:

- Static company information if configured.
- Delivery receipt document metadata.
- Order ID and order number when available.
- Customer display name and selected contact context.
- Delivery ID.
- Delivery number only when numbering rules exist.
- Delivery status.
- Scheduled date.
- Scheduled time or time window when entered.
- Delivery provider type, provider name, and provider reference when entered.
- Delivery address snapshot.
- Recipient name and phone when entered.
- Delivery items linked to order item snapshots.
- Quantity ordered.
- Quantity included in this delivery.
- Quantity delivered for this delivery when available.
- Remaining undelivered quantity when useful.
- Customer-facing delivery notes.

Rules:

- Generate from saved delivery and delivery item records only.
- Link the document to both the order and the specific delivery.
- Include only the items and quantities assigned to that delivery.
- Do not include payment details unless a later document policy explicitly includes balance due and the user has permission.
- Do not include internal delivery notes, cost, margin, or profit.

### Final Order Summary PDF

Generated from a saved order after Staff needs a consolidated customer-facing order summary.

Required data:

- Static company information if configured.
- Final summary document metadata.
- Order ID and order number when available.
- Customer display name and selected contact/address snapshots.
- Order item snapshots.
- Quantities, unit prices, discounts, line totals, subtotal, order discount, total, paid amount, and balance.
- Payment history summary when the user has payment visibility and the document policy allows it.
- Delivery history summary when delivery records exist.
- Customer-facing order, payment, and delivery notes when relevant.
- Currency.

Rules:

- Use saved order records, order item snapshots, payment records, and delivery records.
- Do not include internal notes, cost, margin, profit, or staff-only financial summaries.
- Do not treat this document as an accounting statement unless later rules define that behavior.
- This document should be generated from the order detail Documents tab after order operations exist.

### POS/Order History PDF

This document type is confirmation-gated.

Rules:

- Do not implement POS/order history PDF generation in the MVP unless Furniture Odyssey explicitly confirms the need.
- If confirmed later, define whether it is a customer-facing order history, an internal POS-style transaction printout, or an admin sales report before implementation.
- Do not assume POS hardware, receipt printers, cashier sessions, barcode workflows, or ecommerce checkout behavior.

## React-PDF Plan

Use React-PDF for server-side PDF rendering.

Recommended structure:

- `lib/pdf/types.ts` for shared PDF data contracts.
- `lib/pdf/company-data.ts` for static company information retrieval.
- `lib/pdf/formatters.ts` for money, date, quantity, and address formatting helpers.
- `lib/pdf/render.ts` for shared render-to-buffer and render-to-stream helpers.
- `lib/pdf/documents/quotation-pdf.tsx`.
- `lib/pdf/documents/invoice-pdf.tsx`.
- `lib/pdf/documents/payment-receipt-pdf.tsx`.
- `lib/pdf/documents/delivery-receipt-pdf.tsx`.
- `lib/pdf/documents/final-order-summary-pdf.tsx`.
- `lib/pdf/data/quotation-pdf-data.ts`.
- `lib/pdf/data/invoice-pdf-data.ts`.
- `lib/pdf/data/payment-receipt-pdf-data.ts`.
- `lib/pdf/data/delivery-receipt-pdf-data.ts`.
- `lib/pdf/data/final-order-summary-pdf-data.ts`.

Rules:

- React-PDF components should receive already-normalized data objects.
- React-PDF components should not query Prisma directly.
- Data fetchers should run server-side and enforce permissions before returning data.
- Shared formatting helpers should avoid layout decisions beyond stable values for money, dates, quantities, and addresses.
- Document components may start with simple functional layouts for validation, but final polished layouts are a separate phase.
- Font registration should be centralized if custom fonts are introduced later.
- Image usage should read Cloudinary URLs and metadata already saved to PostgreSQL.
- Missing optional company, contact, address, image, number, and note fields should not block PDF generation.

## Shared PDF Data Sources

### Static Company Information

Use a configurable company settings source instead of hardcoding final business details.

Recommended fields:

- `companyDisplayName`
- `companyAddress` nullable
- `companyPhone` nullable
- `companyEmail` nullable
- `companyWebsite` nullable
- `logoCloudinaryPublicId` nullable
- `logoSecureUrl` nullable
- `defaultCurrency` default `PHP`
- `documentFooterText` nullable
- `updatedById`
- `createdAt`
- `updatedAt`

Rules:

- Do not assume exact company header content.
- Do not require a logo to generate PDFs.
- Do not assume bank details.
- If bank details are later configured, store and expose them through permission-controlled settings and document policy.
- Company settings should be admin-editable in a later settings phase.

### Dynamic Customer Data

PDF data should use saved customer snapshots where they exist.

Recommended sources:

- Quotation customer fields and selected contact/address context for quotation PDFs.
- Order customer snapshots for invoice, receipt, delivery receipt, and final summary PDFs.
- Delivery-specific recipient and address snapshots for delivery receipt PDFs.

Rules:

- Historical PDFs should not change because a customer profile was edited later.
- Live customer records may be used only when no saved snapshot exists and the document policy allows fallback behavior.
- Internal customer notes must not appear on PDFs.

### Dynamic Item Data

PDF data should use saved item snapshots.

Recommended sources:

- Quotation item snapshots for quotation PDFs.
- Order item snapshots for invoice, delivery receipt, and final order summary PDFs.
- Delivery item quantities linked to order items for delivery receipt PDFs.

Rules:

- Do not use live product catalog fields for generated operational PDFs.
- Include custom/manual items the same way as catalog-backed items.
- Use saved Cloudinary image references only.
- Do not expose reference cost, margin, profit, or internal item notes.

### Dynamic Payment Data

PDF data should use saved payment records.

Recommended sources:

- Payment receipt PDF reads one payment plus calculated before/after balance context.
- Final order summary PDF may include payment history when permitted.
- Invoice PDF may include paid amount and balance only when invoice policy allows it.

Rules:

- Payment data requires payment visibility permission.
- Do not expose internal payment notes.
- Do not assume final payment method enum or legal receipt wording.

### Dynamic Delivery Data

PDF data should use saved delivery records.

Recommended sources:

- Delivery receipt PDF reads one delivery and its delivery items.
- Final order summary PDF may include delivery summary and delivery history.

Rules:

- Delivery-specific address and recipient snapshots take priority over customer defaults.
- Delivery receipt PDFs include only assigned delivery items.
- Internal delivery notes must not appear on PDFs.

## PDF Generation Flow

### Direct Download Flow

1. Staff opens a quotation or order detail page.
2. Staff chooses a permitted document action.
3. The server validates the requested document type and target record ID.
4. The server checks document generation permissions.
5. The server fetches normalized PDF data from saved records.
6. The server renders the React-PDF document.
7. The server returns a PDF response with `Content-Type: application/pdf`.
8. The browser downloads the file using a generated filename.
9. The system may create an activity log entry for generation or download.

Rules:

- Direct download does not require Cloudinary storage.
- Direct download may skip `OrderDocument` creation if Furniture Odyssey does not need historical document records for every generated file.
- If direct download creates a document record, mark it as generated without Cloudinary fields and record `generatedAt` and `generatedById`.

### Stored Document Flow

1. Staff opens a quotation or order detail page.
2. Staff chooses "Generate and save" for a permitted document type.
3. The server validates the requested document type and target record ID.
4. The server checks document generation permissions.
5. The server fetches normalized PDF data from saved records.
6. The server renders the React-PDF document to a buffer.
7. The server uploads the PDF to Cloudinary as a raw file or supported document resource.
8. The server creates an `OrderDocument` or quotation document metadata record with Cloudinary metadata.
9. The server records generated timestamp, generated user, document type, linked order/payment/delivery/quotation IDs, and file metadata.
10. The server returns the stored document record and download URL.
11. The Documents tab shows the generated document.

Rules:

- Store only Cloudinary metadata in PostgreSQL.
- Do not store PDF binaries in PostgreSQL.
- Do not overwrite prior generated documents unless explicit versioning rules are implemented.
- Stored documents should be immutable by default except for status, notes, and administrative metadata.

## PDF Download Behavior

- Each document action should produce a clear file download.
- Filenames should be generated from safe available values such as document type, record ID, optional order number, optional quotation number, and generation date.
- Missing document numbers should not block filename generation.
- Staff should be able to download the newest generated file from the Documents tab when stored.
- Historical generated files should remain downloadable as long as their Cloudinary resource is available.
- Download actions should be permission-controlled.
- Downloaded PDFs should not expose fields hidden from the user's permission level.

## Optional Cloudinary Storage Strategy

Cloudinary storage is optional for generated PDFs in the MVP.

Recommended MVP options:

- Use direct download for fast implementation when document history is not required.
- Use Cloudinary storage for documents Furniture Odyssey needs to preserve, re-download, audit, or reference later.

Recommended Cloudinary metadata:

- `cloudinaryPublicId`
- `secureUrl`
- `resourceType`
- `format`
- `bytes`
- `version` nullable
- `etag` nullable
- `originalFilename` nullable
- `generatedFilename`

Rules:

- Use Cloudinary for generated PDF files only when storage is explicitly chosen for that document action.
- Store generated PDFs as Cloudinary-managed files, not database blobs.
- Cloudinary folders or public ID naming conventions should be operational and stable, but final naming format can be refined later.
- If a generated PDF contains sensitive financial data, avoid public unsigned access unless the app controls download authorization.

## PostgreSQL Metadata Storage

### OrderDocument

Use `OrderDocument` for order-related generated PDFs.

Recommended fields:

- `id`
- `orderId`
- `quotationId` nullable
- `paymentId` nullable
- `deliveryId` nullable
- `documentType` enum: `QUOTATION_PDF`, `INVOICE`, `PAYMENT_RECEIPT`, `DELIVERY_RECEIPT`, `FINAL_ORDER_SUMMARY`, `OTHER`
- `status` enum: `GENERATED`, `VOIDED`, `SUPERSEDED`
- `title`
- `generatedFilename`
- `cloudinaryPublicId` nullable
- `secureUrl` nullable
- `resourceType` nullable
- `format` nullable
- `bytes` nullable
- `generatedAt`
- `generatedById`
- `sourceUpdatedAt` nullable
- `dataHash` nullable
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
- `generatedAt`
- `generatedById`

Rules:

- Invoice, payment receipt, delivery receipt, and final order summary PDFs belong to an order.
- Payment receipt documents should link to one payment.
- Delivery receipt documents should link to one delivery.
- Quotation PDFs may link to `quotationId`; if generated before order conversion, use a quotation document metadata model or allow nullable `orderId` only if the final schema supports quotation-only documents.
- `sourceUpdatedAt` or `dataHash` can support stale-document warnings later.
- `SUPERSEDED` can mark older versions if regeneration creates a newer document.

### QuotationDocument Option

If quotation PDFs must be stored before an order exists, add a quotation-scoped document metadata model.

Recommended fields:

- `id`
- `quotationId`
- `documentType` enum: `QUOTATION_PDF`
- `status` enum: `GENERATED`, `VOIDED`, `SUPERSEDED`
- `title`
- `generatedFilename`
- `cloudinaryPublicId` nullable
- `secureUrl` nullable
- `resourceType` nullable
- `format` nullable
- `bytes` nullable
- `generatedAt`
- `generatedById`
- `sourceUpdatedAt` nullable
- `dataHash` nullable
- `notes` nullable long text
- `createdAt`
- `updatedAt`

Rules:

- Use this only if `OrderDocument` should remain order-scoped.
- When a quotation converts to an order, the order can reference quotation documents through `quotationId` rather than copying the PDF file.

## Permissions Plan

Use the existing role and permission model.

Recommended permissions:

- Document list/detail visibility requires `DOCUMENTS:VIEW`.
- PDF generation requires `DOCUMENTS:CREATE` or `DOCUMENTS:EXPORT`.
- Stored document download requires `DOCUMENTS:VIEW` plus access to the linked quotation or order.
- Quotation PDF generation requires quotation view access.
- Invoice and final order summary generation require order view access.
- Payment receipt generation requires payment view access and access to the linked order.
- Delivery receipt generation requires delivery view access and access to the linked order.
- Payment, balance, and financial data inside PDFs require payment visibility and any configured financial visibility permission.
- Admin can generate and download all operational PDFs.
- Staff can generate and download PDFs for records they can access and document types they are permitted to create/export.

Implementation notes:

- Enforce permissions in server actions or route handlers, not only in UI buttons.
- Document data fetchers should return only fields allowed by the user's permissions.
- Do not expose Cloudinary URLs for documents the user cannot access.
- Activity logs should record document generation and stored-document downloads when useful for audit.

## Relationship Plan

- A quotation may have many quotation PDF documents if quotation document storage is enabled.
- An order has many generated documents.
- An order document may optionally link to a quotation, payment, or delivery.
- A payment may have many payment receipt documents.
- A delivery may have many delivery receipt documents.
- Generated documents belong to the user who generated them when user data is available.
- Cloudinary stores generated files when storage is enabled.
- PostgreSQL stores generated document metadata only.

## UI Plan

### Quotation Detail

- Show a permitted action to generate or download a quotation PDF.
- If stored quotation documents exist, show document history for generated quotation PDFs.
- Show a warning only if stale-document detection is implemented and source data changed after generation.

### Order Detail Documents Tab

- Show document actions for invoice, payment receipt, delivery receipt, final order summary, and any previously generated order documents.
- Payment receipt actions should be available from payment rows when a payment exists.
- Delivery receipt actions should be available from delivery rows when a delivery exists.
- Stored documents should list document type, title, status, generated date, generated by, linked payment or delivery when applicable, and download action.
- Do not show POS/order history PDF action unless confirmed.

### Documents Page

- List generated operational PDFs and uploaded document references when available.
- Filter by document type, status, customer, order, generated date, and generated by.
- Provide download actions for permitted users.
- Avoid exposing sensitive payment or financial details in list rows unless permission-controlled.

## Validation Rules

- Document type is required.
- Target record ID is required.
- Quotation PDF requires a valid quotation ID.
- Invoice PDF requires a valid order ID.
- Payment receipt PDF requires a valid payment ID linked to the selected order.
- Delivery receipt PDF requires a valid delivery ID linked to the selected order.
- Final order summary PDF requires a valid order ID.
- POS/order history PDF requests must be rejected until the document type is confirmed and implemented.
- Generated document metadata requires document type, generated timestamp, generated by user, and linked source record IDs.
- Stored Cloudinary document metadata requires at least public ID, secure URL, resource type, format, and bytes when Cloudinary upload succeeds.
- PDF generation should fail gracefully when optional company fields, logo, contact values, address values, document numbers, or images are missing.
- User-provided notes included in PDFs must be customer-facing notes only.
- Internal notes must be excluded from generated PDF data.

## Reporting Impact

- Document reports can show how many quotations, invoices, payment receipts, delivery receipts, and final summaries were generated.
- Order history can show generated document count and latest generated document date.
- Payment rows can show receipt generated or not generated.
- Delivery rows can show delivery receipt generated or not generated.
- Stale-document reporting can be added later using `sourceUpdatedAt` or `dataHash`.
- PDF generation itself should not change order totals, payment balances, delivery status, or sales history amounts.

## Acceptance Criteria

- Staff can generate a downloadable quotation PDF from a saved quotation.
- Staff can generate a downloadable invoice PDF from a saved order.
- Staff can generate a downloadable payment receipt PDF from a saved payment.
- Staff can generate a downloadable delivery receipt PDF from a saved delivery.
- Staff can generate a downloadable final order summary PDF from a saved order.
- POS/order history PDF generation is not available unless explicitly confirmed.
- React-PDF document components render from normalized data objects.
- PDF data fetchers read saved quotation, order, payment, delivery, and document records.
- Static company information is optional and configurable.
- Missing logo, bank details, numbering, tax rules, or final visual design does not block operational PDF generation.
- Generated PDFs do not include internal notes, cost, margin, profit, or unauthorized financial data.
- Direct download works without Cloudinary storage.
- Stored PDF generation can upload to Cloudinary and persist metadata in PostgreSQL.
- PostgreSQL stores metadata only, not PDF binaries.
- Stored documents appear in the related Documents tab or Documents page.
- PDF generation and download actions are permission-controlled.
- Activity/history entries are created for generated PDFs when audit logging is available.

## Implementation Sequence

1. Confirm whether this phase will start with direct-download PDFs only or include Cloudinary storage for generated files.
2. Add or refine document type enums for `QUOTATION_PDF`, `INVOICE`, `PAYMENT_RECEIPT`, `DELIVERY_RECEIPT`, and `FINAL_ORDER_SUMMARY`.
3. Keep POS/order history PDF out of the enum or hide it behind an explicit feature decision until confirmed.
4. Add or refine document status values for generated, superseded, and voided document metadata.
5. Add or refine company document settings for optional static company information.
6. Add or refine `OrderDocument` fields for generated filename, generated metadata, Cloudinary metadata, source timestamp, and optional data hash.
7. Add a quotation document metadata model if quotation PDFs need storage before order conversion.
8. Create shared PDF TypeScript data contracts.
9. Create shared money, date, quantity, address, and filename formatting helpers.
10. Create server-side data fetchers for quotation PDF, invoice PDF, payment receipt PDF, delivery receipt PDF, and final order summary PDF.
11. Add permission checks inside every PDF data fetcher or generation action.
12. Create initial React-PDF components for each confirmed document type with simple functional structure only.
13. Add render helpers for PDF buffer and direct PDF response generation.
14. Add optional Cloudinary upload helper for rendered PDF buffers.
15. Add server actions or route handlers for generating and downloading each document type.
16. Add document metadata creation inside the stored document flow.
17. Add UI actions on quotation detail, order Documents tab, payment rows, and delivery rows.
18. Add Documents page updates for stored generated PDFs.
19. Add activity log entries for PDF generation and stored-document download where needed.
20. Add tests for data fetcher completeness, permission filtering, document type validation, direct downloads, optional Cloudinary metadata persistence, and internal field exclusion.

## Future Extensions

- Final polished React-PDF layouts.
- Company header, logo, footer, and document branding rules.
- Document numbering sequences and prefixes.
- Quotation validity dates.
- Bank details and payment instruction blocks.
- Tax, VAT, withholding, service charge, official receipt, invoice, and accounting compliance rules.
- Canva template matching if Furniture Odyssey later requires it.
- Document versioning UI and stale-document warnings.
- Customer portal document access.
- Email, Messenger, Facebook, or Viber document sending.
- POS/order history PDF after explicit confirmation.
- Signature blocks, signature capture, signed delivery receipts, or customer acknowledgment.
- Batch export or document packet generation.
