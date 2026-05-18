# MVP Stabilization and Furniture Odyssey Pilot Testing Phase

## Phase Goal

Stabilize the MVP by testing it against Furniture Odyssey's real internal sales workflow before any controlled client use.

This phase verifies that Admin and Staff can reliably move a real sales case from inquiry capture through customer creation, quotation, quotation PDF, approved quotation conversion, payments, balance tracking, delivery scheduling, partial delivery, delivery receipt, final payment, and sales history review.

This phase must not add new product scope. It should validate the current MVP, identify blocking defects, correct data or permission issues, and confirm operational readiness for a small controlled pilot.

Use `docs/mvp-pilot-testing-execution-checklist.md` to run and record the pilot test results.

## Primary Users

- Admin
- Staff

## Core Principles

- Pilot testing uses real Furniture Odyssey workflow examples, not idealized ecommerce scenarios.
- The MVP should support manual negotiated sales, custom/manual items, manual price overrides, partial payments, and partial deliveries.
- Testing must follow saved business records from start to finish.
- PDF testing must verify generated customer-facing documents from saved records.
- Financial, payment, cost, profit, and sensitive summary data must remain permission-controlled.
- Admin and Staff roles must be tested separately.
- Data accuracy matters more than visual polish during stabilization.
- Pilot testing should produce a clear go/no-go decision before controlled client use.
- Findings should be classified as blockers, required fixes, acceptable limitations, or post-pilot follow-ups.
- Stabilization should not expand the MVP into ecommerce, chatbot automation, full inventory, customer portals, messaging integrations, or advanced reporting.

## In Scope

- End-to-end sales workflow testing.
- Inquiry to customer record testing.
- Customer to quotation testing.
- Quotation PDF testing.
- Approved quotation to order testing.
- Downpayment recording.
- Partial payment recording.
- Balance tracking.
- Delivery scheduling.
- Partial delivery handling.
- Delivery receipt PDF testing.
- Final payment recording.
- Sales history review.
- Role and permission testing for Admin and Staff.
- PDF generation, download, and content accuracy testing.
- Data accuracy checks across quotations, orders, payments, deliveries, documents, and reports.
- Pilot readiness checklist.
- Defect triage and stabilization before controlled client use.

## Out of Scope

- Public ecommerce storefront, cart, checkout, or customer account behavior.
- Chatbot automation or AI-assisted sales responses.
- Facebook, Messenger, Viber, delivery provider, payment gateway, or accounting integrations.
- Full inventory availability, stock reservation, stock deduction, warehouse allocation, or SKU-first fulfillment.
- Customer portal access to quotations, orders, deliveries, payments, or PDFs.
- Advanced reporting, charts, analytics dashboards, commissions, cost, margin, or profit reports.
- Tax, VAT, BIR, official receipt compliance, or legal numbering finalization.
- POS hardware, barcode scanners, cash drawers, receipt printers, or cashier sessions.
- New workflow modules beyond the existing MVP scope.

## Pilot Data Plan

Pilot testing should use a small set of realistic Furniture Odyssey sales scenarios.

Recommended records:

- One individual customer from a Facebook Marketplace or Messenger inquiry.
- One company customer from a Viber inquiry.
- One quotation using catalog product references with manual price overrides.
- One quotation using custom/manual items.
- One approved quotation converted into an order.
- One manually created order if Furniture Odyssey currently has direct/offline sales that do not start from a quotation.
- One order with a downpayment and one or more partial payments.
- One order with balance due before delivery.
- One order with balance due upon delivery.
- One order with multiple scheduled deliveries.
- One delivery that completes only part of the ordered quantity.
- One final payment that brings the balance to zero.

Rules:

- Use real-like names, item descriptions, quantities, prices, payment methods, delivery addresses, and notes.
- Do not use live customer personal data unless Furniture Odyssey explicitly approves it for pilot testing.
- Keep test data clearly marked when it is not an actual sale.
- Preserve generated PDFs during testing when they are needed for comparison.
- Record the expected totals before entering each scenario so the system output can be checked.

## End-to-End Sales Workflow Test

### Test Objective

Confirm that a complete negotiated sale can be handled inside the MVP without leaving required operational gaps.

### Test Flow

1. Staff records a new inquiry from a manual source such as Facebook Marketplace, Facebook Page/Messenger, Viber, phone, walk-in, referral, or other source.
2. Staff creates or links the correct customer record.
3. Staff adds customer contact details and delivery address context when available.
4. Staff creates a quotation for the customer.
5. Staff adds catalog reference items and custom/manual items as needed.
6. Staff applies manual unit prices and discounts.
7. Staff saves customer-facing notes and internal notes.
8. Staff generates and downloads the quotation PDF.
9. Staff marks the quotation as accepted after customer approval.
10. Staff converts the accepted quotation into an order.
11. Staff records a downpayment.
12. Staff records one partial payment.
13. Staff checks the remaining balance.
14. Staff schedules a delivery.
15. Staff records a partial delivery.
16. Staff generates and downloads a delivery receipt PDF.
17. Staff records the final payment.
18. Staff confirms the order payment status, delivery status, and sales history output.

### Expected Result

- The inquiry, customer, quotation, order, payment, delivery, document, and sales history records remain connected.
- Quotation and order totals match the entered item prices, quantities, and discounts.
- Payment totals update paid amount and remaining balance correctly.
- Delivery totals update delivered and undelivered quantities correctly.
- PDFs reflect saved customer-facing records and exclude internal-only information.
- Sales history shows the completed and unfinished parts of the workflow according to permissions.

## Inquiry to Customer Record Testing

Test cases:

- Create an inquiry for a new individual customer.
- Create an inquiry for a company customer with contact person details.
- Link an inquiry to an existing customer.
- Add multiple contact methods such as phone, Viber, Facebook, email, or other manual channel.
- Add delivery address context when available.
- Assign the inquiry to Staff.
- Update inquiry status, priority, requested items, budget range, delivery location, follow-up date, and last contact date when those fields are used.

Acceptance criteria:

- Staff can capture a real inquiry without requiring ecommerce checkout or inventory availability.
- Customer records are not duplicated unnecessarily when an existing customer is selected.
- Customer contact details remain available when creating quotations and orders.
- Inquiry context is visible when linked to a quotation.
- Staff can find the inquiry and customer again through the normal dashboard workflow.

## Customer to Quotation Testing

Test cases:

- Create a quotation from a customer record.
- Create a quotation from a linked inquiry.
- Add catalog reference items.
- Add custom/manual items.
- Override item name, description, specifications, quantity, unit price, discount, and notes.
- Apply quotation-level discount.
- Save customer-facing notes.
- Save internal notes.
- Update quotation status from draft to sent and accepted.

Acceptance criteria:

- Quotation creation does not require inventory stock.
- Catalog records are treated as references, not fixed-price ecommerce SKUs.
- Custom/manual items work as first-class quotation items.
- Manual price overrides are preserved.
- Item-level and quotation-level discounts calculate correctly.
- Internal notes do not appear in customer-facing documents.
- Accepted quotation data is ready for order conversion.

## Quotation PDF Testing

Test cases:

- Generate a quotation PDF from a saved draft or sent quotation.
- Download the PDF as Admin.
- Download the PDF as Staff with document permission.
- Attempt PDF access as a Staff user without required permission.
- Compare PDF customer name, contact context, item descriptions, quantities, unit prices, discounts, totals, and notes against the saved quotation.
- Confirm internal notes, cost, margin, profit, and staff-only financial summaries are absent.

Acceptance criteria:

- Quotation PDF generation uses saved quotation records and quotation item snapshots.
- The PDF can be downloaded successfully.
- PDF totals match the quotation detail page.
- PDF content is understandable for customer-facing review.
- PDF access is permission-controlled.
- No PostgreSQL record stores PDF binaries.

## Approved Quotation to Order Testing

Test cases:

- Convert an accepted quotation into an order.
- Attempt to convert the same quotation twice.
- Compare order customer, contact, address, item, image, price, discount, and note snapshots against the accepted quotation.
- Edit allowed order fields according to status and permission rules.
- Create a manual order only if the current workflow requires direct/offline sales coverage.

Acceptance criteria:

- Only accepted quotations can be converted when conversion requires approval.
- Duplicate order creation from the same quotation is prevented.
- Order snapshots do not change when the source quotation or product reference is later edited.
- Manual orders do not require quotation or inventory records.
- Order totals match the approved quotation at conversion time unless explicitly edited by a permitted user.

## Payment and Balance Testing

Test cases:

- Record a downpayment.
- Record one or more partial payments.
- Record payment due upon delivery as an order-level reminder when applicable.
- Record a delivery balance payment.
- Record a final payment that settles the balance.
- Verify payment history from the order.
- Verify payment history from the customer context or sales history when available.
- Test payment visibility for Admin and Staff with different permissions.

Acceptance criteria:

- Payment amounts must be greater than zero.
- One order can have multiple payments.
- Paid amount equals the sum of saved payment records.
- Balance equals order total minus paid amount, with no negative balance shown in the MVP.
- Payment status updates after each saved payment.
- Final payment sets balance to zero when the full remaining amount is paid.
- Payment-sensitive fields are hidden from users without payment visibility.
- Payment records remain connected to the correct customer and order.

## Delivery Scheduling and Partial Delivery Testing

Test cases:

- Schedule a delivery for an order with one or more items.
- Add delivery date, time window, provider type, provider name, provider reference, recipient, phone, and address when available.
- Assign only part of an order item quantity to a delivery.
- Mark part of the delivery quantity as delivered.
- Schedule a second delivery for remaining quantities.
- Verify delivery status after partial and complete delivery.
- Verify delivery schedule reporting when available.
- Test delivery visibility for Admin and Staff with different permissions.

Acceptance criteria:

- One order can have multiple deliveries.
- Delivery scheduling does not require full payment unless Furniture Odyssey manually chooses to wait.
- Partial delivery quantities cannot exceed ordered or remaining quantities.
- Delivered and undelivered quantities calculate correctly.
- Order delivery status updates after delivery records change.
- Balance due on delivery is visible only to users with payment or balance permission.
- Delivery data remains linked to the order and sales history.

## Delivery Receipt Testing

Test cases:

- Generate a delivery receipt PDF from a saved delivery.
- Download the delivery receipt as Admin.
- Download the delivery receipt as Staff with document permission.
- Attempt delivery receipt access as Staff without required permission.
- Compare PDF order ID, customer, address, recipient, scheduled date, delivery items, included quantities, delivered quantities, and customer-facing notes against the saved delivery.
- Confirm internal notes, cost, margin, profit, and unauthorized payment details are absent.

Acceptance criteria:

- Delivery receipt PDF generation uses saved delivery and delivery item records.
- The PDF includes only the items and quantities assigned to that delivery.
- Partial delivery wording or quantities are clear enough for Staff and customer review.
- PDF totals and quantities match the delivery detail page.
- PDF access is permission-controlled.

## Final Payment Testing

Test cases:

- Open an order with remaining balance after downpayment and partial payment.
- Record final payment for the exact remaining balance.
- Generate payment receipt PDF when receipt generation is part of the tested workflow.
- Confirm paid amount, balance amount, payment status, and order status after final payment.
- Review sales history and outstanding balance report after final payment.

Acceptance criteria:

- Final payment can be recorded without payment gateway integration.
- Balance becomes zero after exact final payment.
- Payment status becomes paid.
- Outstanding balance views no longer list the order by default.
- Payment receipt data reflects the amount paid and balance after payment.

## Sales History Testing

Test cases:

- Review quotation history.
- Review order history.
- Review unfinished sales.
- Review payment history.
- Review outstanding balances before and after final payment.
- Review delivery schedule.
- Review customer sales history.
- Search by customer, order, quotation, contact value, reference number, item name, and staff name when available.
- Filter by status, staff, date range, payment status, delivery status, source, and document status when available.
- Open source records from report rows.

Acceptance criteria:

- Reports read saved business records, not unsaved form state.
- Sales history reflects order, payment, delivery, and document progress.
- Unfinished sales identifies records that still need Staff action.
- Outstanding balances update after each payment.
- Delivery schedule reflects scheduled and partially delivered records.
- Permission-restricted financial fields are hidden from users without access.
- Report links return users to the correct source records.

## Role and Permission Testing

Test users:

- Admin with full MVP permissions.
- Staff with standard sales workflow permissions.
- Staff with restricted payment visibility.
- Staff with restricted document export permission.
- Staff with restricted delivery visibility when applicable.

Test areas:

- Navigation visibility.
- Route access.
- Server action authorization.
- Customer and inquiry access.
- Quotation create, view, update, and status changes.
- Order create, view, update, and conversion.
- Payment view and record permissions.
- Delivery view and update permissions.
- Document generate and download permissions.
- Sales history row, column, and summary visibility.
- Sensitive financial data visibility.

Acceptance criteria:

- Admin can perform the full pilot workflow.
- Staff can perform only the actions their role allows.
- Users without permission are blocked at both UI and server-action levels.
- Sensitive payment, balance, cost, profit, margin, and internal financial summaries are not exposed accidentally.
- Permission errors are understandable and do not expose protected data.

## PDF Testing Plan

PDFs to test:

- Quotation PDF.
- Invoice PDF when generated from order records.
- Payment receipt PDF.
- Delivery receipt PDF.
- Final order summary PDF.

Checks for every generated PDF:

- Generated from saved records only.
- Downloads successfully in the browser.
- Correct document type and source record.
- Correct customer display name and contact context.
- Correct item names, descriptions, quantities, unit prices, discounts, and totals when relevant.
- Correct payment amount, paid amount, and balance when relevant and permitted.
- Correct delivery items and quantities when relevant.
- Customer-facing notes appear where intended.
- Internal notes do not appear.
- Cost, margin, profit, and unauthorized financial summaries do not appear.
- PDF route requires the correct document and source module permissions.
- Regeneration behavior does not silently overwrite historical records when document records are stored.

## Data Accuracy Checks

Required checks:

- Quotation line subtotal equals quantity multiplied by unit price.
- Quotation item discount amount matches discount type and value.
- Quotation total equals subtotal minus item discounts minus quotation-level discount.
- Order item snapshots match accepted quotation item snapshots at conversion.
- Order total matches order item totals and order-level discount.
- Paid amount equals the sum of saved payments.
- Balance equals order total minus paid amount.
- Payment status matches the current balance.
- Delivery planned quantities do not exceed order item quantities.
- Delivered quantities do not exceed planned delivery quantities.
- Remaining undelivered quantity matches ordered quantity minus delivered quantity.
- Sales history values match saved order, payment, and delivery summaries.
- Customer sales history includes only records the user may view.
- Generated PDFs match saved record values at generation time.

Validation method:

- Prepare an expected-values worksheet for each pilot scenario.
- Compare expected values to detail pages, reports, and PDFs.
- Record mismatches with source record ID, expected value, actual value, user role, and reproduction steps.
- Fix calculation or permission defects before pilot approval.

## Defect Triage Rules

### Blocker

A defect that prevents realistic pilot use or risks incorrect customer-facing records.

Examples:

- Cannot complete inquiry to order workflow.
- Incorrect quotation, order, payment, balance, or delivery totals.
- PDF exposes internal notes or restricted financial data.
- Staff can access protected payment or document data without permission.
- Accepted quotation conversion loses or changes important sales data.

Required action:

- Fix before controlled client use.

### Required Fix

A defect that disrupts Staff workflow but has a clear workaround during internal testing.

Examples:

- Search or filters fail for common pilot records.
- A status display is confusing but saved records are accurate.
- A PDF layout issue makes review harder but does not change business data.

Required action:

- Fix before pilot approval unless Admin explicitly accepts the workaround.

### Acceptable Limitation

A known MVP limitation that matches the documented scope.

Examples:

- No payment gateway verification.
- No Messenger or Viber integration.
- No customer portal.
- No full inventory reservation.
- No accounting-compliant official receipt numbering.

Required action:

- Document clearly; do not expand scope during stabilization.

### Post-Pilot Follow-Up

An improvement that may be useful later but is not required for controlled pilot use.

Examples:

- Advanced report visuals.
- Automated reminders.
- More polished PDF branding.
- Additional export formats.

Required action:

- Add to future backlog only after the MVP pilot readiness decision.

## Pilot Readiness Checklist

### Workflow Readiness

- Admin can complete the full end-to-end sales workflow.
- Staff can complete the permitted sales workflow.
- Inquiry records can become customer-linked quotations.
- Accepted quotations can become orders.
- Orders support downpayment, partial payment, delivery scheduling, partial delivery, delivery receipt, final payment, and sales history review.

### Data Readiness

- Test records use realistic Furniture Odyssey scenarios.
- Quotation, order, payment, balance, delivery, and report calculations are accurate.
- Customer, item, price, discount, image, contact, address, and note snapshots are preserved.
- Sales history and customer history reflect saved records correctly.
- No critical duplicate records are created during normal workflow.

### Permission Readiness

- Admin permissions are verified.
- Staff permissions are verified.
- Restricted payment visibility is verified.
- Restricted document access is verified.
- Restricted delivery visibility is verified when applicable.
- Sensitive financial, cost, profit, margin, and internal notes are protected.

### PDF Readiness

- Quotation PDF downloads successfully and matches saved quotation data.
- Invoice PDF downloads successfully when tested and matches saved order data.
- Payment receipt PDF downloads successfully and matches saved payment data.
- Delivery receipt PDF downloads successfully and matches saved delivery data.
- Final order summary PDF downloads successfully when tested and matches saved order progress.
- Customer-facing PDFs do not expose internal notes or restricted data.

### Operational Readiness

- Admin and Staff know which workflows are supported in the MVP.
- Known acceptable limitations are documented.
- Blockers are closed.
- Required fixes are closed or explicitly accepted by Admin with a workaround.
- Pilot test records and results are saved for review.
- A go/no-go decision is recorded before controlled client use.

## Acceptance Criteria

- The MVP completes at least one realistic Furniture Odyssey sale from inquiry to final payment and sales history review.
- The MVP completes at least one partial payment scenario.
- The MVP completes at least one partial delivery scenario.
- Quotation and delivery receipt PDFs are generated from saved records and match source data.
- Payment and balance calculations are correct across downpayment, partial payment, and final payment.
- Role and permission tests pass for Admin and Staff.
- Sales history reflects the tested workflow accurately.
- No blocker defects remain open.
- Any required fixes have been completed or formally accepted as pilot workarounds.
- Out-of-scope requests are deferred instead of added to the stabilization phase.

## Implementation Sequence

1. Review current implemented workflows against this stabilization plan.
2. Prepare pilot test users and permissions.
3. Prepare pilot scenario records and expected-value worksheets.
4. Run inquiry to customer tests.
5. Run customer to quotation tests.
6. Run quotation PDF tests.
7. Run accepted quotation to order tests.
8. Run downpayment, partial payment, balance, and final payment tests.
9. Run delivery scheduling, partial delivery, and delivery receipt tests.
10. Run sales history and customer history tests.
11. Run Admin and Staff role and permission tests.
12. Record defects and classify them as blocker, required fix, acceptable limitation, or post-pilot follow-up.
13. Fix blockers and required fixes within MVP scope.
14. Re-run failed scenarios.
15. Complete the pilot readiness checklist.
16. Record the go/no-go decision for controlled client use.

## Future Extensions

These items must remain outside the stabilization phase unless Furniture Odyssey starts a separate post-pilot phase:

- Public ecommerce storefront.
- Customer portal.
- Chatbot automation.
- Facebook, Messenger, Viber, payment gateway, delivery provider, or accounting integrations.
- Full inventory availability, stock reservation, stock deduction, and warehouse workflows.
- Advanced analytics, dashboards, charts, exports, commissions, cost, margin, or profit reporting.
- Accounting-compliant official invoices, receipts, tax handling, VAT, BIR, and legal numbering.
- POS hardware, barcode scanner, receipt printer, cash drawer, and cashier session workflows.
