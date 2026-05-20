"use client";

import { useActionState, useMemo, useState } from "react";
import type { DeliveryStatus } from "@prisma/client";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Download,
  FileText,
  ListChecks,
  PackageSearch,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  Truck
} from "lucide-react";
import {
  convertQuotationToOrderAction,
  createDeliveryAction,
  createManualOrderAction,
  createPaymentAction,
  updateDeliveryProgressAction,
  updatePaymentDueTimingAction
} from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import {
  deliveryStatusLabel,
  orderStatusLabel,
  paymentStatusLabel,
  paymentTypeLabel,
  readableLabel,
  statusTone
} from "@/lib/orders/status-labels";
import { getAllowedNextStatuses } from "@/lib/status-transitions";
import { cn } from "@/lib/utils";

type CustomerOption = {
  id: string;
  displayName: string;
  companyName: string | null;
};

type ProductOption = {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  description: string | null;
  specifications: string | null;
  referencePrice: number | null;
  referenceCost: number | null;
};

type ApprovedQuotationOption = {
  id: string;
  customerName: string;
  totalAmount: string;
  itemCount: number;
};

type OrderItemRow = {
  id: string;
  itemName: string;
  quantity: number;
  plannedQuantity: number;
  remainingQuantity: number;
  unitPrice: string;
  unitCostSnapshot: string;
  lineCostTotal: string;
  lineProfit: string;
  lineTotal: string;
  deliveredQuantity: number;
  discountAmount: string;
  customerNotes: string | null;
  internalNotes: string | null;
};

type OrderRow = {
  id: string;
  displayId: string;
  customerName: string;
  companyName: string | null;
  contactPersonName: string | null;
  contactSnapshot: string | null;
  deliveryAddressSnapshot: string | null;
  assignedStaff: string | null;
  sourceType: string;
  status: string;
  paymentStatus: string;
  paymentDueTiming: string | null;
  paymentDueDate: string;
  deliveryStatus: string;
  needsAssembly: boolean;
  salesInvoiceRequested: boolean;
  modeOfDelivery: string | null;
  deliveryMethod: string | null;
  paymentTerms: string | null;
  specialInstructions: string | null;
  totalAmount: string;
  totalAmountValue: number;
  paidAmount: string;
  paidAmountValue: number;
  balanceAmount: string;
  balanceAmountValue: number;
  subtotalAmount: string;
  itemDiscountTotal: string;
  orderDiscountAmount: string;
  totalCostAmount: string;
  grossProfitAmount: string;
  customerNotes: string | null;
  internalNotes: string | null;
  relatedQuotationId: string | null;
  relatedQuotationNumber: string | null;
  relatedQuotationStatus: string | null;
  relatedInquiryId: string | null;
  relatedInquiryLabel: string | null;
  createdAt: string;
  updatedAt: string;
  lastPaymentDate: string | null;
  nextDeliveryDate: string | null;
  nextDeliveryProvider: string | null;
  items: OrderItemRow[];
  payments: Array<{
    id: string;
    paymentNumber: string | null;
    paymentDate: string;
    amount: string;
    paymentType: string;
    method: string | null;
    status: string;
    referenceNumber: string | null;
    payerName: string | null;
    receiptGenerated: boolean;
  }>;
  deliveries: Array<{
    id: string;
    deliveryNumber: string | null;
    status: string;
    scheduledDate: string | null;
    scheduledDateLabel: string | null;
    scheduledTimeWindow: string | null;
    deliveryProviderType: string | null;
    deliveryProviderName: string | null;
    deliveryProviderReference: string | null;
    recipientName: string | null;
    recipientPhone: string | null;
    addressLine: string | null;
    receiptGenerated: boolean;
    itemCount: number;
    assignedStaff: string | null;
    items: Array<{
      id: string;
      itemName: string;
      quantityPlanned: number;
      quantityDelivered: number;
    }>;
  }>;
  documents: Array<{
    id: string;
    documentType: string;
    title: string;
    status: string;
    paymentId: string | null;
    deliveryId: string | null;
  }>;
};

type OrderWorkspaceProps = {
  canCreateOrders: boolean;
  canUpdateOrders: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  canUpdateDeliveries: boolean;
  canExportDocuments: boolean;
  customers: CustomerOption[];
  products: ProductOption[];
  approvedQuotations: ApprovedQuotationOption[];
  orders: OrderRow[];
};

type ItemDraft = {
  productId?: string;
  itemType: "CATALOG_PRODUCT" | "CUSTOM_ITEM";
  sortOrder: number;
  snapshotProductCode?: string;
  itemName: string;
  description: string;
  specifications: string;
  quantity: number;
  unitPrice: number;
  unitCostSnapshot: number;
  discountType: "" | "FIXED_AMOUNT" | "PERCENTAGE";
  discountValue: number;
  customerNotes: string;
  internalNotes: string;
};

type ActiveOrderAction = "payment" | "paymentDue" | "delivery" | `deliveryProgress:${string}` | null;
type NewOrderMode = "choices" | "quotation" | "manual";
type ManualOrderStep = "customer" | "items" | "terms" | "review";
type OrderDetailTab = "overview" | "items" | "payments" | "deliveries" | "documents" | "notes";

type NewOrderLauncherProps = Pick<
  OrderWorkspaceProps,
  "canCreateOrders" | "canViewPayments" | "customers" | "products" | "approvedQuotations"
>;

type OrderListProps = Pick<
  OrderWorkspaceProps,
  | "canUpdateOrders"
  | "canViewPayments"
  | "canCreatePayments"
  | "canViewDeliveries"
  | "canCreateDeliveries"
  | "canUpdateDeliveries"
  | "canExportDocuments"
  | "orders"
>;

const initialState = {
  ok: false,
  message: ""
};

const pdfLinkClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-panel px-2 text-sm font-medium text-foreground transition hover:bg-muted";

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(value);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function itemSubtotal(item: ItemDraft) {
  return roundMoney(item.quantity * item.unitPrice);
}

function itemDiscountAmount(item: ItemDraft) {
  if (!item.discountType || item.discountValue <= 0) {
    return 0;
  }

  if (item.discountType === "PERCENTAGE") {
    return roundMoney(itemSubtotal(item) * (item.discountValue / 100));
  }

  return roundMoney(item.discountValue);
}

function itemLineTotal(item: ItemDraft) {
  return roundMoney(Math.max(itemSubtotal(item) - itemDiscountAmount(item), 0));
}

function itemCostTotal(item: ItemDraft) {
  return roundMoney(item.quantity * item.unitCostSnapshot);
}

function createCustomItem(sortOrder: number): ItemDraft {
  return {
    itemType: "CUSTOM_ITEM",
    sortOrder,
    itemName: "",
    description: "",
    specifications: "",
    quantity: 1,
    unitPrice: 0,
    unitCostSnapshot: 0,
    discountType: "",
    discountValue: 0,
    customerNotes: "",
    internalNotes: ""
  };
}

function toActionItems(items: ItemDraft[]) {
  return items.map((item, index) => ({
    productId: item.productId,
    itemType: item.itemType,
    sortOrder: index,
    itemName: item.itemName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    unitCostSnapshot: item.unitCostSnapshot,
    discountType: item.discountType || undefined,
    discountValue: item.discountType ? item.discountValue : undefined,
    description: item.description || undefined,
    specifications: item.specifications || undefined,
    customerNotes: item.customerNotes || undefined,
    internalNotes: item.internalNotes || undefined,
    snapshotProductCode: item.snapshotProductCode || undefined,
    images: []
  }));
}

function providerLabel(type: string | null, name: string | null) {
  if (name) {
    return name;
  }

  if (!type) {
    return "No provider";
  }

  return readableLabel(type);
}

function PaymentForm({ order }: { order: OrderRow }) {
  const [state, action, pending] = useActionState(createPaymentAction, initialState);
  const [amount, setAmount] = useState("");
  const projectedPaid = roundMoney(order.paidAmountValue + Number(amount || 0));
  const projectedBalance = roundMoney(Math.max(order.totalAmountValue - projectedPaid, 0));

  return (
    <form action={action} className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-6">
      <input type="hidden" name="orderId" value={order.id} />
      <Select name="paymentType" required defaultValue="PARTIAL_PAYMENT" aria-label="Payment type">
        <option value="DOWNPAYMENT">Downpayment</option>
        <option value="PARTIAL_PAYMENT">Partial payment</option>
        <option value="FINAL_PAYMENT">Final payment</option>
        <option value="DELIVERY_BALANCE_PAYMENT">Delivery balance</option>
      </Select>
      <Input name="paymentDate" type="date" required aria-label="Payment date" />
      <Input
        name="amount"
        type="number"
        min="0.01"
        step="0.01"
        required
        placeholder="Amount"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <Button type="button" variant="secondary" onClick={() => setAmount(String(order.balanceAmountValue))}>
        Balance
      </Button>
      <Select name="method" defaultValue="" aria-label="Payment method">
        <option value="">Method optional</option>
        <option value="CASH">Cash</option>
        <option value="BANK_TRANSFER">Bank transfer</option>
        <option value="GCASH">GCash</option>
        <option value="CHECK">Check</option>
        <option value="CARD">Card</option>
        <option value="OTHER">Other</option>
      </Select>
      <Input name="referenceNumber" placeholder="Reference" />
      <Input name="payerName" placeholder="Payer name" className="md:col-span-2" />
      <Textarea name="customerNotes" placeholder="Receipt note" className="md:col-span-2" />
      <Textarea name="internalNotes" placeholder="Internal payment notes" className="md:col-span-2" />
      <div className="rounded-md bg-background px-3 py-2 text-sm md:col-span-4">
        <span className="text-muted-foreground">Projected after payment: </span>
        <span className="font-medium">{money(projectedPaid)} paid</span>
        <span className="text-muted-foreground"> · </span>
        <span className="font-medium">{money(projectedBalance)} balance</span>
      </div>
      <Button disabled={pending} className="md:col-span-2">
        <ReceiptText className="h-4 w-4" />
        Add payment
      </Button>
      {state.message ? (
        <p className={state.ok ? "text-sm text-success md:col-span-6" : "text-sm text-danger md:col-span-6"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function PaymentDueTimingForm({ order }: { order: OrderRow }) {
  const [state, action, pending] = useActionState(updatePaymentDueTimingAction, initialState);

  return (
    <form action={action} className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-4">
      <input type="hidden" name="orderId" value={order.id} />
      <Select
        name="paymentDueTiming"
        defaultValue={order.paymentDueTiming ?? ""}
        aria-label="Payment due timing"
        disabled={order.balanceAmountValue <= 0}
      >
        <option value="">No due timing</option>
        <option value="BEFORE_DELIVERY">Before delivery</option>
        <option value="UPON_DELIVERY">Upon delivery</option>
        <option value="AFTER_DELIVERY">After delivery</option>
      </Select>
      <Input
        name="paymentDueDate"
        type="date"
        defaultValue={order.paymentDueDate}
        disabled={order.balanceAmountValue <= 0}
        aria-label="Payment due date"
      />
      <div className="rounded-md bg-background px-3 py-2 text-sm">
        <span className="text-muted-foreground">Balance due: </span>
        <span className="font-medium">{order.balanceAmount}</span>
      </div>
      <Button disabled={pending || order.balanceAmountValue <= 0}>
        <CalendarClock className="h-4 w-4" />
        Save due timing
      </Button>
      {state.message ? (
        <p className={state.ok ? "text-sm text-success md:col-span-4" : "text-sm text-danger md:col-span-4"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function DeliveryForm({ order }: { order: OrderRow }) {
  const [state, action, pending] = useActionState(createDeliveryAction, initialState);
  const [orderItemId, setOrderItemId] = useState(order.items[0]?.id ?? "");
  const [quantityPlanned, setQuantityPlanned] = useState(1);
  const selectedItem = order.items.find((item) => item.id === orderItemId);
  const remainingQuantity = selectedItem ? selectedItem.remainingQuantity : 0;
  const deliveryItems = orderItemId
    ? [
        {
          orderItemId,
          quantityPlanned,
          quantityDelivered: 0,
          notes: ""
        }
      ]
    : [];

  return (
    <form action={action} className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-5">
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="items" value={JSON.stringify(deliveryItems)} />
      <div className="rounded-md bg-background px-3 py-2 text-sm text-muted-foreground md:col-span-5">
        New deliveries are created as Scheduled. Use delivery progress to move them forward.
      </div>
      <Select name="deliveryProviderType" defaultValue="" aria-label="Delivery provider type">
        <option value="">Provider type</option>
        <option value="IN_HOUSE">In-house</option>
        <option value="CUSTOMER_PICKUP">Customer pickup</option>
        <option value="THIRD_PARTY">Third-party</option>
        <option value="OTHER">Other</option>
      </Select>
      <Input name="deliveryProviderName" placeholder="Provider name" />
      <Input name="deliveryProviderReference" placeholder="Provider reference" />
      <Input name="scheduledDate" type="date" required aria-label="Scheduled date" />
      <Select
        value={orderItemId}
        onChange={(event) => setOrderItemId(event.target.value)}
        aria-label="Delivery item"
      >
        {order.items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.itemName} ({item.remainingQuantity} remaining)
          </option>
        ))}
      </Select>
      <Input
        type="number"
        min="0.01"
        max={remainingQuantity || undefined}
        step="0.01"
        value={quantityPlanned}
        onChange={(event) => setQuantityPlanned(Number(event.target.value))}
        aria-label="Delivery quantity"
      />
      <Input name="scheduledTimeWindow" placeholder="Time window" />
      <Button disabled={pending || !orderItemId || remainingQuantity <= 0}>
        <Truck className="h-4 w-4" />
        Schedule
      </Button>
      <Input name="recipientName" placeholder="Recipient" />
      <Input name="recipientPhone" placeholder="Phone" />
      <Input name="deliveryAddress" placeholder="Delivery address" className="md:col-span-3" />
      <Textarea name="deliveryNotes" placeholder="Delivery notes" className="md:col-span-5" />
      <Textarea name="internalNotes" placeholder="Internal notes" className="md:col-span-5" />
      {state.message ? (
        <p className={state.ok ? "text-sm text-success md:col-span-5" : "text-sm text-danger md:col-span-5"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

type DeliveryRow = OrderRow["deliveries"][number];

function DeliveryProgressForm({ delivery }: { delivery: DeliveryRow }) {
  const [state, action, pending] = useActionState(updateDeliveryProgressAction, initialState);
  const [status, setStatus] = useState(delivery.status);
  const [markAllDelivered, setMarkAllDelivered] = useState(false);
  const [items, setItems] = useState(
    delivery.items.map((item) => ({
      deliveryItemId: item.id,
      quantityDelivered: item.quantityDelivered,
      notes: ""
    }))
  );
  const nextStatuses = [
    delivery.status,
    ...getAllowedNextStatuses("delivery", delivery.status as DeliveryStatus)
  ];
  const submittedItems = markAllDelivered
    ? delivery.items.map((item) => ({
        deliveryItemId: item.id,
        quantityDelivered: item.quantityPlanned,
        notes: items.find((candidate) => candidate.deliveryItemId === item.id)?.notes
      }))
    : items;

  function updateDeliveredQuantity(deliveryItemId: string, quantityDelivered: number) {
    setItems((current) =>
      current.map((item) => (item.deliveryItemId === deliveryItemId ? { ...item, quantityDelivered } : item))
    );
  }

  return (
    <form action={action} className="mt-3 grid gap-2 rounded-md border border-border p-3">
      <input type="hidden" name="deliveryId" value={delivery.id} />
      <input type="hidden" name="items" value={JSON.stringify(submittedItems)} />
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <Select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Delivery progress status"
        >
          {nextStatuses.map((nextStatus) => (
            <option key={nextStatus} value={nextStatus}>
              {deliveryStatusLabel(nextStatus)}
            </option>
          ))}
        </Select>
        <Input name="deliveredAt" type="date" disabled={status !== "DELIVERED"} aria-label="Delivered date" />
      </div>
      <label className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-panel px-3 text-sm">
        <input
          type="checkbox"
          name="markAllDelivered"
          checked={markAllDelivered}
          onChange={(event) => setMarkAllDelivered(event.target.checked)}
          value="true"
        />
        Mark all planned quantities as delivered
      </label>
      <div className="space-y-2">
        {delivery.items.map((item) => (
          <label key={item.id} className="grid gap-2 text-xs md:grid-cols-[1fr_110px]">
            <span className="text-muted-foreground">
              {item.itemName} planned {item.quantityPlanned}
            </span>
            <Input
              type="number"
              min="0"
              max={item.quantityPlanned}
              step="0.01"
              value={
                markAllDelivered
                  ? item.quantityPlanned
                  : (items.find((candidate) => candidate.deliveryItemId === item.id)?.quantityDelivered ?? 0)
              }
              disabled={markAllDelivered}
              onChange={(event) => updateDeliveredQuantity(item.id, Number(event.target.value))}
              aria-label={`${item.itemName} delivered quantity`}
            />
          </label>
        ))}
      </div>
      <Textarea name="notes" placeholder="Internal progress notes" />
      <Button disabled={pending || nextStatuses.length <= 1}>
        <Save className="h-4 w-4" />
        Save progress
      </Button>
      {state.message ? (
        <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>
      ) : null}
    </form>
  );
}

function RestrictedPanel({ title }: { title: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
      You do not have permission to view {title.toLowerCase()}.
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return <div className="rounded-md bg-background p-3 text-sm text-muted-foreground">{message}</div>;
}

function DocumentLinks({
  order,
  canExportDocuments
}: {
  order: OrderRow;
  canExportDocuments: boolean;
}) {
  return (
    <div className="space-y-3">
      {canExportDocuments ? (
        <div className="flex flex-wrap gap-2">
          <a href={`/api/documents/invoice/${order.id}`} className={pdfLinkClass}>
            <Download className="h-4 w-4" />
            Invoice PDF
          </a>
          <a href={`/api/documents/final-order-summary/${order.id}`} className={pdfLinkClass}>
            <Download className="h-4 w-4" />
            Final summary PDF
          </a>
          {order.payments.length > 0
            ? order.payments.map((payment) => (
                <a key={payment.id} href={`/api/documents/payment-receipt/${payment.id}`} className={pdfLinkClass}>
                  <Download className="h-4 w-4" />
                  Receipt {payment.paymentNumber ?? payment.paymentDate}
                </a>
              ))
            : null}
          {order.deliveries.length > 0
            ? order.deliveries.map((delivery) => (
                <a key={delivery.id} href={`/api/documents/delivery-receipt/${delivery.id}`} className={pdfLinkClass}>
                  <Download className="h-4 w-4" />
                  Delivery receipt {delivery.deliveryNumber ?? delivery.scheduledDateLabel ?? "Not assigned"}
                </a>
              ))
            : null}
        </div>
      ) : (
        <RestrictedPanel title="document exports" />
      )}
    </div>
  );
}

function nextOrderAction(
  order: OrderRow,
  canViewPayments: boolean,
  canViewDeliveries: boolean,
  canExportDocuments: boolean
) {
  if (canViewPayments && order.balanceAmountValue > 0) {
    return "Collect or record balance";
  }

  if (canViewDeliveries && order.deliveryStatus === "NOT_SCHEDULED") {
    return "Schedule delivery";
  }

  if (canViewDeliveries && order.nextDeliveryDate) {
    return "Prepare delivery";
  }

  if (canExportDocuments && order.salesInvoiceRequested) {
    return "Download invoice PDF";
  }

  if (order.salesInvoiceRequested) {
    return "Review invoice request";
  }

  if (order.status === "COMPLETED") {
    return "No open action";
  }

  return "Review order";
}

function canScheduleDelivery(order: OrderRow, canViewDeliveries: boolean, canCreateDeliveries: boolean) {
  return (
    canViewDeliveries &&
    canCreateDeliveries &&
    !["DELIVERED", "CANCELLED"].includes(order.deliveryStatus) &&
    order.items.some((item) => item.remainingQuantity > 0)
  );
}

export function NewOrderLauncher({
  canCreateOrders,
  canViewPayments,
  customers,
  products,
  approvedQuotations
}: NewOrderLauncherProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<NewOrderMode>("choices");

  if (!canCreateOrders) {
    return null;
  }

  function closePanel() {
    setOpen(false);
    setMode("choices");
  }

  const title =
    mode === "quotation" ? "Convert approved quotation" : mode === "manual" ? "Create manual order" : "New order";
  const description =
    mode === "quotation"
      ? "Start from a quotation that is already accepted."
      : mode === "manual"
        ? "Build a direct order for negotiated or custom sales."
        : "Choose how this order should start.";

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <Plus className="h-4 w-4" />
        New order
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close new order panel"
            className="absolute inset-0 bg-foreground/25"
            onClick={closePanel}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-order-title"
            className="relative ml-auto flex h-full w-full max-w-5xl flex-col overflow-hidden border-l border-border bg-panel shadow-xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
              <div className="min-w-0">
                {mode !== "choices" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="-ml-3 mb-2 min-h-8 px-2 text-xs"
                    onClick={() => setMode("choices")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                ) : null}
                <p className="studio-kicker">Order Entry</p>
                <h2 id="new-order-title" className="mt-1 text-xl font-semibold">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
              <Button type="button" variant="ghost" onClick={closePanel}>
                Close
              </Button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {mode === "choices" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    className="rounded-lg border border-border bg-background p-4 text-left transition hover:bg-soft-accent/45 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => setMode("quotation")}
                    disabled={approvedQuotations.length === 0}
                  >
                    <FileText className="mb-4 h-5 w-5 text-accent" />
                    <span className="block text-base font-semibold">Convert approved quotation</span>
                    <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                      Pull customer, item, and negotiated total from an accepted quotation.
                    </span>
                    <span className="mt-4 block text-xs font-semibold uppercase text-muted-foreground">
                      {approvedQuotations.length} ready
                    </span>
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-border bg-background p-4 text-left transition hover:bg-soft-accent/45"
                    onClick={() => setMode("manual")}
                  >
                    <ClipboardList className="mb-4 h-5 w-5 text-accent" />
                    <span className="block text-base font-semibold">Create manual order</span>
                    <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                      Enter a direct order with catalog or custom items and negotiated pricing.
                    </span>
                    <span className="mt-4 block text-xs font-semibold uppercase text-muted-foreground">
                      Customer + items + terms
                    </span>
                  </button>
                </div>
              ) : null}

              {mode === "quotation" ? (
                <ConvertApprovedQuotationForm approvedQuotations={approvedQuotations} />
              ) : null}

              {mode === "manual" ? (
                <ManualOrderForm
                  canViewPayments={canViewPayments}
                  customers={customers}
                  products={products}
                />
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ConvertApprovedQuotationForm({
  approvedQuotations
}: {
  approvedQuotations: ApprovedQuotationOption[];
}) {
  const [convertState, convertAction, convertPending] = useActionState(
    convertQuotationToOrderAction,
    initialState
  );

  return (
    <form action={convertAction} className="max-w-3xl space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="quotationId">
          Approved quotation
        </label>
        <Select id="quotationId" name="quotationId" required defaultValue="">
          <option value="" disabled>
            Choose approved quotation
          </option>
          {approvedQuotations.map((quotation) => (
            <option key={quotation.id} value={quotation.id}>
              {quotation.customerName} - {quotation.totalAmount} - {quotation.itemCount} item(s)
            </option>
          ))}
        </Select>
      </div>

      {approvedQuotations.length === 0 ? (
        <div className="studio-empty px-4 py-4 text-sm">
          No accepted quotations are waiting to be converted.
        </div>
      ) : null}

      {convertState.message ? (
        <p className={cn("text-sm", convertState.ok ? "text-success" : "text-danger")}>
          {convertState.message}
        </p>
      ) : null}

      <Button disabled={convertPending || approvedQuotations.length === 0}>
        <CalendarClock className="h-4 w-4" />
        Convert quotation
      </Button>
    </form>
  );
}

function ManualOrderForm({
  canViewPayments,
  customers,
  products
}: Pick<OrderWorkspaceProps, "canViewPayments" | "customers" | "products">) {
  const [manualState, manualAction, manualPending] = useActionState(
    createManualOrderAction,
    initialState
  );
  const [items, setItems] = useState<ItemDraft[]>([createCustomItem(0)]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [step, setStep] = useState<ManualOrderStep>("customer");
  const [orderDiscountType, setOrderDiscountType] = useState<"" | "FIXED_AMOUNT" | "PERCENTAGE">(
    ""
  );
  const [orderDiscountValue, setOrderDiscountValue] = useState(0);

  const totals = useMemo(() => {
    const subtotalAmount = roundMoney(items.reduce((sum, item) => sum + itemSubtotal(item), 0));
    const itemDiscountTotal = roundMoney(
      items.reduce((sum, item) => sum + itemDiscountAmount(item), 0)
    );
    const postItemDiscountTotal = roundMoney(
      items.reduce((sum, item) => sum + itemLineTotal(item), 0)
    );
    const totalCostAmount = roundMoney(
      items.reduce((sum, item) => sum + itemCostTotal(item), 0)
    );
    const orderDiscountAmount =
      orderDiscountType === "PERCENTAGE"
        ? roundMoney(postItemDiscountTotal * (orderDiscountValue / 100))
        : orderDiscountType === "FIXED_AMOUNT"
          ? roundMoney(orderDiscountValue)
          : 0;

    const totalAmount = roundMoney(Math.max(postItemDiscountTotal - orderDiscountAmount, 0));

    return {
      subtotalAmount,
      itemDiscountTotal,
      totalCostAmount,
      orderDiscountAmount,
      totalAmount,
      grossProfitAmount: roundMoney(totalAmount - totalCostAmount)
    };
  }, [items, orderDiscountType, orderDiscountValue]);

  function addCatalogItem() {
    const product = products.find((candidate) => candidate.id === selectedProductId);

    if (!product) {
      return;
    }

    setItems((current) => [
      ...current,
      {
        productId: product.id,
        itemType: "CATALOG_PRODUCT",
        sortOrder: current.length,
        snapshotProductCode: product.code ?? undefined,
        itemName: product.name,
        description: product.description ?? "",
        specifications: product.specifications ?? "",
        quantity: 1,
        unitPrice: product.referencePrice ?? 0,
        unitCostSnapshot: product.referenceCost ?? 0,
        discountType: "",
        discountValue: 0,
        customerNotes: "",
        internalNotes: ""
      }
    ]);
    setSelectedProductId("");
  }

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addCustomItem() {
    setItems((current) => [...current, createCustomItem(current.length)]);
  }

  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const manualSteps: Array<{ key: ManualOrderStep; label: string }> = [
    { key: "customer", label: "Customer" },
    { key: "items", label: "Items" },
    { key: "terms", label: "Payment / delivery notes" },
    { key: "review", label: "Review and save" }
  ];
  const currentStepIndex = manualSteps.findIndex((candidate) => candidate.key === step);
  const canSave =
    customers.length > 0 &&
    items.length > 0 &&
    items.every((item) => item.itemName.trim() && item.quantity > 0 && item.unitPrice >= 0);

  function moveStep(offset: number) {
    const next = manualSteps[Math.min(Math.max(currentStepIndex + offset, 0), manualSteps.length - 1)];
    setStep(next.key);
  }

  return (
    <form action={manualAction} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <input type="hidden" name="items" value={JSON.stringify(toActionItems(items))} />

      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap gap-2">
          {manualSteps.map((candidate, index) => (
            <button
              key={candidate.key}
              type="button"
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition",
                step === candidate.key
                  ? "border-primary/30 bg-primary/15 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-soft-accent/50"
              )}
              onClick={() => setStep(candidate.key)}
            >
              {index + 1}. {candidate.label}
            </button>
          ))}
        </div>

        <section className={cn("space-y-4", step !== "customer" && "hidden")}>
          <div>
            <p className="studio-kicker">Customer</p>
            <h3 className="mt-1 text-base font-semibold">Who is this order for?</h3>
          </div>
          {customers.length > 0 ? (
            <label className="block max-w-xl space-y-2 text-sm font-medium">
              Customer
              <Select
                name="customerId"
                required
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.displayName}
                    {customer.companyName ? ` - ${customer.companyName}` : ""}
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <div className="studio-empty px-4 py-4 text-sm">
              Add a customer record before creating a manual order.
            </div>
          )}
        </section>

        <section className={cn("space-y-4", step !== "items" && "hidden")}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="studio-kicker">Items</p>
              <h3 className="mt-1 text-base font-semibold">Build the order lines</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto_auto]">
              <Select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                aria-label="Catalog product"
              >
                <option value="">Choose active catalog item</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {[product.code, product.name, product.category].filter(Boolean).join(" - ")}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="secondary" onClick={addCatalogItem} disabled={!selectedProductId}>
                <PackageSearch className="h-4 w-4" />
                Add catalog item
              </Button>
              <Button type="button" variant="secondary" onClick={addCustomItem}>
                <Plus className="h-4 w-4" />
                Add custom item
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="rounded-lg border border-border bg-background p-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_96px_130px_180px_130px_auto]">
                  <label className="space-y-2 text-sm font-medium">
                    Item name
                    <Input
                      value={item.itemName}
                      onChange={(event) => updateItem(index, { itemName: event.target.value })}
                      placeholder="Item name"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Qty
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
                      aria-label="Quantity"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Unit price
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })}
                      aria-label="Unit price"
                    />
                  </label>
                  <div className="space-y-2 text-sm font-medium">
                    Discount
                    <div className="grid gap-2 sm:grid-cols-[1fr_86px]">
                      <Select
                        value={item.discountType}
                        onChange={(event) =>
                          updateItem(index, {
                            discountType: event.target.value as ItemDraft["discountType"],
                            discountValue: event.target.value ? item.discountValue : 0
                          })
                        }
                        aria-label="Discount type"
                      >
                        <option value="">None</option>
                        <option value="FIXED_AMOUNT">Fixed</option>
                        <option value="PERCENTAGE">%</option>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.discountValue}
                        disabled={!item.discountType}
                        onChange={(event) => updateItem(index, { discountValue: Number(event.target.value) })}
                        aria-label="Discount value"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 text-sm font-medium">
                    Line total
                    <div className="min-h-10 rounded-lg bg-panel px-3 py-2 font-semibold">
                      {money(itemLineTotal(item))}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="self-end px-3"
                    onClick={() => removeItem(index)}
                    aria-label={`Remove ${item.itemName || "item"}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <details className="mt-3 border-t border-border pt-3">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                    Item notes and specs
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Textarea
                      value={item.description}
                      onChange={(event) => updateItem(index, { description: event.target.value })}
                      placeholder="Description"
                    />
                    <Textarea
                      value={item.specifications}
                      onChange={(event) => updateItem(index, { specifications: event.target.value })}
                      placeholder="Specifications"
                    />
                    <Textarea
                      value={item.customerNotes}
                      onChange={(event) => updateItem(index, { customerNotes: event.target.value })}
                      placeholder="Customer-facing item note"
                    />
                    <Textarea
                      value={item.internalNotes}
                      onChange={(event) => updateItem(index, { internalNotes: event.target.value })}
                      placeholder="Internal item note"
                    />
                  </div>
                </details>
              </div>
            ))}
          </div>

          {items.length === 0 ? (
            <div className="studio-empty px-4 py-4 text-sm">
              Add a catalog item or custom item to continue.
            </div>
          ) : null}

          {canViewPayments ? (
            <details className="rounded-lg border border-border bg-background p-3">
              <summary className="cursor-pointer text-sm font-semibold">Advanced cost/profit</summary>
              <div className="mt-3 space-y-3">
                {items.map((item, index) => (
                  <div
                    key={`${index}-${item.itemName}`}
                    className="grid gap-3 text-sm md:grid-cols-[minmax(0,1fr)_140px_140px]"
                  >
                    <span className="truncate font-medium">{item.itemName || `Item ${index + 1}`}</span>
                    <label className="space-y-1 text-muted-foreground">
                      Unit cost
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitCostSnapshot}
                        onChange={(event) => updateItem(index, { unitCostSnapshot: Number(event.target.value) })}
                        aria-label="Unit cost"
                      />
                    </label>
                    <div>
                      <p className="text-muted-foreground">Line profit</p>
                      <p className="mt-2 font-semibold">{money(itemLineTotal(item) - itemCostTotal(item))}</p>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <section className={cn("space-y-4", step !== "terms" && "hidden")}>
          <div>
            <p className="studio-kicker">Payment / Delivery</p>
            <h3 className="mt-1 text-base font-semibold">Add order-level instructions</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium">
              <input type="checkbox" name="needsAssembly" value="true" />
              Needs assembly
            </label>
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium">
              <input type="checkbox" name="salesInvoiceRequested" value="true" />
              Sales invoice requested
            </label>
            <label className="space-y-2 text-sm font-medium">
              Mode of delivery
              <Input name="modeOfDelivery" placeholder="Pickup, delivery, company-arranged" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Delivery method
              <Input name="deliveryMethod" placeholder="In-house, third-party, customer pickup" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Payment terms
              <Textarea name="paymentTerms" placeholder="Downpayment, balance timing, company terms" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Remarks / special instructions
              <Textarea name="specialInstructions" placeholder="Assembly, access, timing, or client reminders" />
            </label>
            <Textarea name="customerNotes" placeholder="Customer-facing order notes" />
            <Textarea name="internalNotes" placeholder="Internal notes" />
          </div>
        </section>

        <section className={cn("space-y-4", step !== "review" && "hidden")}>
          <div>
            <p className="studio-kicker">Review</p>
            <h3 className="mt-1 text-base font-semibold">Confirm before saving</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-background p-3">
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="mt-1 font-semibold">{selectedCustomer?.displayName ?? "No customer selected"}</p>
            </div>
            <div className="rounded-lg bg-background p-3">
              <p className="text-sm text-muted-foreground">Items</p>
              <p className="mt-1 font-semibold">{items.length} line(s)</p>
            </div>
            <div className="rounded-lg bg-background p-3">
              <p className="text-sm text-muted-foreground">Order total</p>
              <p className="mt-1 font-semibold">{money(totals.totalAmount)}</p>
            </div>
          </div>
          <div className="divide-y divide-border rounded-lg border border-border bg-background">
            {items.map((item, index) => (
              <div key={index} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{item.itemName || `Item ${index + 1}`}</p>
                  <p className="text-muted-foreground">
                    {item.quantity} x {money(item.unitPrice)}
                    {item.discountType ? ` · Discount ${money(itemDiscountAmount(item))}` : ""}
                  </p>
                </div>
                <p className="font-semibold">{money(itemLineTotal(item))}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="h-fit rounded-lg border border-border bg-background p-4">
        <p className="studio-kicker">Order Summary</p>
        <h3 className="mt-1 text-base font-semibold">Totals</h3>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{money(totals.subtotalAmount)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Item discounts</span>
            <span className="font-medium">{money(totals.itemDiscountTotal)}</span>
          </div>
          <div className="grid gap-2">
            <Select
              name="orderDiscountType"
              value={orderDiscountType}
              onChange={(event) => setOrderDiscountType(event.target.value as typeof orderDiscountType)}
            >
              <option value="">No order discount</option>
              <option value="FIXED_AMOUNT">Fixed amount</option>
              <option value="PERCENTAGE">Percentage</option>
            </Select>
            <Input
              name="orderDiscountValue"
              type="number"
              min="0"
              step="0.01"
              value={orderDiscountValue}
              disabled={!orderDiscountType}
              onChange={(event) => setOrderDiscountValue(Number(event.target.value))}
              aria-label="Order discount value"
            />
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Order discount</span>
            <span className="font-medium">{money(totals.orderDiscountAmount)}</span>
          </div>
          {canViewPayments ? (
            <>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Total cost</span>
                <span className="font-medium">{money(totals.totalCostAmount)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Gross profit</span>
                <span className="font-medium">{money(totals.grossProfitAmount)}</span>
              </div>
            </>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-border pt-3 text-base">
            <span className="font-semibold">Total</span>
            <span className="font-semibold">{money(totals.totalAmount)}</span>
          </div>
          {manualState.message ? (
            <p className={cn("text-sm", manualState.ok ? "text-success" : "text-danger")}>
              {manualState.message}
            </p>
          ) : null}
          <div className="flex gap-2 pt-1">
            {currentStepIndex > 0 ? (
              <Button type="button" variant="secondary" onClick={() => moveStep(-1)} className="flex-1">
                Back
              </Button>
            ) : null}
            {step !== "review" ? (
              <Button type="button" onClick={() => moveStep(1)} className="flex-1">
                Next
              </Button>
            ) : (
              <Button disabled={manualPending || !canSave} className="flex-1">
                <Save className="h-4 w-4" />
                Save order
              </Button>
            )}
          </div>
        </div>
      </aside>
    </form>
  );
}

export function OrderWorkspace({
  canUpdateOrders,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  canUpdateDeliveries,
  canExportDocuments,
  orders
}: OrderListProps) {
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [activeOrderActions, setActiveOrderActions] = useState<Record<string, ActiveOrderAction>>({});
  const [activeDetailTabs, setActiveDetailTabs] = useState<Record<string, OrderDetailTab>>({});

  function toggleOrderDetails(orderId: string) {
    if (expandedOrders[orderId]) {
      setActiveOrderActions((current) => ({ ...current, [orderId]: null }));
    }

    setExpandedOrders((current) => ({ ...current, [orderId]: !current[orderId] }));
  }

  function setActiveOrderAction(orderId: string, actionKey: ActiveOrderAction) {
    setActiveOrderActions((current) => ({
      ...current,
      [orderId]: current[orderId] === actionKey ? null : actionKey
    }));
  }

  function openOrderDetails(orderId: string, tab: OrderDetailTab, actionKey: ActiveOrderAction = null) {
    setExpandedOrders((current) => ({ ...current, [orderId]: true }));
    setActiveDetailTabs((current) => ({ ...current, [orderId]: tab }));
    setActiveOrderActions((current) => ({ ...current, [orderId]: actionKey }));
  }

  function setActiveDetailTab(orderId: string, tab: OrderDetailTab) {
    setActiveDetailTabs((current) => ({ ...current, [orderId]: tab }));
  }

  return (
    <section className="studio-card">
      <div className="studio-card-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="studio-kicker">Work Queue</p>
          <h2 className="mt-1 text-base font-semibold">Orders needing review</h2>
        </div>
        <p className="text-sm text-muted-foreground">{orders.length} shown</p>
      </div>
      <div className="divide-y divide-border">
        {orders.map((order) => {
          const expanded = Boolean(expandedOrders[order.id]);
          const activeAction = activeOrderActions[order.id] ?? null;
          const activeTab = activeDetailTabs[order.id] ?? "overview";
          const actionLabel = nextOrderAction(order, canViewPayments, canViewDeliveries, canExportDocuments);

          return (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expanded}
              activeAction={activeAction}
              activeTab={activeTab}
              actionLabel={actionLabel}
              canUpdateOrders={canUpdateOrders}
              canViewPayments={canViewPayments}
              canCreatePayments={canCreatePayments}
              canViewDeliveries={canViewDeliveries}
              canCreateDeliveries={canCreateDeliveries}
              canUpdateDeliveries={canUpdateDeliveries}
              canExportDocuments={canExportDocuments}
              onToggleDetails={() => toggleOrderDetails(order.id)}
              onOpenAction={(tab, actionKey) => openOrderDetails(order.id, tab, actionKey)}
              onTabChange={(tab) => setActiveDetailTab(order.id, tab)}
              onActionChange={(actionKey) => setActiveOrderAction(order.id, actionKey)}
            />
          );
        })}
        {orders.length === 0 ? (
          <div className="studio-empty m-5 px-5 py-8 text-sm">
            No orders match the current queue filters.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function OrderCard({
  order,
  expanded,
  activeAction,
  activeTab,
  actionLabel,
  canUpdateOrders,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  canUpdateDeliveries,
  canExportDocuments,
  onToggleDetails,
  onOpenAction,
  onTabChange,
  onActionChange
}: {
  order: OrderRow;
  expanded: boolean;
  activeAction: ActiveOrderAction;
  activeTab: OrderDetailTab;
  actionLabel: string;
  canUpdateOrders: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  canUpdateDeliveries: boolean;
  canExportDocuments: boolean;
  onToggleDetails: () => void;
  onOpenAction: (tab: OrderDetailTab, actionKey?: ActiveOrderAction) => void;
  onTabChange: (tab: OrderDetailTab) => void;
  onActionChange: (actionKey: ActiveOrderAction) => void;
}) {
  const showPaymentAction = canViewPayments && canCreatePayments && order.balanceAmountValue > 0;
  const showDeliveryAction = canScheduleDelivery(order, canViewDeliveries, canCreateDeliveries);

  return (
    <article className="bg-panel">
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 truncate text-base font-semibold">
              {order.displayId} · {order.customerName}
            </h2>
            <StatusPill tone={statusTone(order.status)}>{orderStatusLabel(order.status)}</StatusPill>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {order.assignedStaff ? <span>Staff: {order.assignedStaff}</span> : null}
            <span>{readableLabel(order.sourceType)}</span>
            <span>Updated {order.updatedAt}</span>
          </div>

          <div className="grid gap-3 text-sm md:grid-cols-4">
            {canViewPayments ? (
              <div>
                <p className="text-muted-foreground">Balance</p>
                <p className="mt-1 font-semibold">{order.balanceAmount}</p>
              </div>
            ) : null}
            {canViewPayments ? (
              <div>
                <p className="text-muted-foreground">Payment</p>
                <div className="mt-1">
                  <StatusPill tone={statusTone(order.paymentStatus)}>
                    {paymentStatusLabel(order.paymentStatus)}
                  </StatusPill>
                </div>
              </div>
            ) : null}
            {canViewDeliveries ? (
              <div>
                <p className="text-muted-foreground">Delivery</p>
                <div className="mt-1">
                  <StatusPill tone={statusTone(order.deliveryStatus)}>
                    {deliveryStatusLabel(order.deliveryStatus)}
                  </StatusPill>
                </div>
              </div>
            ) : null}
            {canViewDeliveries ? (
              <div>
                <p className="text-muted-foreground">Next delivery</p>
                <p className="mt-1 font-semibold">
                  {order.nextDeliveryDate ?? "None"}
                  {order.nextDeliveryProvider ? (
                    <span className="font-normal text-muted-foreground"> · {readableLabel(order.nextDeliveryProvider)}</span>
                  ) : null}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 rounded-lg bg-background p-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <ListChecks className="h-4 w-4" />
              Next action
            </p>
            <p className="mt-1 text-sm font-semibold">{actionLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {showPaymentAction ? (
              <Button
                type="button"
                className="min-h-9 px-3 text-xs"
                onClick={() => onOpenAction("payments", "payment")}
              >
                <ReceiptText className="h-4 w-4" />
                Record payment
              </Button>
            ) : null}
            {showDeliveryAction ? (
              <Button
                type="button"
                variant={showPaymentAction ? "secondary" : "primary"}
                className="min-h-9 px-3 text-xs"
                onClick={() => onOpenAction("deliveries", "delivery")}
              >
                <Truck className="h-4 w-4" />
                Schedule delivery
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="min-h-9 px-3 text-xs"
              onClick={onToggleDetails}
            >
              {expanded ? "Hide details" : "View details"}
            </Button>
          </div>
        </div>
      </div>

      {expanded ? (
        <OrderDetailPanel
          order={order}
          activeTab={activeTab}
          activeAction={activeAction}
          canUpdateOrders={canUpdateOrders}
          canViewPayments={canViewPayments}
          canCreatePayments={canCreatePayments}
          canViewDeliveries={canViewDeliveries}
          canCreateDeliveries={canCreateDeliveries}
          canUpdateDeliveries={canUpdateDeliveries}
          canExportDocuments={canExportDocuments}
          actionLabel={actionLabel}
          onTabChange={onTabChange}
          onActionChange={onActionChange}
        />
      ) : null}
    </article>
  );
}

function OrderDetailPanel({
  order,
  activeTab,
  activeAction,
  canUpdateOrders,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  canUpdateDeliveries,
  canExportDocuments,
  actionLabel,
  onTabChange,
  onActionChange
}: {
  order: OrderRow;
  activeTab: OrderDetailTab;
  activeAction: ActiveOrderAction;
  canUpdateOrders: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  canUpdateDeliveries: boolean;
  canExportDocuments: boolean;
  actionLabel: string;
  onTabChange: (tab: OrderDetailTab) => void;
  onActionChange: (actionKey: ActiveOrderAction) => void;
}) {
  const tabs: Array<{ key: OrderDetailTab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "items", label: "Items" },
    { key: "payments", label: "Payments" },
    { key: "deliveries", label: "Deliveries" },
    { key: "documents", label: "Documents" },
    { key: "notes", label: "Notes" }
  ];

  return (
    <div className="border-t border-border bg-background/60 p-4">
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold transition",
              activeTab === tab.key
                ? "border-primary/30 bg-primary/15 text-foreground"
                : "border-border bg-panel text-muted-foreground hover:bg-soft-accent/50"
            )}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <OverviewSection
          order={order}
          canViewPayments={canViewPayments}
          canViewDeliveries={canViewDeliveries}
          actionLabel={actionLabel}
        />
      ) : null}
      {activeTab === "items" ? (
        <ItemsSection
          order={order}
          canViewPayments={canViewPayments}
          canViewDeliveries={canViewDeliveries}
        />
      ) : null}
      {activeTab === "payments" ? (
        <PaymentSection
          order={order}
          activeAction={activeAction}
          canUpdateOrders={canUpdateOrders}
          canViewPayments={canViewPayments}
          canCreatePayments={canCreatePayments}
          canExportDocuments={canExportDocuments}
          onActionChange={onActionChange}
        />
      ) : null}
      {activeTab === "deliveries" ? (
        <DeliverySection
          order={order}
          activeAction={activeAction}
          canViewDeliveries={canViewDeliveries}
          canCreateDeliveries={canCreateDeliveries}
          canUpdateDeliveries={canUpdateDeliveries}
          canExportDocuments={canExportDocuments}
          onActionChange={onActionChange}
        />
      ) : null}
      {activeTab === "documents" ? (
        <DocumentsSection order={order} canExportDocuments={canExportDocuments} />
      ) : null}
      {activeTab === "notes" ? (
        <NotesSection
          order={order}
          canViewPayments={canViewPayments}
          canViewDeliveries={canViewDeliveries}
        />
      ) : null}
    </div>
  );
}

function OverviewSection({
  order,
  canViewPayments,
  canViewDeliveries,
  actionLabel
}: {
  order: OrderRow;
  canViewPayments: boolean;
  canViewDeliveries: boolean;
  actionLabel: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Order status</p>
            <div className="mt-1">
              <StatusPill tone={statusTone(order.status)}>{orderStatusLabel(order.status)}</StatusPill>
            </div>
          </div>
          {canViewPayments ? (
            <div>
              <p className="text-muted-foreground">Payment status</p>
              <div className="mt-1">
                <StatusPill tone={statusTone(order.paymentStatus)}>
                  {paymentStatusLabel(order.paymentStatus)}
                </StatusPill>
              </div>
            </div>
          ) : null}
          {canViewDeliveries ? (
            <div>
              <p className="text-muted-foreground">Delivery status</p>
              <div className="mt-1">
                <StatusPill tone={statusTone(order.deliveryStatus)}>
                  {deliveryStatusLabel(order.deliveryStatus)}
                </StatusPill>
              </div>
            </div>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Customer</p>
            <p className="mt-1 font-semibold">{order.customerName}</p>
            {order.companyName ? <p className="text-muted-foreground">{order.companyName}</p> : null}
            {order.contactPersonName ? <p className="text-muted-foreground">{order.contactPersonName}</p> : null}
            {order.contactSnapshot ? <p className="text-muted-foreground">{order.contactSnapshot}</p> : null}
          </div>
          <div>
            <p className="text-muted-foreground">Sales details</p>
            <p className="mt-1">{readableLabel(order.sourceType)}</p>
            <p className="text-muted-foreground">Created {order.createdAt}</p>
            <p className="text-muted-foreground">Updated {order.updatedAt}</p>
          </div>
        </div>
      </div>
      <aside className="rounded-lg bg-panel p-4 text-sm">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          <ListChecks className="h-4 w-4" />
          Next action
        </p>
        <p className="mt-2 text-base font-semibold">{actionLabel}</p>
        {canViewPayments ? (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-muted-foreground">Balance</p>
            <p className="mt-1 text-lg font-semibold">{order.balanceAmount}</p>
            <p className="text-muted-foreground">Paid {order.paidAmount} of {order.totalAmount}</p>
          </div>
        ) : null}
        {canViewDeliveries ? (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-muted-foreground">Next delivery</p>
            <p className="mt-1 font-semibold">{order.nextDeliveryDate ?? "None scheduled"}</p>
            {order.nextDeliveryProvider ? (
              <p className="text-muted-foreground">{readableLabel(order.nextDeliveryProvider)}</p>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function ItemsSection({
  order,
  canViewPayments,
  canViewDeliveries
}: {
  order: OrderRow;
  canViewPayments: boolean;
  canViewDeliveries: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 pl-3 font-medium">Item</th>
              <th className="py-2 font-medium">Qty</th>
              {canViewDeliveries ? <th className="py-2 font-medium">Scheduled</th> : null}
              {canViewDeliveries ? <th className="py-2 font-medium">Delivered</th> : null}
              {canViewPayments ? <th className="py-2 font-medium">Unit</th> : null}
              {canViewPayments ? <th className="py-2 font-medium">Discount</th> : null}
              {canViewPayments ? <th className="py-2 pr-3 font-medium">Line total</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="py-3 pl-3 font-medium">{item.itemName}</td>
                <td className="py-3 text-muted-foreground">{item.quantity}</td>
                {canViewDeliveries ? (
                  <td className="py-3 text-muted-foreground">{item.plannedQuantity}</td>
                ) : null}
                {canViewDeliveries ? (
                  <td className="py-3 text-muted-foreground">{item.deliveredQuantity}</td>
                ) : null}
                {canViewPayments ? <td className="py-3 text-muted-foreground">{item.unitPrice}</td> : null}
                {canViewPayments ? <td className="py-3 text-muted-foreground">{item.discountAmount}</td> : null}
                {canViewPayments ? <td className="py-3 pr-3 font-semibold">{item.lineTotal}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canViewPayments ? (
        <details className="rounded-lg border border-border bg-panel p-3">
          <summary className="cursor-pointer text-sm font-semibold">Cost/profit details</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 font-medium">Unit cost</th>
                  <th className="py-2 font-medium">Line cost</th>
                  <th className="py-2 font-medium">Line profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 font-medium">{item.itemName}</td>
                    <td className="py-2 text-muted-foreground">{item.unitCostSnapshot}</td>
                    <td className="py-2 text-muted-foreground">{item.lineCostTotal}</td>
                    <td className="py-2 font-medium">{item.lineProfit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}

function PaymentSection({
  order,
  activeAction,
  canUpdateOrders,
  canViewPayments,
  canCreatePayments,
  canExportDocuments,
  onActionChange
}: {
  order: OrderRow;
  activeAction: ActiveOrderAction;
  canUpdateOrders: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canExportDocuments: boolean;
  onActionChange: (actionKey: ActiveOrderAction) => void;
}) {
  if (!canViewPayments) {
    return <RestrictedPanel title="payment data" />;
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 text-sm md:grid-cols-5">
        <div>
          <p className="text-muted-foreground">Balance</p>
          <p className="mt-1 font-semibold">{order.balanceAmount}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Paid</p>
          <p className="mt-1 font-semibold">{order.paidAmount}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total</p>
          <p className="mt-1 font-semibold">{order.totalAmount}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Last payment</p>
          <p className="mt-1 font-semibold">{order.lastPaymentDate ?? "None"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Status</p>
          <div className="mt-1">
            <StatusPill tone={statusTone(order.paymentStatus)}>{paymentStatusLabel(order.paymentStatus)}</StatusPill>
          </div>
        </div>
      </div>

      {canCreatePayments || (canUpdateOrders && order.balanceAmountValue > 0) ? (
        <div className="flex flex-wrap gap-2">
          {canCreatePayments ? (
            <Button
              type="button"
              variant={activeAction === "payment" ? "primary" : "secondary"}
              onClick={() => onActionChange("payment")}
            >
              <ReceiptText className="h-4 w-4" />
              Record payment
            </Button>
          ) : null}
          {canUpdateOrders && order.balanceAmountValue > 0 ? (
            <Button
              type="button"
              variant={activeAction === "paymentDue" ? "primary" : "secondary"}
              onClick={() => onActionChange("paymentDue")}
            >
              <CalendarClock className="h-4 w-4" />
              Set due timing
            </Button>
          ) : null}
        </div>
      ) : null}

      {activeAction === "payment" && canCreatePayments ? <PaymentForm order={order} /> : null}
      {activeAction === "paymentDue" && canUpdateOrders && order.balanceAmountValue > 0 ? (
        <PaymentDueTimingForm order={order} />
      ) : null}

      {order.payments.length > 0 ? (
        <div className="divide-y divide-border rounded-lg border border-border bg-panel">
          {order.payments.map((payment) => (
            <div key={payment.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-semibold">{payment.amount}</span>
                <StatusPill tone={statusTone(payment.status)}>{paymentStatusLabel(payment.status)}</StatusPill>
              </div>
              <p className="mt-1 text-muted-foreground">
                {payment.paymentDate} · {paymentTypeLabel(payment.paymentType)}
                {payment.method ? ` · ${readableLabel(payment.method)}` : ""}
                {payment.referenceNumber ? ` · ${payment.referenceNumber}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {payment.payerName ? `Payer: ${payment.payerName} · ` : ""}
                Receipt: {payment.receiptGenerated ? "Generated" : "Not generated"}
              </p>
              {canExportDocuments ? (
                <a href={`/api/documents/payment-receipt/${payment.id}`} className={`${pdfLinkClass} mt-3`}>
                  <Download className="h-4 w-4" />
                  Payment receipt PDF
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel message="No payment records yet." />
      )}
    </section>
  );
}

function DeliverySection({
  order,
  activeAction,
  canViewDeliveries,
  canCreateDeliveries,
  canUpdateDeliveries,
  canExportDocuments,
  onActionChange
}: {
  order: OrderRow;
  activeAction: ActiveOrderAction;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  canUpdateDeliveries: boolean;
  canExportDocuments: boolean;
  onActionChange: (actionKey: ActiveOrderAction) => void;
}) {
  if (!canViewDeliveries) {
    return <RestrictedPanel title="delivery data" />;
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 text-sm md:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Delivery status</p>
          <p className="mt-1 font-semibold">{deliveryStatusLabel(order.deliveryStatus)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Next scheduled</p>
          <p className="mt-1 font-semibold">{order.nextDeliveryDate ?? "None"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Provider</p>
          <p className="mt-1 font-semibold">
            {order.nextDeliveryProvider ? readableLabel(order.nextDeliveryProvider) : "None"}
          </p>
        </div>
      </div>

      {canCreateDeliveries ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={activeAction === "delivery" ? "primary" : "secondary"}
            onClick={() => onActionChange("delivery")}
          >
            <Truck className="h-4 w-4" />
            Schedule delivery
          </Button>
        </div>
      ) : null}

      {activeAction === "delivery" && canCreateDeliveries ? <DeliveryForm order={order} /> : null}

      {order.deliveries.length > 0 ? (
        <div className="grid gap-3 text-sm md:grid-cols-2">
          {order.deliveries.map((delivery) => (
            <div key={delivery.id} className="rounded-lg border border-border bg-panel p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-semibold">{delivery.deliveryNumber ?? "Not assigned"}</span>
                <StatusPill tone={statusTone(delivery.status)}>{deliveryStatusLabel(delivery.status)}</StatusPill>
              </div>
              <p className="mt-1 text-muted-foreground">{delivery.scheduledDateLabel ?? "No date"}</p>
              <p className="mt-1 text-muted-foreground">{delivery.itemCount} item line(s)</p>
              <p className="mt-1 text-muted-foreground">
                {providerLabel(delivery.deliveryProviderType, delivery.deliveryProviderName)}
                {delivery.scheduledTimeWindow ? ` · ${delivery.scheduledTimeWindow}` : ""}
                {delivery.deliveryProviderReference ? ` · ${delivery.deliveryProviderReference}` : ""}
              </p>
              {delivery.assignedStaff ? (
                <p className="mt-1 text-xs text-muted-foreground">Assigned: {delivery.assignedStaff}</p>
              ) : null}
              {delivery.addressLine || delivery.recipientName || delivery.recipientPhone ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {[delivery.recipientName, delivery.recipientPhone, delivery.addressLine].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {delivery.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3">
                    <span>{item.itemName}</span>
                    <span>
                      {item.quantityDelivered}/{item.quantityPlanned}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Receipt: {delivery.receiptGenerated ? "Generated" : "Not generated"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canExportDocuments ? (
                  <a href={`/api/documents/delivery-receipt/${delivery.id}`} className={pdfLinkClass}>
                    <Download className="h-4 w-4" />
                    Delivery receipt PDF
                  </a>
                ) : null}
                {canUpdateDeliveries ? (
                  <Button
                    type="button"
                    variant={activeAction === `deliveryProgress:${delivery.id}` ? "primary" : "secondary"}
                    className="min-h-9 px-3 text-xs"
                    onClick={() => onActionChange(`deliveryProgress:${delivery.id}`)}
                  >
                    <Save className="h-4 w-4" />
                    Update progress
                  </Button>
                ) : null}
              </div>
              {activeAction === `deliveryProgress:${delivery.id}` && canUpdateDeliveries ? (
                <DeliveryProgressForm delivery={delivery} />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel message="No delivery records yet." />
      )}
    </section>
  );
}

function DocumentsSection({
  order,
  canExportDocuments
}: {
  order: OrderRow;
  canExportDocuments: boolean;
}) {
  return (
    <section className="space-y-4">
      <DocumentLinks order={order} canExportDocuments={canExportDocuments} />
      {canExportDocuments && order.documents.length > 0 ? (
        <div className="divide-y divide-border rounded-lg border border-border bg-panel text-sm">
          {order.documents.map((document) => (
            <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="font-medium">{document.title}</p>
                <p className="text-muted-foreground">
                  {readableLabel(document.documentType)} · {readableLabel(document.status)}
                </p>
              </div>
              <StatusPill tone={statusTone(document.status)}>{readableLabel(document.status)}</StatusPill>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function NotesSection({
  order,
  canViewPayments,
  canViewDeliveries
}: {
  order: OrderRow;
  canViewPayments: boolean;
  canViewDeliveries: boolean;
}) {
  return (
    <section className="grid gap-4 text-sm lg:grid-cols-2">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Customer snapshot</p>
          <p className="mt-1 font-semibold">{order.customerName}</p>
          {order.companyName ? <p className="text-muted-foreground">{order.companyName}</p> : null}
          {order.contactPersonName ? <p className="text-muted-foreground">{order.contactPersonName}</p> : null}
          {order.contactSnapshot ? <p className="text-muted-foreground">{order.contactSnapshot}</p> : null}
        </div>
        {canViewDeliveries ? (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Delivery address</p>
            <p className="mt-1">{order.deliveryAddressSnapshot ?? "No delivery address snapshot"}</p>
          </div>
        ) : null}
        {order.relatedQuotationId || order.relatedInquiryId ? (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Related quotation / inquiry</p>
            {order.relatedQuotationId ? (
              <p className="mt-1 text-muted-foreground">
                Quotation: {order.relatedQuotationNumber ?? "Not assigned"}
                {order.relatedQuotationStatus ? ` · ${readableLabel(order.relatedQuotationStatus)}` : ""}
              </p>
            ) : null}
            {order.relatedInquiryId ? (
              <p className="mt-1 text-muted-foreground">
                Inquiry: {order.relatedInquiryLabel ?? order.relatedInquiryId.slice(0, 8)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="space-y-3">
        <div className="grid gap-2">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Needs assembly</span>
            <span className="font-medium">{order.needsAssembly ? "Yes" : "No"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Sales invoice</span>
            <span className="font-medium">{order.salesInvoiceRequested ? "Requested" : "No"}</span>
          </div>
          {canViewDeliveries ? (
            <>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Mode of delivery</span>
                <span className="font-medium text-right">{order.modeOfDelivery ?? "Not specified"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Delivery method</span>
                <span className="font-medium text-right">{order.deliveryMethod ?? "Not specified"}</span>
              </div>
            </>
          ) : null}
          {canViewPayments ? (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Payment terms</p>
              <p className="mt-1">{order.paymentTerms ?? "Not specified"}</p>
            </div>
          ) : null}
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Remarks / special instructions</p>
            <p className="mt-1">{order.specialInstructions ?? "Not specified"}</p>
          </div>
        </div>
        {order.customerNotes || order.internalNotes ? (
          <div className="space-y-2 border-t border-border pt-3">
            {order.customerNotes ? (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Customer notes</p>
                <p className="mt-1">{order.customerNotes}</p>
              </div>
            ) : null}
            {order.internalNotes ? (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Internal notes</p>
                <p className="mt-1">{order.internalNotes}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
