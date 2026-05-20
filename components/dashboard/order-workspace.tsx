"use client";

import { useActionState, useMemo, useState } from "react";
import type { DeliveryStatus } from "@prisma/client";
import {
  CalendarClock,
  Download,
  PackageSearch,
  Plus,
  ReceiptText,
  Save,
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
import { QuickCustomerForm } from "@/components/dashboard/quick-customer-form";
import {
  deliveryStatusLabel,
  orderStatusLabel,
  paymentDueTimingLabel,
  paymentStatusLabel,
  paymentTypeLabel,
  readableLabel,
  statusTone
} from "@/lib/orders/status-labels";
import { getAllowedNextStatuses } from "@/lib/status-transitions";

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
  canCreateCustomers: boolean;
  customers: CustomerOption[];
  staff: Array<{ id: string; displayName: string }>;
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

function isUnfinishedOrder(order: OrderRow) {
  return (
    !["COMPLETED", "CANCELLED"].includes(order.status) ||
    order.paymentStatus !== "PAID" ||
    !["DELIVERED", "CANCELLED"].includes(order.deliveryStatus)
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

function OperationsSummary({
  orders,
  canViewPayments,
  canViewDeliveries
}: {
  orders: OrderRow[];
  canViewPayments: boolean;
  canViewDeliveries: boolean;
}) {
  const unfinishedCount = orders.filter(isUnfinishedOrder).length;
  const withBalanceCount = orders.filter((order) => order.balanceAmountValue > 0).length;
  const forDeliveryCount = orders.filter((order) => !["DELIVERED", "CANCELLED"].includes(order.deliveryStatus)).length;
  const scheduledDeliveryCount = orders.filter((order) => order.nextDeliveryDate).length;

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <div className="rounded-lg border border-border bg-panel p-4">
        <p className="text-xs uppercase text-muted-foreground">Orders shown</p>
        <p className="mt-2 text-2xl font-semibold">{orders.length}</p>
      </div>
      <div className="rounded-lg border border-border bg-panel p-4">
        <p className="text-xs uppercase text-muted-foreground">Unfinished shown</p>
        <p className="mt-2 text-2xl font-semibold">{unfinishedCount}</p>
      </div>
      {canViewPayments ? (
        <div className="rounded-lg border border-border bg-panel p-4">
          <p className="text-xs uppercase text-muted-foreground">With balance</p>
          <p className="mt-2 text-2xl font-semibold">{withBalanceCount}</p>
        </div>
      ) : null}
      {canViewDeliveries ? (
        <>
          <div className="rounded-lg border border-border bg-panel p-4">
            <p className="text-xs uppercase text-muted-foreground">For delivery</p>
            <p className="mt-2 text-2xl font-semibold">{forDeliveryCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-panel p-4">
            <p className="text-xs uppercase text-muted-foreground">Scheduled delivery</p>
            <p className="mt-2 text-2xl font-semibold">{scheduledDeliveryCount}</p>
          </div>
        </>
      ) : null}
    </section>
  );
}

export function OrderWorkspace({
  canCreateOrders,
  canUpdateOrders,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  canUpdateDeliveries,
  canExportDocuments,
  canCreateCustomers,
  customers,
  staff,
  products,
  approvedQuotations,
  orders
}: OrderWorkspaceProps) {
  const [convertState, convertAction, convertPending] = useActionState(
    convertQuotationToOrderAction,
    initialState
  );
  const [manualState, manualAction, manualPending] = useActionState(
    createManualOrderAction,
    initialState
  );
  const [items, setItems] = useState<ItemDraft[]>([createCustomItem(0)]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [orderDiscountType, setOrderDiscountType] = useState<"" | "FIXED_AMOUNT" | "PERCENTAGE">(
    ""
  );
  const [orderDiscountValue, setOrderDiscountValue] = useState(0);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [showConvertQuotation, setShowConvertQuotation] = useState(false);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [showManualOrder, setShowManualOrder] = useState(false);

  const totals = useMemo(() => {
    const subtotalAmount = roundMoney(
      items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    );
    const totalCostAmount = roundMoney(
      items.reduce((sum, item) => sum + item.quantity * item.unitCostSnapshot, 0)
    );
    const orderDiscountAmount =
      orderDiscountType === "PERCENTAGE"
        ? roundMoney(subtotalAmount * (orderDiscountValue / 100))
        : orderDiscountType === "FIXED_AMOUNT"
          ? roundMoney(orderDiscountValue)
          : 0;

    const totalAmount = roundMoney(Math.max(subtotalAmount - orderDiscountAmount, 0));

    return {
      subtotalAmount,
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

  function addCustomItem() {
    setItems((current) => [...current, createCustomItem(current.length)]);
  }

  function toggleOrderDetails(orderId: string) {
    setExpandedOrders((current) => ({ ...current, [orderId]: !current[orderId] }));
  }

  const canShowCreationActions = canCreateOrders || canCreateCustomers;

  return (
    <div className="space-y-6">
      <OperationsSummary orders={orders} canViewPayments={canViewPayments} canViewDeliveries={canViewDeliveries} />

      {canShowCreationActions ? (
        <section className="flex flex-wrap gap-2">
          {canCreateOrders ? (
            <Button
              type="button"
              variant={showConvertQuotation ? "primary" : "secondary"}
              onClick={() => setShowConvertQuotation((current) => !current)}
            >
              <CalendarClock className="h-4 w-4" />
              Convert quotation
            </Button>
          ) : null}
          {canCreateCustomers ? (
            <Button
              type="button"
              variant={showQuickCustomer ? "primary" : "secondary"}
              onClick={() => setShowQuickCustomer((current) => !current)}
            >
              <Plus className="h-4 w-4" />
              Add customer
            </Button>
          ) : null}
          {canCreateOrders ? (
            <Button
              type="button"
              variant={showManualOrder ? "primary" : "secondary"}
              onClick={() => setShowManualOrder((current) => !current)}
            >
              <Save className="h-4 w-4" />
              Create manual order
            </Button>
          ) : null}
        </section>
      ) : null}

      {canCreateOrders && showConvertQuotation ? (
        <section className="studio-card">
          <div className="studio-card-header">
            <p className="studio-kicker">Order Intake</p>
            <h2 className="text-sm font-semibold">Convert approved quotation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Approved quotations become confirmed internal orders with copied snapshots.
            </p>
          </div>
          <form action={convertAction} className="grid gap-3 p-5 md:grid-cols-[1fr_auto]">
            <Select name="quotationId" required defaultValue="">
              <option value="" disabled>
                Choose approved quotation
              </option>
              {approvedQuotations.map((quotation) => (
                <option key={quotation.id} value={quotation.id}>
                  {quotation.customerName} - {quotation.totalAmount} - {quotation.itemCount} item(s)
                </option>
              ))}
            </Select>
            <Button disabled={convertPending || approvedQuotations.length === 0}>
              <CalendarClock className="h-4 w-4" />
              Convert
            </Button>
            {convertState.message ? (
              <p className={convertState.ok ? "text-sm text-success md:col-span-2" : "text-sm text-danger md:col-span-2"}>
                {convertState.message}
              </p>
            ) : null}
          </form>
        </section>
      ) : null}

      {canCreateCustomers && showQuickCustomer ? (
        <QuickCustomerForm
          staff={staff}
          title="Quick customer"
          description="Select an existing customer for a manual order or add a buyer record here."
        />
      ) : null}

      {canCreateOrders && showManualOrder ? (
        <form action={manualAction} className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <input type="hidden" name="items" value={JSON.stringify(toActionItems(items))} />
          <section className="studio-card">
            <div className="studio-card-header">
              <p className="studio-kicker">Manual Order</p>
              <h2 className="text-sm font-semibold">Manual order</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a direct order without quotation or inventory availability requirements.
              </p>
            </div>
            <div className="space-y-4 p-5">
            <label className="block space-y-2 text-sm font-medium">
              Customer
              <Select name="customerId" required defaultValue={customers[0]?.id ?? ""}>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.displayName}
                    {customer.companyName ? ` - ${customer.companyName}` : ""}
                  </option>
                ))}
              </Select>
            </label>

            <div className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-[1fr_auto_auto]">
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
                Add custom
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-5">
                  <label className="space-y-2 text-sm font-medium md:col-span-2">
                    Item
                    <Input
                      value={item.itemName}
                      onChange={(event) => updateItem(index, { itemName: event.target.value })}
                      placeholder="Item name"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Quantity
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
                  {canViewPayments ? (
                    <label className="space-y-2 text-sm font-medium">
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
                  ) : null}
                  <div className="space-y-2 text-sm font-medium">
                    <span>Line total</span>
                    <div className="rounded-md bg-background px-3 py-2 font-medium">
                      {money(item.quantity * item.unitPrice)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium">
                <input type="checkbox" name="needsAssembly" value="true" />
                Needs assembly
              </label>
              <label className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium">
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
          </div>
        </section>

        <aside className="studio-card">
          <div className="studio-card-header">
            <p className="studio-kicker">Order Summary</p>
            <h2 className="text-sm font-semibold">Order totals</h2>
          </div>
          <div className="space-y-3 p-5 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{money(totals.subtotalAmount)}</span>
            </div>
            <Select
              name="orderDiscountType"
              value={orderDiscountType}
              onChange={(event) => setOrderDiscountType(event.target.value as typeof orderDiscountType)}
            >
              <option value="">No discount</option>
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
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Discount</span>
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
              <p className={manualState.ok ? "text-sm text-success" : "text-sm text-danger"}>
                {manualState.message}
              </p>
            ) : null}
            <Button disabled={manualPending || customers.length === 0 || items.length === 0} className="w-full">
              <Save className="h-4 w-4" />
              Save manual order
            </Button>
          </div>
        </aside>
      </form>
      ) : null}

      <section className="space-y-4">
        {orders.map((order) => {
          const expanded = Boolean(expandedOrders[order.id]);
          const actionLabel = nextOrderAction(order, canViewPayments, canViewDeliveries, canExportDocuments);

          return (
            <article key={order.id} className="studio-card">
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">
                      {order.displayId} · {order.customerName}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {readableLabel(order.sourceType)} · Created {order.createdAt} · Updated {order.updatedAt}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {order.assignedStaff ? <span>Staff: {order.assignedStaff}</span> : null}
                      {order.companyName ? <span>Company: {order.companyName}</span> : null}
                      {order.contactPersonName ? <span>Contact: {order.contactPersonName}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <StatusPill tone={statusTone(order.status)}>{orderStatusLabel(order.status)}</StatusPill>
                    <StatusPill tone={statusTone(order.paymentStatus)}>{paymentStatusLabel(order.paymentStatus)}</StatusPill>
                    <StatusPill tone={statusTone(order.deliveryStatus)}>{deliveryStatusLabel(order.deliveryStatus)}</StatusPill>
                    <Button type="button" variant="secondary" onClick={() => toggleOrderDetails(order.id)}>
                      {expanded ? "Hide details" : "View details"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                  {canViewPayments ? (
                    <>
                      <div className="rounded-md bg-background p-3">
                        <p className="text-muted-foreground">Total</p>
                        <p className="mt-1 font-semibold">{order.totalAmount}</p>
                      </div>
                      <div className="rounded-md bg-background p-3">
                        <p className="text-muted-foreground">Paid</p>
                        <p className="mt-1 font-semibold">{order.paidAmount}</p>
                      </div>
                      <div className="rounded-md bg-background p-3">
                        <p className="text-muted-foreground">Balance</p>
                        <p className="mt-1 font-semibold">{order.balanceAmount}</p>
                      </div>
                    </>
                  ) : null}
                  {canViewDeliveries ? (
                    <div className="rounded-md bg-background p-3">
                      <p className="text-muted-foreground">Next delivery</p>
                      <p className="mt-1 font-semibold">{order.nextDeliveryDate ?? "None"}</p>
                      {order.nextDeliveryProvider ? (
                        <p className="mt-1 text-xs text-muted-foreground">{readableLabel(order.nextDeliveryProvider)}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {order.needsAssembly ? (
                    <span className="rounded-full bg-muted px-2.5 py-1 font-medium">Needs assembly</span>
                  ) : null}
                  {order.salesInvoiceRequested ? (
                    <span className="rounded-full bg-muted px-2.5 py-1 font-medium">Sales invoice requested</span>
                  ) : null}
                  <span className="rounded-full bg-soft-accent px-2.5 py-1 font-medium">
                    Next: {actionLabel}
                  </span>
                </div>
              </div>

              {expanded ? (
                <div className="grid gap-5 border-t border-border p-5 xl:grid-cols-[1fr_320px]">
                  <div className="space-y-5">
                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold">Items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 font-medium">Item</th>
                        <th className="py-2 font-medium">Qty</th>
                        {canViewDeliveries ? <th className="py-2 font-medium">Scheduled</th> : null}
                        {canViewDeliveries ? <th className="py-2 font-medium">Delivered</th> : null}
                        {canViewPayments ? <th className="py-2 font-medium">Unit</th> : null}
                        {canViewPayments ? <th className="py-2 font-medium">Cost</th> : null}
                        {canViewPayments ? <th className="py-2 font-medium">Discount</th> : null}
                        {canViewPayments ? <th className="py-2 font-medium">Profit</th> : null}
                        {canViewPayments ? <th className="py-2 font-medium">Line total</th> : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {order.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 font-medium">{item.itemName}</td>
                          <td className="py-2 text-muted-foreground">{item.quantity}</td>
                          {canViewDeliveries ? (
                            <td className="py-2 text-muted-foreground">{item.plannedQuantity}</td>
                          ) : null}
                          {canViewDeliveries ? (
                            <td className="py-2 text-muted-foreground">{item.deliveredQuantity}</td>
                          ) : null}
                          {canViewPayments ? <td className="py-2 text-muted-foreground">{item.unitPrice}</td> : null}
                          {canViewPayments ? <td className="py-2 text-muted-foreground">{item.unitCostSnapshot}</td> : null}
                          {canViewPayments ? <td className="py-2 text-muted-foreground">{item.discountAmount}</td> : null}
                          {canViewPayments ? <td className="py-2 text-muted-foreground">{item.lineProfit}</td> : null}
                          {canViewPayments ? <td className="py-2 font-medium">{item.lineTotal}</td> : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                    </section>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Payments</h3>
                  {canViewPayments ? (
                    <>
                      <div className="grid gap-2 text-sm md:grid-cols-4">
                        <div className="rounded-md bg-background p-3">
                          <p className="text-muted-foreground">Order total</p>
                          <p className="mt-1 font-semibold">{order.totalAmount}</p>
                        </div>
                        <div className="rounded-md bg-background p-3">
                          <p className="text-muted-foreground">Paid</p>
                          <p className="mt-1 font-semibold">{order.paidAmount}</p>
                        </div>
                        <div className="rounded-md bg-background p-3">
                          <p className="text-muted-foreground">Balance</p>
                          <p className="mt-1 font-semibold">{order.balanceAmount}</p>
                        </div>
                        <div className="rounded-md bg-background p-3">
                          <p className="text-muted-foreground">Gross profit</p>
                          <p className="mt-1 font-semibold">{order.grossProfitAmount}</p>
                        </div>
                        <div className="rounded-md bg-background p-3">
                          <p className="text-muted-foreground">Last payment</p>
                          <p className="mt-1 font-semibold">{order.lastPaymentDate ?? "None"}</p>
                        </div>
                      </div>
                      {canUpdateOrders ? <PaymentDueTimingForm order={order} /> : null}
                      {canCreatePayments ? <PaymentForm order={order} /> : null}
                      <div className="grid gap-2 text-sm md:grid-cols-2">
                        {order.payments.map((payment) => (
                          <div key={payment.id} className="rounded-md bg-background p-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium">{payment.amount}</span>
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
                              <a
                                href={`/api/documents/payment-receipt/${payment.id}`}
                                className={`${pdfLinkClass} mt-3`}
                              >
                                <Download className="h-4 w-4" />
                                Payment receipt PDF
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                      {order.payments.length === 0 ? <EmptyPanel message="No payment records yet." /> : null}
                    </>
                  ) : (
                    <RestrictedPanel title="payment data" />
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Deliveries</h3>
                  {canViewDeliveries ? (
                    <>
                      <div className="grid gap-2 text-sm md:grid-cols-3">
                        <div className="rounded-md bg-background p-3">
                          <p className="text-muted-foreground">Delivery status</p>
                          <p className="mt-1 font-semibold">{deliveryStatusLabel(order.deliveryStatus)}</p>
                        </div>
                        <div className="rounded-md bg-background p-3">
                          <p className="text-muted-foreground">Next scheduled</p>
                          <p className="mt-1 font-semibold">{order.nextDeliveryDate ?? "None"}</p>
                        </div>
                        <div className="rounded-md bg-background p-3">
                          <p className="text-muted-foreground">Provider</p>
                          <p className="mt-1 font-semibold">
                            {order.nextDeliveryProvider ? readableLabel(order.nextDeliveryProvider) : "None"}
                          </p>
                        </div>
                      </div>
                      {canCreateDeliveries ? <DeliveryForm order={order} /> : null}
                      <div className="grid gap-2 text-sm md:grid-cols-2">
                        {order.deliveries.map((delivery) => (
                          <div key={delivery.id} className="rounded-md bg-background p-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium">{delivery.deliveryNumber ?? "Not assigned"}</span>
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
                                {[delivery.recipientName, delivery.recipientPhone, delivery.addressLine]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            ) : null}
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
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
                            {canExportDocuments ? (
                              <a
                                href={`/api/documents/delivery-receipt/${delivery.id}`}
                                className={`${pdfLinkClass} mt-3`}
                              >
                                <Download className="h-4 w-4" />
                                Delivery receipt PDF
                              </a>
                            ) : null}
                            {canUpdateDeliveries ? <DeliveryProgressForm delivery={delivery} /> : null}
                          </div>
                        ))}
                      </div>
                      {order.deliveries.length === 0 ? <EmptyPanel message="No delivery records yet." /> : null}
                    </>
                  ) : (
                    <RestrictedPanel title="delivery data" />
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Documents</h3>
                  <DocumentLinks order={order} canExportDocuments={canExportDocuments} />
                </div>
              </div>

              <aside className="space-y-3 rounded-md bg-background p-4 text-sm">
                <h3 className="text-sm font-semibold">Notes / sales details</h3>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Customer snapshot</p>
                  <p className="mt-1 font-semibold">{order.customerName}</p>
                  {order.companyName ? <p className="text-muted-foreground">{order.companyName}</p> : null}
                  {order.contactSnapshot ? <p className="text-muted-foreground">{order.contactSnapshot}</p> : null}
                </div>
                {canViewDeliveries ? (
                  <div className="border-t border-border pt-3">
                    <p className="text-xs uppercase text-muted-foreground">Delivery address</p>
                    <p className="mt-1">{order.deliveryAddressSnapshot ?? "No delivery address snapshot"}</p>
                  </div>
                ) : null}
                <div className="grid gap-2 border-t border-border pt-3">
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
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Payment terms</p>
                    <p className="mt-1">{canViewPayments ? order.paymentTerms ?? "Not specified" : "Restricted"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Remarks / special instructions</p>
                    <p className="mt-1">{order.specialInstructions ?? "Not specified"}</p>
                  </div>
                </div>
                <div className="grid gap-2 border-t border-border pt-3">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Order</span>
                    <StatusPill tone={statusTone(order.status)}>{orderStatusLabel(order.status)}</StatusPill>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Payment</span>
                    <StatusPill tone={statusTone(order.paymentStatus)}>{paymentStatusLabel(order.paymentStatus)}</StatusPill>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Delivery</span>
                    <StatusPill tone={statusTone(order.deliveryStatus)}>{deliveryStatusLabel(order.deliveryStatus)}</StatusPill>
                  </div>
                </div>
                {canViewPayments ? (
                  <div className="grid gap-2 border-t border-border pt-3">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{order.subtotalAmount}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Order discount</span>
                      <span className="font-medium">{order.orderDiscountAmount}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-medium">{order.totalAmount}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Paid</span>
                      <span className="font-medium">{order.paidAmount}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-base">
                      <span className="font-semibold">Balance</span>
                      <span className="font-semibold">{order.balanceAmount}</span>
                    </div>
                    <p className="text-muted-foreground">
                      Due timing: {paymentDueTimingLabel(order.paymentDueTiming)}
                      {order.paymentDueDate ? ` · ${order.paymentDueDate}` : ""}
                    </p>
                    <p className="mt-1 text-muted-foreground">Last payment: {order.lastPaymentDate ?? "None"}</p>
                  </div>
                ) : null}
                {canViewDeliveries ? (
                  <div className="border-t border-border pt-3">
                    <p className="text-muted-foreground">Next delivery: {order.nextDeliveryDate ?? "None"}</p>
                    <p className="mt-1 text-muted-foreground">
                      Provider: {order.nextDeliveryProvider ? readableLabel(order.nextDeliveryProvider) : "None"}
                    </p>
                  </div>
                ) : null}
                {order.relatedQuotationId || order.relatedInquiryId ? (
                  <div className="border-t border-border pt-3">
                    {order.relatedQuotationId ? (
                      <p className="text-muted-foreground">
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
                {order.customerNotes || order.internalNotes ? (
                  <div className="space-y-2 border-t border-border pt-3">
                    {order.customerNotes ? (
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Customer notes</p>
                        <p className="mt-1">{order.customerNotes}</p>
                      </div>
                    ) : null}
                    {order.internalNotes ? (
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Internal notes</p>
                        <p className="mt-1">{order.internalNotes}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </aside>
            </div>
              ) : null}
            </article>
          );
        })}
        {orders.length === 0 ? (
          <div className="studio-empty px-5 py-8 text-sm">
            No orders yet. Convert an approved quotation or create a manual order.
          </div>
        ) : null}
      </section>
    </div>
  );
}
