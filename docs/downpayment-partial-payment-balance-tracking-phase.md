# Downpayment, Partial Payment, and Balance Tracking Phase

## Phase Goal

Create the internal payment-recording workflow that lets Admin and Staff manually record order payments, track remaining balances, view payment history, and prepare payment receipt data.

This phase supports Furniture Odyssey's real-world negotiated sales process where customers may give a downpayment, make one or more partial payments, pay the remaining balance before or during delivery, and need receipt data prepared from saved order and payment records.

This phase must not introduce payment gateways, online checkout, automated payment verification, payment approval workflows, refund handling, voiding rules, overpayment handling, or final payment method policy decisions.

## Primary Users

- Admin
- Staff

## Core Principles

- Payments are manually recorded by permitted Admin or Staff users.
- One order can have multiple payment records.
- Payments can represent downpayments, partial payments, final payments, or payment due upon delivery.
- Payment tracking belongs to the order operational record.
- Payment history must be visible from both the order detail page and the customer detail page.
- Remaining balance is calculated from the saved order total and saved payment records.
- Server-side calculation is authoritative for paid amount, remaining balance, and payment status.
- Receipt PDF data must come from saved order, customer, payment, and staff records.
- Receipt data preparation is in scope, but final React-PDF visual layout is not.
- Sensitive payment and financial data must be permission-controlled.
- This phase does not decide final payment methods, approval workflows, payment verification rules, voiding rules, refund rules, or overpayment behavior.

## In Scope

- Manual payment recording against an existing order.
- Multiple payments per order.
- Downpayment records.
- Partial payment records.
- Final payment records.
- Payment due upon delivery tracking.
- Remaining balance calculation.
- Paid amount calculation.
- Payment status updates on the order.
- Payment history per order.
- Payment history per customer.
- Receipt PDF data requirements.
- Payment receipt document relationship planning.
- Permission checks for viewing and recording payments.
- Activity/history entries for recorded payments.

## Out of Scope

- Payment gateway integration.
- Online checkout or customer self-payment.
- Automated bank, GCash, card, or wallet verification.
- Final list of allowed payment methods.
- Payment approval workflows.
- Voiding payments.
- Refunds or chargebacks.
- Overpayment rules or credit balance handling.
- Payment reversals or corrections beyond creating a new manually reviewed record in a later phase.
- Official receipt compliance, BIR/tax rules, VAT, withholding tax, or accounting treatment.
- Receipt numbering format or legal invoice numbering unless defined in a later accounting phase.
- Final PDF visual design.
- Public customer portal receipt access.

## Data Model Plan

### Payment

Represents one manually recorded payment against an order.

Recommended fields:

- `id`
- `orderId`
- `customerId`
- `paymentNumber` nullable until numbering rules are defined
- `paymentType` enum: `DOWNPAYMENT`, `PARTIAL_PAYMENT`, `FINAL_PAYMENT`, `DELIVERY_BALANCE_PAYMENT`
- `paymentDate`
- `amount`
- `method` nullable text or enum until final payment methods are defined
- `referenceNumber` nullable
- `payerName` nullable
- `receivedById` nullable relation to `UserProfile`
- `customerNotes` nullable long text
- `internalNotes` nullable long text
- `receiptStatus` enum: `NOT_GENERATED`, `GENERATED`
- `createdById` nullable relation to `UserProfile`
- `updatedById` nullable relation to `UserProfile`
- `createdAt`
- `updatedAt`

Indexes:

- `orderId`
- `customerId`
- `paymentType`
- `paymentDate`
- `receivedById`
- `createdById`
- `createdAt`

Rules:

- A payment must belong to one order.
- `customerId` should copy from the order customer for direct customer payment history queries.
- Payment amount must be greater than zero.
- Payment amount is manually entered by Staff.
- `method` remains nullable or flexible until Furniture Odyssey defines final accepted payment methods.
- `paymentType` identifies whether the record is a downpayment, partial payment, final payment, or delivery balance payment.
- `FINAL_PAYMENT` means the payment is intended to settle the remaining balance at the time of recording.
- `DELIVERY_BALANCE_PAYMENT` means the payment is intended to settle or reduce the balance during delivery.
- Receipt generation should link to the payment record and update `receiptStatus`.
- This phase does not add void, refund, reversal, approval, verification, or overpayment statuses.

### Order Payment Summary Fields

The order should expose payment summary fields for fast list and detail views.

Recommended fields on `Order`:

- `paymentStatus` enum: `UNPAID`, `DOWNPAYMENT_PAID`, `PARTIALLY_PAID`, `BALANCE_DUE_ON_DELIVERY`, `PAID`
- `paymentDueTiming` nullable enum: `BEFORE_DELIVERY`, `UPON_DELIVERY`, `AFTER_DELIVERY`
- `paymentDueDate` nullable
- `paidAmount`
- `balanceAmount`
- `lastPaymentAt` nullable

Indexes:

- `paymentStatus`
- `paymentDueTiming`
- `paymentDueDate`
- `lastPaymentAt`

Rules:

- `paidAmount = sum(payment.amount for all saved payments on the order)`.
- `balanceAmount = max(order.totalAmount - paidAmount, 0)`.
- `paymentStatus` is recalculated after every payment record is created.
- If no payment exists, `paymentStatus = UNPAID`.
- If at least one `DOWNPAYMENT` exists and balance remains, `paymentStatus = DOWNPAYMENT_PAID`.
- If one or more payments exist and balance remains, `paymentStatus = PARTIALLY_PAID` unless the order is explicitly marked as balance due upon delivery.
- If balance remains and Staff marks the balance as due upon delivery, `paymentStatus = BALANCE_DUE_ON_DELIVERY`.
- If balance is zero, `paymentStatus = PAID`.
- `paymentDueTiming` is an operational reminder only; it does not enforce delivery or payment rules in this phase.
- `paymentDueDate` may be used when Staff knows a promised payment date.
- Order payment summaries should be recalculated server-side, not trusted from the client.

### OrderDocument Payment Receipt Link

Payment receipt PDFs should be stored as order documents when generated.

Recommended fields already planned for `OrderDocument`:

- `id`
- `orderId`
- `paymentId` nullable
- `documentType` enum includes `PAYMENT_RECEIPT`
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

- A payment receipt document belongs to the order and should link to the specific payment.
- Store generated receipt PDF/media metadata only.
- Do not store PDF binaries in PostgreSQL.
- Receipt documents should read saved payment and order data, not live editable form state.
- This phase defines required receipt data, not final receipt layout.

## Payment Type Rules

### Downpayment

- Used when the customer pays an initial amount to proceed with an order.
- The order may still have a remaining balance after a downpayment.
- Downpayment records appear first in payment history by date and creation time.
- A downpayment does not require inventory reservation, delivery scheduling, or payment gateway confirmation.

### Partial Payment

- Used for any payment that reduces the balance but does not settle the order.
- Multiple partial payments are allowed.
- Partial payments update paid amount, remaining balance, and payment history.
- Partial payment recording should show the current remaining balance before Staff saves the new payment.

### Final Payment

- Used when Staff records a payment intended to settle the remaining balance.
- The UI should make it easy to fill the payment amount with the current remaining balance.
- After saving, if the calculated balance is zero, the order payment status becomes `PAID`.
- This phase does not define what happens if the entered amount is greater than the remaining balance.

### Payment Due Upon Delivery

- Used when an order still has a balance and Staff expects the customer to pay during delivery.
- This should be represented as order-level payment due timing/status, not as a payment record before money is received.
- The delivery view should show the current balance due when payment is due upon delivery.
- When Staff receives the amount during delivery, they record an actual payment, usually as `DELIVERY_BALANCE_PAYMENT` or `FINAL_PAYMENT`.
- This phase does not block delivery scheduling when a balance exists.

## Staff Payment Workflow

### Record Payment From Order

1. Staff opens an order detail page.
2. Staff opens the Payments tab.
3. The system shows order total, paid amount, remaining balance, payment status, and payment due timing.
4. Staff chooses "Add payment."
5. Staff selects payment type: downpayment, partial payment, final payment, or delivery balance payment.
6. Staff enters payment date, amount, optional method, optional reference number, optional payer name, and notes.
7. The system shows the projected paid amount and projected remaining balance before save.
8. Staff saves the payment.
9. The system creates the payment record and recalculates order `paidAmount`, `balanceAmount`, `paymentStatus`, and `lastPaymentAt` in one server-side operation.
10. The payment appears in the order payment history.
11. Staff may generate or prepare receipt data for the payment when document generation is available.

### Mark Balance Due Upon Delivery

1. Staff opens an order with a remaining balance.
2. Staff sets payment due timing to "upon delivery" and optionally adds a due date or note.
3. The system updates the order payment summary to show balance due upon delivery.
4. Delivery staff can see the balance due on the order or delivery detail page.
5. When money is received, Staff records a payment against the order.

### View Customer Payment History

1. Staff opens a customer detail page.
2. Staff opens the payment history section.
3. The system lists payments across that customer's orders.
4. Staff can filter by date range, order, payment type, and payment status when supported.
5. Staff opens a payment row to navigate back to the related order and receipt document when available.

## UI Plan

### Order Payments Tab

- Payment summary with order total, paid amount, remaining balance, payment status, and payment due timing.
- Action to add a payment for permitted users.
- Action to mark or edit payment due timing for permitted users.
- Payment history table with date, payment type, amount, method, reference number, payer name, received by, receipt status, and created date.
- Row link to receipt document when generated.
- Empty state when no payments have been recorded.
- Hide or restrict the tab for users without payment visibility permission.

### Add Payment Form

- Payment type selector.
- Payment date field defaulting to the current date.
- Amount field.
- "Use remaining balance" helper for final payment and delivery balance payment.
- Optional method field.
- Optional reference number field.
- Optional payer name field.
- Customer-facing receipt note field.
- Internal notes field.
- Read-only preview of current balance and projected balance after payment.
- Save action gated by payment create permission.

### Customer Payment History

- Table of all payments for the customer across orders.
- Columns: payment date, order number or fallback order ID, payment type, amount, method, reference number, received by, receipt status, and order balance after payment when available.
- Filters for date range, order, payment type, and receipt status.
- Row action to open the related order.
- Receipt link when a receipt document exists.

### Delivery Context Payment Display

- Show payment status and remaining balance on delivery-related order views.
- If `paymentDueTiming = UPON_DELIVERY`, show the balance due prominently to permitted users.
- Provide a shortcut to record delivery balance payment when the user has payment create permission.
- Do not require payment completion before delivery scheduling in this phase.

## Calculation Rules

- `paidAmount = sum(payment.amount for all payments saved against the order)`.
- `balanceAmount = max(order.totalAmount - paidAmount, 0)`.
- `projectedPaidAmount = currentPaidAmount + newPaymentAmount`.
- `projectedBalanceAmount = max(order.totalAmount - projectedPaidAmount, 0)`.
- `lastPaymentAt = max(payment.paymentDate or payment.createdAt for payments on the order)`.
- If `balanceAmount = order.totalAmount`, the order is unpaid.
- If `balanceAmount > 0` and at least one payment exists, the order is partially paid or downpayment paid.
- If `balanceAmount = 0`, the order is paid.
- Use decimal-safe money handling on the server.
- Client-side calculations are for preview only.

## Validation Rules

- Payment recording requires an existing order.
- Payment recording requires `PAYMENTS:CREATE`.
- Payment history visibility requires `PAYMENTS:VIEW`.
- Payment amount is required.
- Payment amount must be greater than zero.
- Payment date is required.
- Payment type is required.
- Payment method is optional until final payment method rules are defined.
- Reference number is optional.
- Payer name is optional.
- Customer-facing receipt notes and internal notes are optional.
- Payment due timing can be set only when an order has a remaining balance.
- Receipt data generation requires a saved payment record.
- Receipt PDF metadata must include at least order ID, payment ID, document type, generated timestamp, and generated by user when a PDF is generated.
- This phase should not add validation for payment verification, approval, voiding, refunding, or overpayment handling.

## Receipt PDF Data Requirements

Payment receipt generation should have access to the following saved data.

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
- Billing or delivery address snapshot when relevant to the receipt.

### Order Data

- Order ID.
- Order number when numbering rules exist.
- Order date or confirmed date.
- Order total amount.
- Paid amount before this payment when available.
- Payment amount.
- Paid amount after this payment.
- Remaining balance after this payment.
- Currency.
- Customer-facing order notes when relevant.

### Payment Data

- Payment ID.
- Payment number when numbering rules exist.
- Payment type.
- Payment date.
- Payment amount.
- Payment method when entered.
- Reference number when entered.
- Payer name when entered.
- Received by user display name when available.
- Customer-facing receipt note.

### Receipt Document Data

- Document ID.
- Document type: `PAYMENT_RECEIPT`.
- Generated date and time.
- Generated by user display name.
- Linked order ID.
- Linked payment ID.
- Cloudinary public ID and secure URL after generation.

Rules:

- Receipt PDFs should show saved payment data, not values retyped during document generation.
- Receipt PDFs should show the balance after the payment so Staff and customer can understand what remains due.
- Receipt PDFs should not include cost, margin, profit, or internal notes.
- Final receipt numbering and legal tax wording are deferred until a later accounting/document phase.

## Permissions Plan

Use the existing role and permission model.

Recommended permissions:

- Admin can view and record payments for all orders.
- Staff can view and record payments for orders they can access when they have payment permissions.
- Payment list/detail visibility requires `PAYMENTS:VIEW`.
- Payment creation requires `PAYMENTS:CREATE`.
- Editing payment due timing requires `ORDERS:UPDATE` or a dedicated payment management permission.
- Receipt data preparation or generation requires `DOCUMENTS:CREATE` or `DOCUMENTS:EXPORT`.
- Customer payment history visibility requires `PAYMENTS:VIEW` plus customer access.
- Sensitive financial summaries beyond order total, paid amount, and balance require explicit financial visibility permission.

Implementation notes:

- Gate the Payments tab under `PAYMENTS:VIEW`.
- Gate Add Payment under `PAYMENTS:CREATE`.
- Gate customer payment history under `PAYMENTS:VIEW`.
- Do not expose payment data to users without payment visibility permission.
- Do not show cost, margin, profit, or internal financial summaries in receipt data.

## Relationship Plan

- A customer has many orders.
- An order has many payments.
- A customer has many payments through orders and through the copied `customerId`.
- A payment belongs to one order.
- A payment belongs to one customer for query convenience and history.
- A payment may have zero or more related receipt documents.
- A receipt document belongs to one order.
- A receipt document may link to one payment.
- Payment history views should primarily read from payment records joined to orders and customers.

## Reporting Impact

- Order balance reports should use saved order total minus saved payment records.
- Customer balance views should summarize unpaid or partially paid orders.
- Customer payment history should show all recorded payments across orders.
- Sales tracking can distinguish unpaid, downpayment paid, partially paid, balance due upon delivery, and paid orders.
- Payment reports can group by payment date, payment type, received by, customer, and order.
- Payment method reporting should remain flexible until final method rules are defined.
- Cost, profit, margin, commission, tax, and accounting reports are outside this phase unless separately defined.

## Acceptance Criteria

- Staff can manually record a payment against an order.
- Staff can record more than one payment against the same order.
- Staff can classify a payment as downpayment, partial payment, final payment, or delivery balance payment.
- The order payment summary shows total amount, paid amount, remaining balance, and payment status.
- The system recalculates paid amount and remaining balance after each saved payment.
- Staff can mark an order balance as due upon delivery without creating a payment record.
- Order payment history lists all payments for the order.
- Customer payment history lists payments across that customer's orders.
- Receipt PDF data can be prepared from saved company, customer, order, payment, and document records.
- Receipt data includes payment amount and balance after payment.
- Payment views and actions are permission-controlled.
- No payment gateway, online checkout, approval workflow, refund workflow, voiding workflow, overpayment rule, or payment verification rule is introduced.

## Implementation Sequence

1. Add or refine Prisma enums for payment type, payment status, payment due timing, and receipt status.
2. Add or refine the `Payment` model with order, customer, amount, date, type, optional method, optional reference, notes, and receipt status fields.
3. Add order payment summary fields for paid amount, balance amount, payment status, payment due timing, due date, and last payment date.
4. Add `PAYMENT_RECEIPT` to the order document type enum if not already present.
5. Add Zod schemas for payment creation and payment due timing updates.
6. Add decimal-safe server helpers for paid amount, projected balance, payment status, and due-on-delivery status.
7. Add a transactional server action to create a payment and recalculate the order payment summary.
8. Add a server action to update payment due timing on an order.
9. Add queries for order payment history and customer payment history.
10. Add permission checks for payment tab visibility, payment creation, and customer payment history.
11. Build the order Payments tab summary, history table, and Add Payment form.
12. Add balance due display to delivery-related order views.
13. Define receipt PDF data fetchers that return saved company, customer, order, payment, and document data.
14. Add activity log entries for payment recording and payment due timing changes.
15. Add tests for multiple payments, downpayment status, partial payment status, final payment balance calculation, due upon delivery marking, customer payment history, permissions, and receipt data completeness.

## Future Extensions

- Final payment method enum after Furniture Odyssey confirms accepted methods.
- Receipt numbering rules.
- React-PDF receipt layout.
- Payment correction, voiding, refund, and reversal workflows.
- Overpayment and customer credit handling.
- Payment verification workflow for bank transfer, wallet, check, or card references.
- Accounting, tax, VAT, BIR, official receipt, and invoice compliance rules.
- Payment reminders and overdue balance follow-up.
