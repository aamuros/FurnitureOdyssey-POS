# MVP Pilot Testing Execution Checklist

Use this checklist to run the Furniture Odyssey MVP stabilization pilot before controlled client use.

This checklist validates existing MVP behavior only. Do not add ecommerce, chatbot automation, full inventory, customer portal, messaging integration, or advanced reporting scope while running it.

## Pilot Run Information

- Pilot date:
- Tester:
- Role tested:
- Environment:
- Build or commit:
- Admin reviewer:
- Go/no-go decision:

## Test Users

| User | Role | Permission profile | Result | Notes |
| --- | --- | --- | --- | --- |
|  | Admin | Full MVP permissions | Not tested |  |
|  | Staff | Standard sales workflow permissions | Not tested |  |
|  | Staff | Restricted payment visibility | Not tested |  |
|  | Staff | Restricted document export | Not tested |  |
|  | Staff | Restricted delivery visibility | Not tested |  |

## Pilot Scenario Records

| Scenario | Record IDs | Expected result | Actual result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Individual customer from Facebook or Messenger inquiry |  | Customer and inquiry linked |  | Not tested |  |
| Company customer from Viber inquiry |  | Company and contact person captured |  | Not tested |  |
| Quotation with catalog reference items |  | Manual prices and snapshots preserved |  | Not tested |  |
| Quotation with custom/manual items |  | Custom items work without product records |  | Not tested |  |
| Accepted quotation converted to order |  | One order created, duplicate blocked |  | Not tested |  |
| Order with downpayment and partial payment |  | Balance updates correctly |  | Not tested |  |
| Order with partial delivery |  | Remaining delivery quantity updates correctly |  | Not tested |  |
| Final payment |  | Balance becomes zero |  | Not tested |  |

## End-to-End Workflow

| Step | Expected result | Status | Notes |
| --- | --- | --- | --- |
| Create inquiry from manual channel | Inquiry saved with source, requested items, and assigned staff | Not tested |  |
| Create or link customer record | Customer is connected to inquiry without unnecessary duplicate | Not tested |  |
| Add contact and delivery context | Contact/address details are available later in quotation/order flow | Not tested |  |
| Create quotation | Quotation belongs to customer and optionally inquiry | Not tested |  |
| Add catalog reference item | Product data is copied into editable quotation item snapshot | Not tested |  |
| Add custom/manual item | Item saves without product or inventory dependency | Not tested |  |
| Override price and discounts | Totals calculate from saved negotiated values | Not tested |  |
| Generate quotation PDF | PDF downloads and matches saved quotation data | Not tested |  |
| Mark quotation accepted | Quotation can be converted to order | Not tested |  |
| Convert to order | Order snapshots quotation data and prevents duplicate conversion | Not tested |  |
| Record downpayment | Paid amount and balance update correctly | Not tested |  |
| Record partial payment | Paid amount and balance update again correctly | Not tested |  |
| Schedule delivery | Delivery saves date, recipient, address, and assigned items | Not tested |  |
| Record partial delivery | Delivered and remaining quantities update correctly | Not tested |  |
| Generate delivery receipt | PDF includes only the delivery items and quantities | Not tested |  |
| Record final payment | Balance becomes zero and payment status becomes paid | Not tested |  |
| Review sales history | Order, payment, balance, delivery, and customer history are accurate | Not tested |  |

## Data Accuracy Worksheet

| Check | Expected value | Actual value | Status | Notes |
| --- | --- | --- | --- | --- |
| Quotation line subtotal = quantity x unit price |  |  | Not tested |  |
| Quotation item discount amount |  |  | Not tested |  |
| Quotation-level discount amount |  |  | Not tested |  |
| Quotation total |  |  | Not tested |  |
| Order total after conversion |  |  | Not tested |  |
| Downpayment amount |  |  | Not tested |  |
| Paid amount after downpayment |  |  | Not tested |  |
| Balance after downpayment |  |  | Not tested |  |
| Partial payment amount |  |  | Not tested |  |
| Paid amount after partial payment |  |  | Not tested |  |
| Balance after partial payment |  |  | Not tested |  |
| Final payment amount |  |  | Not tested |  |
| Final paid amount |  |  | Not tested |  |
| Final balance | 0 |  | Not tested |  |
| Ordered quantity |  |  | Not tested |  |
| First delivery planned quantity |  |  | Not tested |  |
| First delivery delivered quantity |  |  | Not tested |  |
| Remaining undelivered quantity |  |  | Not tested |  |

## PDF Checklist

| PDF | Required checks | Status | Notes |
| --- | --- | --- | --- |
| Quotation PDF | Customer, items, quantities, prices, discounts, totals, customer notes | Not tested |  |
| Invoice PDF | Order snapshot, items, totals, permitted balance data | Not tested |  |
| Payment receipt PDF | Payment amount, paid after payment, balance after payment | Not tested |  |
| Delivery receipt PDF | Delivery address, recipient, items, included and delivered quantities | Not tested |  |
| Final order summary PDF | Order, payments, deliveries, final balance when permitted | Not tested |  |

For every PDF:

- Generated from saved records only.
- Downloads successfully.
- Matches the source detail page.
- Excludes internal notes.
- Excludes cost, margin, profit, and unauthorized financial summaries.
- Enforces document and source-module permissions.
- Does not store PDF binaries in PostgreSQL.

## Role and Permission Checklist

| Area | Admin full access | Staff standard access | Staff restricted access | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Navigation visibility |  |  |  | Not tested |  |
| Customer and inquiry access |  |  |  | Not tested |  |
| Quotation create/view/update |  |  |  | Not tested |  |
| Quotation PDF download |  |  |  | Not tested |  |
| Quotation to order conversion |  |  |  | Not tested |  |
| Order view/update |  |  |  | Not tested |  |
| Payment view |  |  |  | Not tested |  |
| Payment recording |  |  |  | Not tested |  |
| Delivery view/update |  |  |  | Not tested |  |
| Delivery receipt download |  |  |  | Not tested |  |
| Sales history access |  |  |  | Not tested |  |
| Financial columns and summaries |  |  |  | Not tested |  |

## Defect Log

| ID | Severity | Area | Record ID or route | Expected | Actual | Reproduction steps | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | Blocker / Required fix / Acceptable limitation / Post-pilot follow-up |  |  |  |  |  |  | Open |

Severity rules:

- Blocker: prevents pilot use or risks incorrect customer-facing records.
- Required fix: disrupts Staff workflow but has a possible internal workaround.
- Acceptable limitation: matches documented MVP scope.
- Post-pilot follow-up: useful later but not required for controlled pilot use.

## Pilot Readiness Decision

| Readiness area | Required result | Status | Notes |
| --- | --- | --- | --- |
| End-to-end workflow | At least one full sale reaches final payment and sales history review | Not ready |  |
| Partial payment | At least one order has downpayment and partial payment validated | Not ready |  |
| Partial delivery | At least one order has partial delivery validated | Not ready |  |
| PDFs | Quotation and delivery receipt PDFs pass source-data checks | Not ready |  |
| Data accuracy | No unresolved calculation mismatch | Not ready |  |
| Permissions | Admin and Staff role tests pass | Not ready |  |
| Blockers | No open blockers | Not ready |  |
| Required fixes | Closed or accepted by Admin with workaround | Not ready |  |
| Scope control | Out-of-scope requests deferred | Not ready |  |

Final decision:

- Go:
- No-go:
- Approved by:
- Date:
