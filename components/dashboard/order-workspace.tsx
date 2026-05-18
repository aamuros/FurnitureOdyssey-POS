"use client";

import { useActionState, useMemo, useState } from "react";
import {
  CalendarClock,
  Download,
  FilePlus2,
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
  createOrderDocumentAction,
  createPaymentAction,
  updatePaymentDueTimingAction
} from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import {
  deliveryStatusLabel,
  documentStatusLabel,
  documentTypeLabel,
  orderStatusLabel,
  paymentDueTimingLabel,
  paymentStatusLabel,
  paymentTypeLabel,
  readableLabel,
  statusTone
} from "@/lib/orders/status-labels";

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
  totalAmount: string;
  totalAmountValue: number;
  paidAmount: string;
  paidAmountValue: number;
  balanceAmount: string;
  balanceAmountValue: number;
  subtotalAmount: string;
  itemDiscountTotal: string;
  orderDiscountAmount: string;
  customerNotes: string | null;
  internalNotes: string | null;
  relatedQuotationId: string | null;
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
  canCreateDocuments: boolean;
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
  discountType: "" | "FIXED_AMOUNT" | "PERCENTAGE";
  discountValue: number;
  customerNotes: string;
  internalNotes: string;
  images: [];
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
    discountType: "",
    discountValue: 0,
    customerNotes: "",
    internalNotes: "",
    images: []
  };
}

function toActionItems(items: ItemDraft[]) {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index,
    discountType: item.discountType || undefined,
    discountValue: item.discountType ? item.discountValue : undefined,
    description: item.description || undefined,
    specifications: item.specifications || undefined,
    customerNotes: item.customerNotes || undefined,
    internalNotes: item.internalNotes || undefined,
    snapshotProductCode: item.snapshotProductCode || undefined
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
        <p className={state.ok ? "text-sm text-emerald-700 md:col-span-6" : "text-sm text-danger md:col-span-6"}>
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
        <p className={state.ok ? "text-sm text-emerald-700 md:col-span-4" : "text-sm text-danger md:col-span-4"}>
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
      <Select name="deliveryProviderType" defaultValue="" aria-label="Delivery provider type">
        <option value="">Provider type</option>
        <option value="IN_HOUSE">In-house</option>
        <option value="CUSTOMER_PICKUP">Customer pickup</option>
        <option value="THIRD_PARTY">Third-party</option>
        <option value="OTHER">Other</option>
      </Select>
      <Input name="deliveryProviderName" placeholder="Provider name" />
      <Input name="deliveryProviderReference" placeholder="Provider reference" />
      <Select name="status" defaultValue="SCHEDULED" aria-label="Delivery status">
        <option value="PLANNED">Planned</option>
        <option value="SCHEDULED">Scheduled</option>
        <option value="IN_TRANSIT">In transit</option>
        <option value="PARTIALLY_DELIVERED">Partially delivered</option>
        <option value="DELIVERED">Delivered</option>
      </Select>
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
        <p className={state.ok ? "text-sm text-emerald-700 md:col-span-5" : "text-sm text-danger md:col-span-5"}>
          {state.message}
        </p>
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

function DocumentForm({
  order,
  canCreateDocuments,
  canExportDocuments
}: {
  order: OrderRow;
  canCreateDocuments: boolean;
  canExportDocuments: boolean;
}) {
  const [state, action, pending] = useActionState(createOrderDocumentAction, initialState);

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
                  Receipt {payment.paymentDate}
                </a>
              ))
            : null}
          {order.deliveries.length > 0
            ? order.deliveries.map((delivery) => (
                <a key={delivery.id} href={`/api/documents/delivery-receipt/${delivery.id}`} className={pdfLinkClass}>
                  <Download className="h-4 w-4" />
                  Delivery receipt {delivery.scheduledDateLabel ?? delivery.id.slice(0, 8)}
                </a>
              ))
            : null}
        </div>
      ) : (
        <RestrictedPanel title="document exports" />
      )}
      {canCreateDocuments ? (
        <form action={action} className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-5">
          <input type="hidden" name="orderId" value={order.id} />
          <Select name="documentType" required defaultValue="ORDER_CONFIRMATION" aria-label="Document type">
            <option value="ORDER_CONFIRMATION">Order confirmation</option>
            <option value="INVOICE">Invoice</option>
            <option value="PAYMENT_RECEIPT">Payment receipt</option>
            <option value="OFFICIAL_RECEIPT">Official receipt</option>
            <option value="ACKNOWLEDGEMENT_RECEIPT">Acknowledgement receipt</option>
            <option value="DELIVERY_RECEIPT">Delivery receipt</option>
            <option value="OTHER">Other</option>
          </Select>
          <Select name="paymentId" defaultValue="" aria-label="Related payment">
            <option value="">No related payment</option>
            {order.payments.map((payment) => (
              <option key={payment.id} value={payment.id}>
                {payment.paymentDate} · {payment.amount}
              </option>
            ))}
          </Select>
          <Select name="deliveryId" defaultValue="" aria-label="Related delivery">
            <option value="">No related delivery</option>
            {order.deliveries.map((delivery) => (
              <option key={delivery.id} value={delivery.id}>
                {delivery.scheduledDateLabel ?? "No date"} ·{" "}
                {providerLabel(delivery.deliveryProviderType, delivery.deliveryProviderName)}
              </option>
            ))}
          </Select>
          <Input name="title" required placeholder="Document title, e.g. Order invoice PDF" />
          <Input name="cloudinaryPublicId" placeholder="Cloudinary public ID" />
          <Input name="secureUrl" placeholder="Cloudinary secure URL" />
          <Button disabled={pending}>
            <FilePlus2 className="h-4 w-4" />
            Save document
          </Button>
          <Textarea name="notes" placeholder="Document notes" className="md:col-span-5" />
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-700 md:col-span-5" : "text-sm text-danger md:col-span-5"}>
              {state.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

export function OrderWorkspace({
  canCreateOrders,
  canUpdateOrders,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  canCreateDocuments,
  canExportDocuments,
  customers,
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

  const totals = useMemo(() => {
    const subtotalAmount = roundMoney(
      items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    );
    const orderDiscountAmount =
      orderDiscountType === "PERCENTAGE"
        ? roundMoney(subtotalAmount * (orderDiscountValue / 100))
        : orderDiscountType === "FIXED_AMOUNT"
          ? roundMoney(orderDiscountValue)
          : 0;

    return {
      subtotalAmount,
      orderDiscountAmount,
      totalAmount: roundMoney(Math.max(subtotalAmount - orderDiscountAmount, 0))
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
        discountType: "",
        discountValue: 0,
        customerNotes: "",
        internalNotes: "",
        images: []
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

  return (
    <div className="space-y-6">
      {canCreateOrders ? (
        <section className="rounded-lg border border-border bg-panel">
          <div className="border-b border-border px-5 py-4">
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
              <p className={convertState.ok ? "text-sm text-emerald-700 md:col-span-2" : "text-sm text-danger md:col-span-2"}>
                {convertState.message}
              </p>
            ) : null}
          </form>
        </section>
      ) : null}

      {canCreateOrders ? (
      <form action={manualAction} className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <input type="hidden" name="items" value={JSON.stringify(toActionItems(items))} />
        <section className="rounded-lg border border-border bg-panel">
          <div className="border-b border-border px-5 py-4">
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
                Add catalog
              </Button>
              <Button type="button" variant="secondary" onClick={addCustomItem}>
                <Plus className="h-4 w-4" />
                Add custom
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-5">
                  <Input
                    value={item.itemName}
                    onChange={(event) => updateItem(index, { itemName: event.target.value })}
                    placeholder="Item name"
                    className="md:col-span-2"
                  />
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
                    aria-label="Quantity"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })}
                    aria-label="Unit price"
                  />
                  <div className="rounded-md bg-background px-3 py-2 text-sm font-medium">
                    {money(item.quantity * item.unitPrice)}
                  </div>
                  <Textarea
                    value={item.description}
                    onChange={(event) => updateItem(index, { description: event.target.value })}
                    placeholder="Description"
                    className="md:col-span-5"
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Textarea name="customerNotes" placeholder="Customer-facing order notes" />
              <Textarea name="internalNotes" placeholder="Internal notes" />
            </div>
          </div>
        </section>

        <aside className="rounded-lg border border-border bg-panel">
          <div className="border-b border-border px-5 py-4">
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
            <div className="flex justify-between gap-4 border-t border-border pt-3 text-base">
              <span className="font-semibold">Total</span>
              <span className="font-semibold">{money(totals.totalAmount)}</span>
            </div>
            {manualState.message ? (
              <p className={manualState.ok ? "text-sm text-emerald-700" : "text-sm text-danger"}>
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
        {orders.map((order) => (
          <article key={order.id} className="rounded-lg border border-border bg-panel">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">
                  {order.displayId} · {order.customerName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {readableLabel(order.sourceType)} · Created {order.createdAt} · Updated {order.updatedAt}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {order.companyName ? <span>Company: {order.companyName}</span> : null}
                  {order.contactPersonName ? <span>Contact person: {order.contactPersonName}</span> : null}
                  {order.contactSnapshot ? <span>{order.contactSnapshot}</span> : null}
                  {order.assignedStaff ? <span>Staff: {order.assignedStaff}</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={statusTone(order.status)}>{orderStatusLabel(order.status)}</StatusPill>
                <StatusPill tone={statusTone(order.paymentStatus)}>{paymentStatusLabel(order.paymentStatus)}</StatusPill>
                <StatusPill tone={statusTone(order.deliveryStatus)}>{deliveryStatusLabel(order.deliveryStatus)}</StatusPill>
              </div>
            </div>
            <div className="grid gap-5 p-5 xl:grid-cols-[1fr_360px]">
              <div className="space-y-5">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 font-medium">Item</th>
                        <th className="py-2 font-medium">Qty</th>
                        {canViewDeliveries ? <th className="py-2 font-medium">Scheduled</th> : null}
                        {canViewDeliveries ? <th className="py-2 font-medium">Delivered</th> : null}
                        {canViewPayments ? <th className="py-2 font-medium">Unit</th> : null}
                        {canViewPayments ? <th className="py-2 font-medium">Discount</th> : null}
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
                          {canViewPayments ? <td className="py-2 text-muted-foreground">{item.discountAmount}</td> : null}
                          {canViewPayments ? <td className="py-2 font-medium">{item.lineTotal}</td> : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Payment tab</h3>
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
                  <h3 className="text-sm font-semibold">Delivery tab</h3>
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
                              <span className="font-medium">{delivery.scheduledDateLabel ?? "No date"}</span>
                              <StatusPill tone={statusTone(delivery.status)}>{deliveryStatusLabel(delivery.status)}</StatusPill>
                            </div>
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
                  <h3 className="text-sm font-semibold">Documents tab</h3>
                  <DocumentForm
                    order={order}
                    canCreateDocuments={canCreateDocuments}
                    canExportDocuments={canExportDocuments}
                  />
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    {order.documents.map((document) => (
                      <div key={document.id} className="rounded-md bg-background p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{document.title}</span>
                          <StatusPill tone={statusTone(document.status)}>
                            {documentStatusLabel(document.status)}
                          </StatusPill>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {documentTypeLabel(document.documentType)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {order.documents.length === 0 ? <EmptyPanel message="No saved document metadata yet." /> : null}
                </div>
              </div>

              <aside className="space-y-3 rounded-md bg-background p-4 text-sm">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Customer snapshot</p>
                  <p className="mt-1 font-semibold">{order.customerName}</p>
                  {order.companyName ? <p className="text-muted-foreground">{order.companyName}</p> : null}
                  {order.contactSnapshot ? <p className="text-muted-foreground">{order.contactSnapshot}</p> : null}
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs uppercase text-muted-foreground">Delivery address</p>
                  <p className="mt-1">{order.deliveryAddressSnapshot ?? "No delivery address snapshot"}</p>
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
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{canViewPayments ? order.subtotalAmount : "Restricted"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Item discounts</span>
                  <span className="font-medium">{canViewPayments ? order.itemDiscountTotal : "Restricted"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Order discount</span>
                  <span className="font-medium">{canViewPayments ? order.orderDiscountAmount : "Restricted"}</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-3">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">{canViewPayments ? order.totalAmount : "Restricted"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium">{canViewPayments ? order.paidAmount : "Restricted"}</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-3 text-base">
                  <span className="font-semibold">Balance</span>
                  <span className="font-semibold">{canViewPayments ? order.balanceAmount : "Restricted"}</span>
                </div>
                {canViewPayments ? (
                  <div className="border-t border-border pt-3">
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
                        Quotation: {order.relatedQuotationId.slice(0, 8)}
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
          </article>
        ))}
        {orders.length === 0 ? (
          <div className="rounded-lg border border-border bg-panel px-5 py-8 text-sm text-muted-foreground">
            No orders yet. Convert an approved quotation or create a manual order.
          </div>
        ) : null}
      </section>
    </div>
  );
}
