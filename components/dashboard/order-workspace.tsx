"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { DeliveryStatus } from "@prisma/client";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Download,
  FileText,
  ListChecks,
  MoreHorizontal,
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
  paymentDueTimingLabel,
  paymentStatusLabel,
  paymentTypeLabel,
  readableLabel,
  statusTone
} from "@/lib/orders/status-labels";
import type { StatusTone } from "@/lib/orders/status-labels";
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
  quotationNumber: string | null;
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
type OpenOrderAction = Exclude<ActiveOrderAction, null>;
type NewOrderMode = "choices" | "quotation" | "manual";
type ManualOrderStep = "customer" | "items" | "plan" | "review";
type OrderDetailTab = "overview" | "items" | "payments" | "deliveries" | "documents" | "notes";
type OrderCardPrimaryActionKind = "recordPayment" | "scheduleDelivery" | "details";
type OrderCardPrimaryAction = {
  kind: OrderCardPrimaryActionKind;
  label: string;
  nextLabel: string;
  onClick: () => void;
};

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

function itemCountLabel(count: number) {
  return `${count} ${count === 1 ? "item" : "items"}`;
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
    <form action={action} className="space-y-4">
      <input type="hidden" name="orderId" value={order.id} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="space-y-2 text-sm font-medium">
          Amount
          <Input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          className="self-end"
          onClick={() => setAmount(String(order.balanceAmountValue))}
        >
          Use full balance
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Payment date
          <Input name="paymentDate" type="date" required aria-label="Payment date" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Method
          <Select name="method" defaultValue="" aria-label="Payment method">
            <option value="">Method optional</option>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="GCASH">GCash</option>
            <option value="CHECK">Check</option>
            <option value="CARD">Card</option>
            <option value="OTHER">Other</option>
          </Select>
        </label>
      </div>
      <label className="block space-y-2 text-sm font-medium">
        Reference number
        <Input name="referenceNumber" placeholder="Reference number optional" />
      </label>
      <details className="rounded-lg border border-border bg-background p-3">
        <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">More details</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">
            Payment type
            <Select name="paymentType" required defaultValue="PARTIAL_PAYMENT" aria-label="Payment type">
              <option value="DOWNPAYMENT">Downpayment</option>
              <option value="PARTIAL_PAYMENT">Partial payment</option>
              <option value="FINAL_PAYMENT">Final payment</option>
              <option value="DELIVERY_BALANCE_PAYMENT">Delivery balance</option>
            </Select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            Payer name
            <Input name="payerName" placeholder="Payer name" />
          </label>
          <Textarea name="customerNotes" placeholder="Receipt note" />
          <Textarea name="internalNotes" placeholder="Internal payment notes" />
        </div>
      </details>
      <div className="rounded-md bg-background px-3 py-2 text-sm">
        <span className="text-muted-foreground">Projected after payment: </span>
        <span className="font-medium">{money(projectedPaid)} paid</span>
        <span className="text-muted-foreground"> · </span>
        <span className="font-medium">{money(projectedBalance)} balance</span>
      </div>
      <Button disabled={pending} className="w-full">
        <ReceiptText className="h-4 w-4" />
        Record payment
      </Button>
      {state.message ? (
        <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>
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
    <form action={action} className="space-y-4">
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="items" value={JSON.stringify(deliveryItems)} />
      <label className="block space-y-2 text-sm font-medium">
        Scheduled date
        <Input name="scheduledDate" type="date" required aria-label="Scheduled date" />
      </label>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
        <label className="space-y-2 text-sm font-medium">
          Item
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
        </label>
        <label className="space-y-2 text-sm font-medium">
          Quantity
          <Input
            type="number"
            min="0.01"
            max={remainingQuantity || undefined}
            step="0.01"
            value={quantityPlanned}
            onChange={(event) => setQuantityPlanned(Number(event.target.value))}
            aria-label="Delivery quantity"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Provider type
          <Select name="deliveryProviderType" defaultValue="" aria-label="Delivery provider type">
            <option value="">Provider type optional</option>
            <option value="IN_HOUSE">In-house</option>
            <option value="CUSTOMER_PICKUP">Customer pickup</option>
            <option value="THIRD_PARTY">Third-party</option>
            <option value="OTHER">Other</option>
          </Select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Provider name
          <Input name="deliveryProviderName" placeholder="Provider name optional" />
        </label>
      </div>
      <label className="block space-y-2 text-sm font-medium">
        Address
        <Input name="deliveryAddress" placeholder="Address optional" />
      </label>
      <details className="rounded-lg border border-border bg-background p-3">
        <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">More details</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input name="deliveryProviderReference" placeholder="Provider reference" />
          <Input name="scheduledTimeWindow" placeholder="Time window" />
          <Input name="recipientName" placeholder="Recipient" />
          <Input name="recipientPhone" placeholder="Phone" />
          <Textarea name="deliveryNotes" placeholder="Delivery notes" />
          <Textarea name="internalNotes" placeholder="Internal notes" />
        </div>
      </details>
      <div className="rounded-md bg-background px-3 py-2 text-sm text-muted-foreground">
        New deliveries are created as Scheduled. Use delivery progress to move them forward.
      </div>
      <Button disabled={pending || !orderItemId || remainingQuantity <= 0} className="w-full">
        <Truck className="h-4 w-4" />
        Schedule
      </Button>
      {state.message ? (
        <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>
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
    <form action={action} className="grid gap-3">
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

function hasBalanceDue(order: OrderRow) {
  return order.balanceAmountValue > 0;
}

function hasRemainingDeliveryQuantity(order: OrderRow) {
  return order.items.some((item) => item.remainingQuantity > 0);
}

function isTerminalOrder(order: OrderRow) {
  return ["CANCELLED", "COMPLETED"].includes(order.status);
}

function isDeliveryComplete(order: OrderRow) {
  return order.deliveryStatus === "DELIVERED";
}

function isDeliveryPartiallyDelivered(order: OrderRow) {
  return order.deliveryStatus === "PARTIALLY_DELIVERED";
}

function isDeliveryScheduled(order: OrderRow) {
  return ["SCHEDULED", "SCHEDULED_FOR_DELIVERY", "IN_TRANSIT"].includes(order.deliveryStatus);
}

function isPaymentPaid(order: OrderRow) {
  return order.paymentStatus === "PAID" || !hasBalanceDue(order);
}

function isPaymentDueBeforeDelivery(order: OrderRow) {
  return order.paymentDueTiming === "BEFORE_DELIVERY" || !order.paymentDueTiming;
}

function isPaymentDueWithOrAfterDelivery(order: OrderRow) {
  return order.paymentDueTiming === "UPON_DELIVERY" || order.paymentDueTiming === "AFTER_DELIVERY";
}

function canScheduleByPaymentState(order: OrderRow) {
  return isPaymentPaid(order) || isPaymentDueWithOrAfterDelivery(order);
}

function isReadyToScheduleDelivery(order: OrderRow) {
  return (
    order.deliveryStatus === "NOT_SCHEDULED" &&
    hasRemainingDeliveryQuantity(order) &&
    canScheduleByPaymentState(order)
  );
}

function workflowStageLabel(order: OrderRow, canViewPayments: boolean, canViewDeliveries: boolean) {
  if (order.status === "CANCELLED") {
    return "Cancelled";
  }

  if (order.status === "COMPLETED") {
    return "Completed";
  }

  if (canViewDeliveries && isDeliveryComplete(order) && canViewPayments && hasBalanceDue(order)) {
    return "Collect balance";
  }

  if (canViewDeliveries && isDeliveryComplete(order) && canViewPayments && isPaymentPaid(order)) {
    return "Ready to complete";
  }

  if (canViewDeliveries && isDeliveryPartiallyDelivered(order)) {
    return "In delivery";
  }

  if (canViewDeliveries && isDeliveryScheduled(order)) {
    return "Scheduled";
  }

  if (canViewPayments && hasBalanceDue(order) && isPaymentDueBeforeDelivery(order)) {
    return "Awaiting payment";
  }

  if (canViewDeliveries && isReadyToScheduleDelivery(order)) {
    return "Ready to schedule";
  }

  return "Review order";
}

function workflowStageTone(stage: string): StatusTone {
  if (["Completed", "Ready to complete"].includes(stage)) {
    return "success";
  }

  if (["Ready to schedule", "Scheduled", "In delivery"].includes(stage)) {
    return "teal";
  }

  if (["Collect balance", "Awaiting payment"].includes(stage)) {
    return "warning";
  }

  if (stage === "Cancelled") {
    return "danger";
  }

  return "neutral";
}

function nextActionLabel(order: OrderRow, canViewPayments: boolean, canViewDeliveries: boolean) {
  if (isTerminalOrder(order)) {
    return "No open action";
  }

  if (canViewDeliveries && isDeliveryComplete(order) && canViewPayments && hasBalanceDue(order)) {
    return "Collect delivery balance";
  }

  if (canViewPayments && hasBalanceDue(order) && isPaymentDueBeforeDelivery(order)) {
    return "Balance due";
  }

  if (canViewDeliveries && isReadyToScheduleDelivery(order)) {
    return "Ready to schedule";
  }

  if (canViewDeliveries && (isDeliveryScheduled(order) || isDeliveryPartiallyDelivered(order))) {
    return "Delivery scheduled";
  }

  if (canViewDeliveries && isDeliveryComplete(order) && (!canViewPayments || isPaymentPaid(order))) {
    return "Review details";
  }

  return "Review details";
}

function nextOrderAction(order: OrderRow, canViewPayments: boolean, canViewDeliveries: boolean) {
  return nextActionLabel(order, canViewPayments, canViewDeliveries);
}

function paymentSummaryLabel(order: OrderRow) {
  if (!hasBalanceDue(order)) {
    return "Paid in full";
  }

  return `${order.balanceAmount} due`;
}

function deliverySummaryLabel(order: OrderRow) {
  if (!order.nextDeliveryDate) {
    return "No schedule";
  }

  return [order.nextDeliveryDate, order.nextDeliveryProvider ? readableLabel(order.nextDeliveryProvider) : null]
    .filter(Boolean)
    .join(" · ");
}

function staffDisplayName(name: string | null) {
  if (!name) {
    return null;
  }

  if (name === "Furniture Odyssey Admin") {
    return "Admin";
  }

  return name;
}

function compactUpdatedAtLabel(value: string) {
  return value.replace(/, \d{4}/, "");
}

function orderMetaLine(order: OrderRow) {
  return [
    readableLabel(order.sourceType),
    staffDisplayName(order.assignedStaff),
    `Updated ${compactUpdatedAtLabel(order.updatedAt)}`
  ]
    .filter(Boolean)
    .join(" · ");
}

function canScheduleDelivery(order: OrderRow, canViewDeliveries: boolean, canCreateDeliveries: boolean) {
  return (
    canViewDeliveries &&
    canCreateDeliveries &&
    !isTerminalOrder(order) &&
    !["DELIVERED", "CANCELLED"].includes(order.deliveryStatus) &&
    isReadyToScheduleDelivery(order)
  );
}

function orderCardPrimaryAction(
  order: OrderRow,
  canViewPayments: boolean,
  canCreatePayments: boolean,
  canViewDeliveries: boolean,
  canCreateDeliveries: boolean
): OrderCardPrimaryActionKind {
  if (isTerminalOrder(order)) {
    return "details";
  }

  if (canViewPayments && canCreatePayments && isDeliveryComplete(order) && hasBalanceDue(order)) {
    return "recordPayment";
  }

  if (canViewPayments && canCreatePayments && hasBalanceDue(order) && isPaymentDueBeforeDelivery(order)) {
    return "recordPayment";
  }

  if (canScheduleDelivery(order, canViewDeliveries, canCreateDeliveries)) {
    return "scheduleDelivery";
  }

  return "details";
}

function getPrimaryOrderAction({
  order,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  isDetailsOpen,
  onDetails,
  onHideDetails,
  onRecordPayment,
  onScheduleDelivery
}: {
  order: OrderRow;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  isDetailsOpen: boolean;
  onDetails: () => void;
  onHideDetails: () => void;
  onRecordPayment: () => void;
  onScheduleDelivery: () => void;
}): OrderCardPrimaryAction {
  const kind = orderCardPrimaryAction(
    order,
    canViewPayments,
    canCreatePayments,
    canViewDeliveries,
    canCreateDeliveries
  );

  if (kind === "recordPayment") {
    return {
      kind,
      label: "Record payment",
      nextLabel: nextActionLabel(order, canViewPayments, canViewDeliveries),
      onClick: onRecordPayment
    };
  }

  if (kind === "scheduleDelivery") {
    return {
      kind,
      label: "Schedule",
      nextLabel: nextActionLabel(order, canViewPayments, canViewDeliveries),
      onClick: onScheduleDelivery
    };
  }

  return {
    kind,
    label: isDetailsOpen ? "Hide" : "Details",
    nextLabel: nextActionLabel(order, canViewPayments, canViewDeliveries),
    onClick: isDetailsOpen ? onHideDetails : onDetails
  };
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
            className="relative ml-auto flex h-full w-full max-w-4xl flex-col overflow-hidden border-l border-border bg-panel shadow-xl"
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
                <div className="grid max-w-3xl gap-4 md:grid-cols-2">
                  <button
                    type="button"
                    className="rounded-lg border border-border bg-background p-4 text-left transition hover:bg-soft-accent/45 disabled:cursor-not-allowed disabled:opacity-70"
                    onClick={() => setMode("quotation")}
                    disabled={approvedQuotations.length === 0}
                  >
                    <span className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                      <span>
                        <span className="block text-base font-semibold">Convert approved quotation</span>
                        <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                          Start from an accepted quotation with customer and items already set.
                        </span>
                      </span>
                    </span>
                    {approvedQuotations.length > 0 ? (
                      <span className="mt-4 block space-y-2">
                        {approvedQuotations.slice(0, 3).map((quotation) => (
                          <span
                            key={quotation.id}
                            className="block rounded-md border border-border bg-panel px-3 py-2 text-sm"
                          >
                            <span className="block truncate font-semibold">
                              {quotation.quotationNumber ?? "No quote number"} · {quotation.customerName}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {quotation.totalAmount} · {itemCountLabel(quotation.itemCount)}
                            </span>
                          </span>
                        ))}
                        {approvedQuotations.length > 3 ? (
                          <span className="block text-xs font-semibold text-muted-foreground">
                            +{approvedQuotations.length - 3} more ready
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="mt-4 block rounded-md border border-dashed border-border bg-panel px-3 py-2 text-sm font-medium text-muted-foreground">
                        No approved quotations ready
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-border bg-background p-4 text-left transition hover:bg-soft-accent/45"
                    onClick={() => setMode("manual")}
                  >
                    <span className="flex items-start gap-3">
                      <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                      <span>
                        <span className="block text-base font-semibold">Create manual order</span>
                        <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                          Build a direct order for negotiated or custom sales.
                        </span>
                      </span>
                    </span>
                    <span className="mt-4 block space-y-2 text-sm">
                      {[
                        "Choose customer",
                        "Add catalog or custom items",
                        "Set payment and delivery plan",
                        "Review before creating"
                      ].map((item) => (
                        <span key={item} className="flex items-center gap-2 text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                          {item}
                        </span>
                      ))}
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
  const [selectedQuotationId, setSelectedQuotationId] = useState(
    approvedQuotations.length === 1 ? (approvedQuotations[0]?.id ?? "") : ""
  );
  const selectedQuotation =
    approvedQuotations.find((quotation) => quotation.id === selectedQuotationId) ?? null;

  return (
    <form action={convertAction} className="max-w-3xl space-y-4">
      <input type="hidden" name="quotationId" value={selectedQuotationId} />

      {approvedQuotations.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3" role="radiogroup" aria-label="Approved quotations">
            {approvedQuotations.map((quotation) => {
              const selected = selectedQuotationId === quotation.id;

              return (
                <button
                  key={quotation.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cn(
                    "w-full rounded-lg border bg-background p-3 text-left transition hover:bg-soft-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    selected ? "border-primary/50 ring-2 ring-primary/20" : "border-border"
                  )}
                  onClick={() => setSelectedQuotationId(quotation.id)}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {quotation.quotationNumber ?? "No quote number"} · {quotation.customerName}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {itemCountLabel(quotation.itemCount)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block whitespace-nowrap text-sm font-semibold">{quotation.totalAmount}</span>
                      <span
                        className={cn(
                          "mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          selected
                            ? "border-primary/30 bg-primary/15 text-foreground"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        {selected ? "Selected" : "Select"}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <aside className="h-fit rounded-lg border border-border bg-background p-4">
            <p className="studio-kicker">Confirm</p>
            <h3 className="mt-1 text-base font-semibold">Quotation summary</h3>
            {selectedQuotation ? (
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Quotation</span>
                  <span className="text-right font-medium">
                    {selectedQuotation.quotationNumber ?? "No quote number"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="text-right font-medium">{selectedQuotation.customerName}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Items</span>
                  <span className="font-medium">{itemCountLabel(selectedQuotation.itemCount)}</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-3">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold">{selectedQuotation.totalAmount}</span>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-md bg-panel px-3 py-2 text-sm text-muted-foreground">
                Select an approved quotation to review before creating the order.
              </p>
            )}
          </aside>
        </div>
      ) : null}

      {approvedQuotations.length === 0 ? (
        <div className="studio-empty px-4 py-4 text-sm">
          No approved quotations ready. Approve a quotation before converting it into an order.
        </div>
      ) : null}

      {convertState.message ? (
        <div
          className={cn(
            "rounded-md px-3 py-2 text-sm",
            convertState.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          )}
        >
          <p>{convertState.message}</p>
          {convertState.ok ? (
            <p className="mt-1 text-muted-foreground">
              The order will appear in the queue. Record payment or schedule delivery when the next action is ready.
            </p>
          ) : null}
        </div>
      ) : null}

      <Button disabled={convertPending || !selectedQuotationId}>
        <CalendarClock className="h-4 w-4" />
        Create order from quotation
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
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [step, setStep] = useState<ManualOrderStep>("customer");
  const [orderDiscountType, setOrderDiscountType] = useState<"" | "FIXED_AMOUNT" | "PERCENTAGE">(
    ""
  );
  const [orderDiscountValue, setOrderDiscountValue] = useState(0);
  const [needsAssembly, setNeedsAssembly] = useState(false);
  const [salesInvoiceRequested, setSalesInvoiceRequested] = useState(false);
  const [paymentDueTiming, setPaymentDueTiming] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [modeOfDelivery, setModeOfDelivery] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

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

    const catalogItem: ItemDraft = {
      productId: product.id,
      itemType: "CATALOG_PRODUCT",
      sortOrder: 0,
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
    };

    setItems((current) => [...current, { ...catalogItem, sortOrder: current.length }]);
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
    { key: "items", label: "Items & pricing" },
    { key: "plan", label: "Payment & delivery plan" },
    { key: "review", label: "Review" }
  ];
  const currentStepIndex = manualSteps.findIndex((candidate) => candidate.key === step);
  const hasSelectedCustomer = Boolean(customerId);
  const validItems = items.filter((item) => item.itemName.trim() && item.quantity > 0 && item.unitPrice >= 0);
  const filledItems = items.filter((item) => item.itemName.trim());
  const invalidItemCount = items.filter(
    (item) => !item.itemName.trim() || item.quantity <= 0 || item.unitPrice < 0
  ).length;
  const hasValidItem = validItems.length > 0;
  const allItemsValid = items.length > 0 && invalidItemCount === 0;
  const hasPlanDetails = [
    needsAssembly,
    salesInvoiceRequested,
    paymentDueTiming,
    paymentDueDate,
    modeOfDelivery,
    deliveryMethod,
    paymentTerms,
    specialInstructions,
    customerNotes,
    internalNotes
  ].some(Boolean);
  const canSave = hasSelectedCustomer && allItemsValid;
  const nextRequired =
    !hasSelectedCustomer
      ? "Next required: choose customer."
      : !hasValidItem
        ? "Next required: add at least one valid item."
        : invalidItemCount > 0
          ? "Next required: finish or remove incomplete item lines."
          : "Ready to review and create.";

  function moveStep(offset: number) {
    const next = manualSteps[Math.min(Math.max(currentStepIndex + offset, 0), manualSteps.length - 1)];
    setStep(next.key);
  }

  function canOpenStep(candidate: ManualOrderStep) {
    if (candidate === "customer") {
      return true;
    }

    if (candidate === "items") {
      return hasSelectedCustomer;
    }

    if (candidate === "plan") {
      return hasSelectedCustomer && allItemsValid;
    }

    return canSave;
  }

  function nextDisabled() {
    if (step === "customer") {
      return !hasSelectedCustomer;
    }

    if (step === "items") {
      return !allItemsValid;
    }

    return false;
  }

  return (
    <form action={manualAction} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <input type="hidden" name="items" value={JSON.stringify(toActionItems(items))} />

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap gap-2">
          {manualSteps.map((candidate, index) => (
            <button
              key={candidate.key}
              type="button"
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition",
                step === candidate.key
                  ? "border-primary/30 bg-primary/15 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-soft-accent/50",
                !canOpenStep(candidate.key) && "cursor-not-allowed opacity-50 hover:bg-background"
              )}
              onClick={() => {
                if (canOpenStep(candidate.key)) {
                  setStep(candidate.key);
                }
              }}
              disabled={!canOpenStep(candidate.key)}
            >
              {index + 1}. {candidate.label}
            </button>
          ))}
        </div>

        <section className={cn("space-y-4", step !== "customer" && "hidden")}>
          <div>
            <p className="studio-kicker">Step 1</p>
            <h3 className="mt-1 text-base font-semibold">Customer</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with the buyer so the order can inherit the current contact and address snapshot.
            </p>
          </div>
          <div className="grid gap-3">
            {customers.length > 0 ? (
              <label className="max-w-xl space-y-2 text-sm font-medium">
                Customer
                <Select
                  name="customerId"
                  required
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                >
                  <option value="" disabled>
                    Choose customer
                  </option>
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
          </div>
        </section>

        <section className={cn("space-y-4", step !== "items" && "hidden")}>
          <div>
            <p className="studio-kicker">Step 2</p>
            <h3 className="mt-1 text-base font-semibold">Items & pricing</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add catalog items or custom lines, then confirm quantity, price, and discount.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
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
            </div>

            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={addCustomItem}>
                <Plus className="h-4 w-4" />
                Add custom item
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="rounded-lg border border-border bg-background p-3">
                <div className="grid gap-3">
                  <label className="space-y-2 text-sm font-medium">
                    Item name
                    <Input
                      value={item.itemName}
                      onChange={(event) => updateItem(index, { itemName: event.target.value })}
                      placeholder="Item name"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-[80px_minmax(0,1fr)]">
                    <label className="space-y-2 text-sm font-medium">
                      Qty
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
                        aria-label="Quantity"
                        placeholder="Qty"
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
                        placeholder="Unit price"
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
                    <div className="space-y-2 text-sm font-medium">
                      Discount
                      <div className="grid gap-2 sm:grid-cols-[1fr_76px]">
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
              No item lines yet. Add a catalog item or custom item to continue.
            </div>
          ) : null}

          {canViewPayments ? (
            <details className="rounded-lg border border-border bg-background p-3">
              <summary className="cursor-pointer text-sm font-semibold">Advanced cost/profit</summary>
              <div className="mt-3 space-y-3">
                {items.map((item, index) => (
                  <div
                    key={`${index}-${item.itemName}`}
                    className="grid gap-3 text-sm"
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

        <section className={cn("space-y-4", step !== "plan" && "hidden")}>
          <div>
            <p className="studio-kicker">Step 3</p>
            <h3 className="mt-1 text-base font-semibold">Payment & delivery plan</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              These fields guide the next counter action. They do not create payment or delivery records yet.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium">
              <input
                type="checkbox"
                name="needsAssembly"
                value="true"
                checked={needsAssembly}
                onChange={(event) => setNeedsAssembly(event.target.checked)}
              />
              Needs assembly
            </label>
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium">
              <input
                type="checkbox"
                name="salesInvoiceRequested"
                value="true"
                checked={salesInvoiceRequested}
                onChange={(event) => setSalesInvoiceRequested(event.target.checked)}
              />
              Sales invoice requested
            </label>
            <label className="space-y-2 text-sm font-medium">
              Payment due timing
              <Select
                name="paymentDueTiming"
                value={paymentDueTiming}
                onChange={(event) => setPaymentDueTiming(event.target.value)}
              >
                <option value="">No timing set</option>
                <option value="BEFORE_DELIVERY">Before delivery</option>
                <option value="UPON_DELIVERY">Upon delivery</option>
                <option value="AFTER_DELIVERY">After delivery</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Payment due date
              <Input
                name="paymentDueDate"
                type="date"
                value={paymentDueDate}
                onChange={(event) => setPaymentDueDate(event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Mode of delivery
              <Input
                name="modeOfDelivery"
                placeholder="Pickup, delivery, company-arranged"
                value={modeOfDelivery}
                onChange={(event) => setModeOfDelivery(event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Delivery method
              <Input
                name="deliveryMethod"
                placeholder="In-house, third-party, customer pickup"
                value={deliveryMethod}
                onChange={(event) => setDeliveryMethod(event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Payment terms
              <Textarea
                name="paymentTerms"
                placeholder="Downpayment, balance timing, company terms"
                value={paymentTerms}
                onChange={(event) => setPaymentTerms(event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Remarks / special instructions
              <Textarea
                name="specialInstructions"
                placeholder="Assembly, access, timing, or client reminders"
                value={specialInstructions}
                onChange={(event) => setSpecialInstructions(event.target.value)}
              />
            </label>
            <Textarea
              name="customerNotes"
              placeholder="Customer-facing order notes"
              value={customerNotes}
              onChange={(event) => setCustomerNotes(event.target.value)}
            />
            <Textarea
              name="internalNotes"
              placeholder="Internal notes"
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
            />
          </div>
        </section>

        <section className={cn("space-y-4", step !== "review" && "hidden")}>
          <div>
            <p className="studio-kicker">Step 4</p>
            <h3 className="mt-1 text-base font-semibold">Review</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirm the customer, item pricing, and plan before creating the order.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-background p-3">
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="mt-1 font-semibold">{selectedCustomer?.displayName ?? "No customer selected"}</p>
            </div>
            <div className="rounded-lg bg-background p-3">
              <p className="text-sm text-muted-foreground">Items</p>
              <p className="mt-1 font-semibold">{itemCountLabel(items.length)}</p>
            </div>
            <div className="rounded-lg bg-background p-3">
              <p className="text-sm text-muted-foreground">Order total</p>
              <p className="mt-1 font-semibold">{money(totals.totalAmount)}</p>
            </div>
          </div>
          <div className="divide-y divide-border rounded-lg border border-border bg-background">
            {items.map((item, index) => (
              <div key={index} className="grid gap-3 px-3 py-3 text-sm md:grid-cols-[minmax(0,1fr)_90px_120px_120px]">
                <div>
                  <p className="font-medium">{item.itemName || `Item ${index + 1}`}</p>
                  <p className="text-muted-foreground">
                    {item.itemType === "CATALOG_PRODUCT" ? item.snapshotProductCode ?? "Catalog item" : "Custom item"}
                  </p>
                </div>
                <p className="font-medium md:text-right">Qty {item.quantity}</p>
                <p className="font-medium md:text-right">{money(item.unitPrice)}</p>
                <p className="font-semibold md:text-right">{money(itemLineTotal(item))}</p>
                {item.discountType ? (
                  <p className="text-xs text-muted-foreground md:col-span-4">
                    Discount: {item.discountType === "PERCENTAGE" ? `${item.discountValue}%` : money(item.discountValue)}
                    {" = "}
                    {money(itemDiscountAmount(item))}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3 text-sm">
              <p className="font-semibold">Payment plan</p>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Due timing</span>
                  <span className="text-right font-medium">
                    {paymentDueTiming ? paymentDueTimingLabel(paymentDueTiming) : "Not set"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Due date</span>
                  <span className="font-medium">{paymentDueDate || "Not set"}</span>
                </div>
                <p className="border-t border-border pt-2 text-muted-foreground">
                  {paymentTerms || "No payment terms entered."}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-3 text-sm">
              <p className="font-semibold">Delivery, assembly, invoice</p>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Assembly</span>
                  <span className="font-medium">{needsAssembly ? "Needed" : "Not marked"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Sales invoice</span>
                  <span className="font-medium">{salesInvoiceRequested ? "Requested" : "Not requested"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Mode</span>
                  <span className="text-right font-medium">{modeOfDelivery || "Not set"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Method</span>
                  <span className="text-right font-medium">{deliveryMethod || "Not set"}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background p-3 text-sm">
            <p className="font-semibold">Notes</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Special instructions</p>
                <p className="mt-1">{specialInstructions || "Not set"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Customer notes</p>
                <p className="mt-1">{customerNotes || "Not set"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Internal notes</p>
                <p className="mt-1">{internalNotes || "Not set"}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside className="h-fit rounded-lg border border-border bg-background p-4">
        <p className="studio-kicker">Ready check</p>
        <h3 className="mt-1 text-base font-semibold">Order summary</h3>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Customer</span>
            <span className="font-medium">{hasSelectedCustomer ? "Selected" : "Not selected"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Item lines</span>
            <span className="font-medium">{filledItems.length}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Pricing</span>
            <span className="font-medium">{allItemsValid ? "Ready" : "Needs valid item pricing"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Payment & delivery plan</span>
            <span className="font-medium">{hasPlanDetails ? "Added" : "Optional"}</span>
          </div>
          <p className="rounded-md bg-panel px-3 py-2 text-xs text-muted-foreground">{nextRequired}</p>

          <div className="border-t border-border pt-3">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{money(totals.subtotalAmount)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <span className="text-muted-foreground">Item discounts</span>
              <span className="font-medium">{money(totals.itemDiscountTotal)}</span>
            </div>
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
            <div
              className={cn(
                "rounded-md px-3 py-2 text-sm",
                manualState.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
              )}
            >
              <p>{manualState.message}</p>
              {manualState.ok ? (
                <p className="mt-1 text-muted-foreground">
                  The order is now in the queue. Record payment or schedule delivery from the order card next.
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex gap-2 pt-1">
            {currentStepIndex > 0 ? (
              <Button type="button" variant="secondary" onClick={() => moveStep(-1)} className="flex-1">
                Back
              </Button>
            ) : null}
            {step !== "review" ? (
              <Button
                type="button"
                onClick={() => moveStep(1)}
                disabled={nextDisabled()}
                className="flex-1"
              >
                Next
              </Button>
            ) : (
              <Button disabled={manualPending || !canSave} className="flex-1">
                <Save className="h-4 w-4" />
                Create order
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
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<OrderDetailTab>("overview");
  const [activeActionPanel, setActiveActionPanel] = useState<{
    orderId: string;
    action: OpenOrderAction;
  } | null>(null);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null;
  const actionOrder = activeActionPanel
    ? orders.find((order) => order.id === activeActionPanel.orderId) ?? null
    : null;

  function openDetails(orderId: string, tab: OrderDetailTab = "overview") {
    setSelectedOrderId(orderId);
    setActiveDetailTab(tab);
  }

  function openAction(orderId: string, action: OpenOrderAction, tab?: OrderDetailTab) {
    if (tab) {
      setSelectedOrderId(orderId);
      setActiveDetailTab(tab);
    }

    setActiveActionPanel({ orderId, action });
  }

  return (
    <>
      <section className="studio-card">
        <div className="studio-card-header flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="studio-kicker">Work Queue</p>
            <h2 className="text-sm font-semibold">Orders</h2>
          </div>
          <p className="text-sm text-muted-foreground">{orders.length} shown</p>
        </div>
        <div className="divide-y divide-border">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              canViewPayments={canViewPayments}
              canCreatePayments={canCreatePayments}
              canViewDeliveries={canViewDeliveries}
              canCreateDeliveries={canCreateDeliveries}
              canExportDocuments={canExportDocuments}
              isDetailsOpen={selectedOrderId === order.id}
              onDetails={() => openDetails(order.id)}
              onHideDetails={() => setSelectedOrderId(null)}
              onRecordPayment={() => openAction(order.id, "payment", "payments")}
              onScheduleDelivery={() => openAction(order.id, "delivery", "deliveries")}
            />
          ))}
          {orders.length === 0 ? (
            <div className="px-5 py-8 text-sm text-muted-foreground">
              No orders match the current queue filters.
            </div>
          ) : null}
        </div>
      </section>

      {selectedOrder ? (
        <OrderDetailPanel
          order={selectedOrder}
          activeTab={activeDetailTab}
          canUpdateOrders={canUpdateOrders}
          canViewPayments={canViewPayments}
          canCreatePayments={canCreatePayments}
          canViewDeliveries={canViewDeliveries}
          canCreateDeliveries={canCreateDeliveries}
          canUpdateDeliveries={canUpdateDeliveries}
          canExportDocuments={canExportDocuments}
          actionLabel={nextOrderAction(selectedOrder, canViewPayments, canViewDeliveries)}
          onClose={() => setSelectedOrderId(null)}
          onTabChange={setActiveDetailTab}
          onOpenAction={(action, tab) => openAction(selectedOrder.id, action, tab)}
        />
      ) : null}

      {activeActionPanel && actionOrder ? (
        <OrderActionPanel
          order={actionOrder}
          action={activeActionPanel.action}
          canUpdateOrders={canUpdateOrders}
          canViewPayments={canViewPayments}
          canCreatePayments={canCreatePayments}
          canViewDeliveries={canViewDeliveries}
          canCreateDeliveries={canCreateDeliveries}
          canUpdateDeliveries={canUpdateDeliveries}
          onClose={() => setActiveActionPanel(null)}
        />
      ) : null}
    </>
  );
}

function OrderCard({
  order,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  canExportDocuments,
  isDetailsOpen,
  onDetails,
  onHideDetails,
  onRecordPayment,
  onScheduleDelivery
}: {
  order: OrderRow;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  canExportDocuments: boolean;
  isDetailsOpen: boolean;
  onDetails: () => void;
  onHideDetails: () => void;
  onRecordPayment: () => void;
  onScheduleDelivery: () => void;
}) {
  const showPaymentAction = canViewPayments && canCreatePayments && !isTerminalOrder(order) && hasBalanceDue(order);
  const showDeliveryAction = canScheduleDelivery(order, canViewDeliveries, canCreateDeliveries);
  const workflowStage = workflowStageLabel(order, canViewPayments, canViewDeliveries);
  const primaryAction = getPrimaryOrderAction({
    order,
    canViewPayments,
    canCreatePayments,
    canViewDeliveries,
    canCreateDeliveries,
    isDetailsOpen,
    onDetails,
    onHideDetails,
    onRecordPayment,
    onScheduleDelivery
  });

  return (
    <article className="bg-panel px-4 py-3 transition hover:bg-muted/25">
      <div
        className={cn(
          "grid gap-3 text-sm md:grid-cols-2 lg:items-center",
          canViewPayments && canViewDeliveries
            ? "lg:grid-cols-[minmax(220px,1.6fr)_minmax(135px,.75fr)_minmax(150px,.85fr)_minmax(130px,.7fr)_minmax(170px,190px)]"
            : canViewPayments || canViewDeliveries
              ? "lg:grid-cols-[minmax(220px,1.6fr)_minmax(145px,.8fr)_minmax(130px,.7fr)_minmax(170px,190px)]"
              : "lg:grid-cols-[minmax(220px,1fr)_minmax(130px,160px)_minmax(170px,190px)]"
        )}
      >
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">
            {order.displayId} · {order.customerName}
          </h2>
          <p className="mt-1 truncate text-xs text-muted-foreground">{orderMetaLine(order)}</p>
        </div>

        {canViewPayments ? (
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment</p>
            <p className="mt-1 truncate font-semibold tabular-nums">{paymentSummaryLabel(order)}</p>
            <div className="mt-1 [&_span]:px-2 [&_span]:py-0.5">
              <StatusPill tone={statusTone(order.paymentStatus)}>
                {paymentStatusLabel(order.paymentStatus)}
              </StatusPill>
            </div>
          </div>
        ) : null}

        {canViewDeliveries ? (
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Delivery</p>
            <p className="mt-1 truncate font-semibold">{deliverySummaryLabel(order)}</p>
            <div className="mt-1 [&_span]:px-2 [&_span]:py-0.5">
              <StatusPill tone={statusTone(order.deliveryStatus)}>
                {deliveryStatusLabel(order.deliveryStatus)}
              </StatusPill>
            </div>
          </div>
        ) : null}

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stage</p>
          <div className="mt-1.5 [&_span]:px-2 [&_span]:py-0.5">
            <StatusPill tone={workflowStageTone(workflowStage)}>{workflowStage}</StatusPill>
          </div>
        </div>

        <div className="min-w-0 md:col-span-2 lg:col-span-1 lg:text-right">
          <p className="truncate whitespace-nowrap text-[11px] font-medium text-muted-foreground">
            Next: {primaryAction.nextLabel}
          </p>
          <div className="mt-2 flex items-center gap-1.5 lg:justify-end">
            <Button
              type="button"
              className="h-8 w-32 shrink-0 justify-center whitespace-nowrap px-3 text-xs"
              onClick={primaryAction.onClick}
            >
              {primaryAction.kind === "recordPayment" ? <ReceiptText className="h-3.5 w-3.5" /> : null}
              {primaryAction.kind === "scheduleDelivery" ? <Truck className="h-3.5 w-3.5" /> : null}
              {primaryAction.label}
            </Button>
            <OrderCardMoreActions
              order={order}
              primaryActionKind={primaryAction.kind}
              canExportDocuments={canExportDocuments}
              isDetailsOpen={isDetailsOpen}
              showPaymentAction={showPaymentAction}
              showDeliveryAction={showDeliveryAction}
              onDetails={onDetails}
              onHideDetails={onHideDetails}
              onRecordPayment={onRecordPayment}
              onScheduleDelivery={onScheduleDelivery}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function OrderCardMoreActions({
  order,
  primaryActionKind,
  canExportDocuments,
  isDetailsOpen,
  showPaymentAction,
  showDeliveryAction,
  onDetails,
  onHideDetails,
  onRecordPayment,
  onScheduleDelivery
}: {
  order: OrderRow;
  primaryActionKind: OrderCardPrimaryActionKind;
  canExportDocuments: boolean;
  isDetailsOpen: boolean;
  showPaymentAction: boolean;
  showDeliveryAction: boolean;
  onDetails: () => void;
  onHideDetails: () => void;
  onRecordPayment: () => void;
  onScheduleDelivery: () => void;
}) {
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
    placement: "above" | "below";
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isOpen = menuPosition !== null;
  const showDetailsAction = primaryActionKind !== "details";
  const showPaymentMenuAction = showPaymentAction && primaryActionKind !== "recordPayment";
  const showDeliveryMenuAction = showDeliveryAction && primaryActionKind !== "scheduleDelivery";
  const canShowMenu = showDetailsAction || showPaymentMenuAction || showDeliveryMenuAction || canExportDocuments;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setMenuPosition(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuPosition(null);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function closeMenu() {
    setMenuPosition(null);
  }

  function toggleMenu() {
    if (isOpen) {
      closeMenu();
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const menuWidth = 224;
    const estimatedHeight = 224;
    const hasRoomBelow = rect.bottom + estimatedHeight + 12 < window.innerHeight;
    setMenuPosition({
      left: Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rect.right - menuWidth)),
      top: hasRoomBelow ? rect.bottom + 8 : rect.top - 8,
      placement: hasRoomBelow ? "below" : "above"
    });
  }

  if (!canShowMenu) {
    return null;
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Order actions"
        onClick={toggleMenu}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
        <span className="sr-only">Order actions</span>
      </button>
      {isOpen ? (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[80] grid min-w-56 gap-1 rounded-lg border border-border bg-panel p-2 shadow-xl"
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            transform: menuPosition.placement === "above" ? "translateY(-100%)" : undefined
          }}
        >
          {showDetailsAction && isDetailsOpen ? (
            <Button
              type="button"
              variant="ghost"
              role="menuitem"
              className="min-h-9 justify-start rounded-md px-3"
              onClick={() => {
                closeMenu();
                onHideDetails();
              }}
            >
              Hide
            </Button>
          ) : null}
          {showDetailsAction && !isDetailsOpen ? (
            <Button
              type="button"
              variant="ghost"
              role="menuitem"
              className="min-h-9 justify-start rounded-md px-3"
              onClick={() => {
                closeMenu();
                onDetails();
              }}
            >
              Details
            </Button>
          ) : null}
          {showPaymentMenuAction ? (
            <Button
              type="button"
              variant="ghost"
              role="menuitem"
              className="min-h-9 justify-start rounded-md px-3"
              onClick={() => {
                closeMenu();
                onRecordPayment();
              }}
            >
              <ReceiptText className="h-4 w-4" />
              Record payment
            </Button>
          ) : null}
          {showDeliveryMenuAction ? (
            <Button
              type="button"
              variant="ghost"
              role="menuitem"
              className="min-h-9 justify-start rounded-md px-3"
              onClick={() => {
                closeMenu();
                onScheduleDelivery();
              }}
            >
              <Truck className="h-4 w-4" />
              Schedule
            </Button>
          ) : null}
          {canExportDocuments ? (
            <>
              <a
                href={`/api/documents/invoice/${order.id}`}
                role="menuitem"
                className="inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-soft-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                onClick={closeMenu}
              >
                <Download className="h-4 w-4" />
                Invoice PDF
              </a>
              <a
                href={`/api/documents/final-order-summary/${order.id}`}
                role="menuitem"
                className="inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-soft-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                onClick={closeMenu}
              >
                <Download className="h-4 w-4" />
                Final summary PDF
              </a>
            </>
          ) : null}
          {/* Add Edit order here once a real edit route/server action exists, gated by canUpdateOrders. */}
        </div>
      ) : null}
    </>
  );
}

function OrderDetailPanel({
  order,
  activeTab,
  canUpdateOrders,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  canUpdateDeliveries,
  canExportDocuments,
  actionLabel,
  onClose,
  onTabChange,
  onOpenAction
}: {
  order: OrderRow;
  activeTab: OrderDetailTab;
  canUpdateOrders: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  canUpdateDeliveries: boolean;
  canExportDocuments: boolean;
  actionLabel: string;
  onClose: () => void;
  onTabChange: (tab: OrderDetailTab) => void;
  onOpenAction: (actionKey: OpenOrderAction, tab?: OrderDetailTab) => void;
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
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close order details"
        className="absolute inset-0 bg-foreground/25"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
        className="relative ml-auto flex h-full w-full max-w-5xl flex-col overflow-hidden border-l border-border bg-panel shadow-xl"
      >
        <header className="border-b border-border px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="studio-kicker">Order Details</p>
              <h2 id="order-detail-title" className="mt-1 truncate text-xl font-semibold">
                {order.displayId} · {order.customerName}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusPill tone={statusTone(order.status)}>{orderStatusLabel(order.status)}</StatusPill>
                {canViewPayments ? (
                  <StatusPill tone={statusTone(order.paymentStatus)}>
                    {paymentStatusLabel(order.paymentStatus)}
                  </StatusPill>
                ) : null}
                {canViewDeliveries ? (
                  <StatusPill tone={statusTone(order.deliveryStatus)}>
                    {deliveryStatusLabel(order.deliveryStatus)}
                  </StatusPill>
                ) : null}
              </div>
            </div>
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>

          <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Next action</p>
              <p className="mt-1 font-semibold">{actionLabel}</p>
            </div>
            {canViewPayments ? (
              <div>
                <p className="text-muted-foreground">Balance</p>
                <p className="mt-1 font-semibold">{order.balanceAmount}</p>
              </div>
            ) : null}
            {canViewDeliveries ? (
              <div>
                <p className="text-muted-foreground">Next delivery</p>
                <p className="mt-1 font-semibold">{order.nextDeliveryDate ?? "None scheduled"}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {canViewPayments && canCreatePayments && order.balanceAmountValue > 0 ? (
              <Button type="button" onClick={() => onOpenAction("payment", "payments")}>
                <ReceiptText className="h-4 w-4" />
                Record payment
              </Button>
            ) : null}
            {canScheduleDelivery(order, canViewDeliveries, canCreateDeliveries) ? (
              <Button type="button" variant="secondary" onClick={() => onOpenAction("delivery", "deliveries")}>
                <Truck className="h-4 w-4" />
                Schedule delivery
              </Button>
            ) : null}
            {canExportDocuments ? (
              <>
                <a href={`/api/documents/invoice/${order.id}`} className={pdfLinkClass}>
                  <Download className="h-4 w-4" />
                  Invoice PDF
                </a>
                <a href={`/api/documents/final-order-summary/${order.id}`} className={pdfLinkClass}>
                  <Download className="h-4 w-4" />
                  Final summary PDF
                </a>
              </>
            ) : null}
          </div>
        </header>

        <div className="border-b border-border px-4 py-3 sm:px-5">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold transition",
                  activeTab === tab.key
                    ? "border-primary/30 bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-soft-accent/50"
                )}
                onClick={() => onTabChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
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
              canUpdateOrders={canUpdateOrders}
              canViewPayments={canViewPayments}
              canCreatePayments={canCreatePayments}
              canExportDocuments={canExportDocuments}
              onOpenAction={onOpenAction}
            />
          ) : null}
          {activeTab === "deliveries" ? (
            <DeliverySection
              order={order}
              canViewDeliveries={canViewDeliveries}
              canCreateDeliveries={canCreateDeliveries}
              canUpdateDeliveries={canUpdateDeliveries}
              canExportDocuments={canExportDocuments}
              onOpenAction={onOpenAction}
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
      </aside>
    </div>
  );
}

function OrderActionPanel({
  order,
  action,
  canUpdateOrders,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  canUpdateDeliveries,
  onClose
}: {
  order: OrderRow;
  action: OpenOrderAction;
  canUpdateOrders: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  canUpdateDeliveries: boolean;
  onClose: () => void;
}) {
  const deliveryProgressId = action.startsWith("deliveryProgress:")
    ? action.replace("deliveryProgress:", "")
    : null;
  const delivery = deliveryProgressId
    ? order.deliveries.find((candidate) => candidate.id === deliveryProgressId)
    : null;
  const title =
    action === "payment"
      ? "Record payment"
      : action === "paymentDue"
        ? "Set payment due timing"
        : action === "delivery"
          ? "Schedule delivery"
          : "Update delivery progress";
  const summary =
    action === "payment"
      ? `${order.balanceAmount} balance`
      : action === "delivery"
        ? `${order.items.filter((item) => item.remainingQuantity > 0).length} item line(s) remaining`
        : order.displayId;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close action panel"
        className="absolute inset-0 bg-foreground/25"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-action-title"
        className="relative ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-border bg-panel shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="studio-kicker">{order.displayId}</p>
            <h2 id="order-action-title" className="mt-1 text-xl font-semibold">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.customerName} · {summary}
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {action === "payment" && canViewPayments && canCreatePayments ? (
            <PaymentForm order={order} />
          ) : null}
          {action === "paymentDue" && canUpdateOrders && canViewPayments ? (
            <PaymentDueTimingForm order={order} />
          ) : null}
          {action === "delivery" && canViewDeliveries && canCreateDeliveries ? (
            <DeliveryForm order={order} />
          ) : null}
          {delivery && canViewDeliveries && canUpdateDeliveries ? (
            <DeliveryProgressForm delivery={delivery} />
          ) : null}
          {action === "payment" && (!canViewPayments || !canCreatePayments) ? (
            <RestrictedPanel title="payment actions" />
          ) : null}
          {action === "delivery" && (!canViewDeliveries || !canCreateDeliveries) ? (
            <RestrictedPanel title="delivery actions" />
          ) : null}
          {action.startsWith("deliveryProgress:") && (!delivery || !canViewDeliveries || !canUpdateDeliveries) ? (
            <RestrictedPanel title="delivery progress" />
          ) : null}
        </div>
      </aside>
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
  canUpdateOrders,
  canViewPayments,
  canCreatePayments,
  canExportDocuments,
  onOpenAction
}: {
  order: OrderRow;
  canUpdateOrders: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canExportDocuments: boolean;
  onOpenAction: (actionKey: OpenOrderAction, tab?: OrderDetailTab) => void;
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
              variant="secondary"
              onClick={() => onOpenAction("payment", "payments")}
            >
              <ReceiptText className="h-4 w-4" />
              Record payment
            </Button>
          ) : null}
          {canUpdateOrders && order.balanceAmountValue > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenAction("paymentDue", "payments")}
            >
              <CalendarClock className="h-4 w-4" />
              Set due timing
            </Button>
          ) : null}
        </div>
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
  canViewDeliveries,
  canCreateDeliveries,
  canUpdateDeliveries,
  canExportDocuments,
  onOpenAction
}: {
  order: OrderRow;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  canUpdateDeliveries: boolean;
  canExportDocuments: boolean;
  onOpenAction: (actionKey: OpenOrderAction, tab?: OrderDetailTab) => void;
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
            variant="secondary"
            onClick={() => onOpenAction("delivery", "deliveries")}
          >
            <Truck className="h-4 w-4" />
            Schedule delivery
          </Button>
        </div>
      ) : null}

      {order.deliveries.length > 0 ? (
        <div className="divide-y divide-border rounded-lg border border-border bg-panel text-sm">
          {order.deliveries.map((delivery) => (
            <div key={delivery.id} className="p-3">
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
                    variant="secondary"
                    className="min-h-9 px-3 text-xs"
                    onClick={() => onOpenAction(`deliveryProgress:${delivery.id}`, "deliveries")}
                  >
                    <Save className="h-4 w-4" />
                    Update progress
                  </Button>
                ) : null}
              </div>
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
