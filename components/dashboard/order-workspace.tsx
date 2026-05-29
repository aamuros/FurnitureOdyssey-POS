"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DeliveryStatus } from "@prisma/client";
import {
  CheckCircle2,
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  Clock,
  Download,
  MoreHorizontal,
  PackageSearch,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  Truck,
  X
} from "lucide-react";
import {
  completeOrderAction,
  convertQuotationToOrderAction,
  cancelOrderAction,
  createDeliveryAction,
  createManualOrderAction,
  createPaymentAction,
  deleteOrderAction,
  updateOrderCustomerAction,
  updateDeliveryProgressAction,
  updateOrderItemsAction,
  updatePaymentDueTimingAction
} from "@/app/actions/orders";
import {
  CustomerResolverPanel,
  SalesItemsEditor,
  SalesSummaryPanel,
  calculateSalesTotals,
  toActionItems as toSalesActionItems,
  type CustomerOption as ResolverCustomerOption,
  type ItemDraft as SalesItemDraft,
  type ProductOption as SalesProductOption,
  type SelectedCustomer
} from "@/components/dashboard/quotation-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import {
  deliveryStatusLabel,
  paymentDueTimingLabel,
  paymentStatusLabel,
  paymentTypeLabel,
  readableLabel,
  statusTone
} from "@/lib/orders/status-labels";
import type { StatusTone } from "@/lib/orders/status-labels";
import { getAllowedNextStatuses } from "@/lib/status-transitions";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { usePersistentPageState } from "@/lib/use-persistent-page-state";
import { cn } from "@/lib/utils";

type CustomerOption = {
  id: string;
  displayName: string;
  companyName: string | null;
  primaryContact: string | null;
};

type ProductOption = Omit<SalesProductOption, "primaryImage" | "colorVariants"> & {
  primaryImage?: SalesProductOption["primaryImage"];
  colorVariants?: SalesProductOption["colorVariants"];
};

type StaffOption = {
  id: string;
  displayName: string;
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
  orderItemId: string;
  productId: string | null;
  itemType: "CATALOG_PRODUCT" | "CUSTOM_ITEM";
  sortOrder: number;
  snapshotProductCode: string | null;
  selectedVariantId: string | null;
  selectedVariantName: string | null;
  selectedVariantHex: string | null;
  itemName: string;
  description: string;
  specifications: string;
  quantity: number;
  unitPriceValue: number;
  unitCostSnapshotValue: number;
  discountType: "FIXED_AMOUNT" | "PERCENTAGE" | null;
  discountValue: number;
  requiresAssembly: boolean;
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
  images: SalesItemDraft["images"];
};

type OrderRow = {
  id: string;
  displayId: string;
  customerName: string;
  companyName: string | null;
  contactPersonName: string | null;
  contactSnapshot: string | null;
  customerId: string;
  customerType: string;
  billingAddressSnapshot: string | null;
  deliveryAddressSnapshot: string | null;
  assignedStaff: string | null;
  sourceType: string;
  status: string;
  paymentStatus: string;
  paymentDueTiming: string | null;
  paymentDueDate: string;
  deliveryStatus: string;
  nextDeliveryStatus: string | null;
  canScheduleDelivery: boolean;
  canCompleteOrder: boolean;
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
  orderDiscountValue: number;
  assemblyFeeTotalValue: number;
  salesInvoiceFeeTotalValue: number;
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
    pdfDetails: Array<{
      id: string;
      label: string;
      value: string;
    }>;
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

type DeliveryRow = OrderRow["deliveries"][number];

type PdfDetailRow = {
  id: string;
  label: string;
  value: string;
};

type OrderWorkspaceProps = {
  canCreateOrders: boolean;
  canUpdateOrders: boolean;
  canDeleteOrders: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  canUpdateDeliveries: boolean;
  canExportDocuments: boolean;
  canCreateCustomers: boolean;
  canViewProducts: boolean;
  initialSelectedOrderId?: string | null;
  orders: OrderRow[];
  customers: CustomerOption[];
  products: ProductOption[];
  staffOptions: StaffOption[];
  persistenceUserKey?: string | null;
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
type OrderActionSource = "next" | "section";
type ActiveOrderPanelAction = {
  orderId: string;
  action: OpenOrderAction;
  source: OrderActionSource;
};

type OrderWorkspaceDraft = {
  selectedOrderId: string | null;
  activePanelAction: ActiveOrderPanelAction | null;
};

type OrderDetailPanelDraft = {
  activeDetailTab: OrderDetailTab;
};
type NewOrderMode = "choices" | "quotation" | "manual";
type ManualOrderStep = "customer" | "items" | "plan" | "review";
type OrderCardPrimaryActionKind = "recordPayment" | "scheduleDelivery" | "details";
type OrderCardPrimaryAction = {
  kind: OrderCardPrimaryActionKind;
  label: string;
  nextLabel: string;
  onClick: () => void;
};
type OrderNextStepAction = OpenOrderAction | "complete" | null;
type OrderNextStep = {
  label: string;
  reason: string;
  ctaLabel: string;
  action: OrderNextStepAction;
  blocked?: boolean;
  tone: StatusTone;
};
type OrderDetailTab = "overview" | "customer" | "items" | "payments" | "deliveries" | "documents" | "notes";
type PendingOrderAction =
  | { type: "cancel"; order: OrderRow }
  | { type: "delete"; order: OrderRow }
  | null;

type NewOrderLauncherProps = Pick<
  OrderWorkspaceProps,
  "canCreateOrders" | "canViewPayments"
>;

type OrderListProps = Pick<
  OrderWorkspaceProps,
  | "canUpdateOrders"
  | "canDeleteOrders"
  | "canViewPayments"
  | "canCreatePayments"
  | "canViewDeliveries"
  | "canCreateDeliveries"
  | "canUpdateDeliveries"
  | "canExportDocuments"
  | "canCreateCustomers"
  | "canViewProducts"
  | "initialSelectedOrderId"
  | "orders"
  | "customers"
  | "products"
  | "staffOptions"
  | "persistenceUserKey"
>;

const initialState = {
  ok: false,
  message: ""
};

const pdfLinkClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-panel px-2 text-sm font-medium text-foreground transition hover:bg-muted";

type OptionLoadState<T> = {
  items: T[];
  count: number;
  query: string;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

function emptyOptionState<T>(): OptionLoadState<T> {
  return {
    items: [],
    count: 0,
    query: "",
    loading: false,
    loaded: false,
    error: null
  };
}

async function fetchCreateOptions<T>(kind: "customers" | "products" | "quotations", query: string) {
  const params = new URLSearchParams({
    kind
  });

  if (query.trim()) {
    params.set("q", query.trim());
  }

  const response = await fetch(`/api/orders/create-options?${params.toString()}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Unable to load order options.");
  }

  return (await response.json()) as {
    items: T[];
    count: number;
  };
}

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(value);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeIntegerQuantity(
  value: number,
  { min = 0, max = Number.POSITIVE_INFINITY }: { min?: number; max?: number } = {}
) {
  const parsed = Number(value);
  const integer = Number.isFinite(parsed) ? Math.trunc(parsed) : min;

  return Math.min(Math.max(integer, min), max);
}

function roundIntegerQuantity(value: number) {
  return normalizeIntegerQuantity(value);
}

function parseDecimalInput(value: string, fallback = 0) {
  if (!value.trim()) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIntegerInput(value: string, fallback = 0) {
  if (!value.trim()) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function decimalInputValue(value: number) {
  return Number.isFinite(value) ? String(roundQuantity(value)) : "";
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function formatDateChipLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return "";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric"
  }).format(new Date(year, month - 1, day));
}

function formatLongDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

function normalizePdfDetailRows(rows: PdfDetailRow[]): PdfDetailRow[] {
  return rows.map((row, index) => ({
    id: row.id ?? `row-${index + 1}`,
    label: row.label ?? "",
    value: row.value ?? ""
  }));
}

function defaultDeliveryPdfRows(order: OrderRow, scheduledDate: string, scheduledTimeWindow: string): PdfDetailRow[] {
  return normalizePdfDetailRows([
    { id: "row-1", label: "Order", value: order.displayId ?? "" },
    { id: "row-2", label: "Delivery receipt number", value: "Auto-generated after saving/export" },
    { id: "row-3", label: "Scheduled date", value: scheduledDate ? formatLongDateLabel(scheduledDate) : "" },
    { id: "row-4", label: "Time window", value: scheduledTimeWindow ?? "" }
  ]);
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

function DecimalInput({
  value,
  onValueChange,
  min = 0,
  max,
  step = "0.01",
  fallback = 0,
  "aria-label": ariaLabel,
  placeholder,
  disabled,
  name,
  className
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: string;
  fallback?: number;
  "aria-label"?: string;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(decimalInputValue(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(decimalInputValue(value));
    }
  }, [editing, value]);

  return (
    <Input
      name={name}
      type="number"
      min={min}
      max={max}
      step={step}
      value={editing ? draft : decimalInputValue(value)}
      disabled={disabled}
      onFocus={() => {
        setEditing(true);
        setDraft(decimalInputValue(value));
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);

        if (nextValue.trim()) {
          const parsed = parseDecimalInput(nextValue, fallback);
          const bounded = Math.min(Math.max(parsed, min), max ?? Number.POSITIVE_INFINITY);
          onValueChange(roundQuantity(bounded));
        }
      }}
      onBlur={() => {
        const parsed = parseDecimalInput(draft, fallback);
        const bounded = Math.min(Math.max(parsed, min), max ?? Number.POSITIVE_INFINITY);
        const rounded = roundQuantity(bounded);
        setEditing(false);
        setDraft(decimalInputValue(rounded));
        onValueChange(rounded);
      }}
      aria-label={ariaLabel}
      placeholder={placeholder}
      className={className}
    />
  );
}

function IntegerInput({
  value,
  onValueChange,
  min = 0,
  max,
  fallback = 0,
  "aria-label": ariaLabel,
  disabled,
  className
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  fallback?: number;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(normalizeIntegerQuantity(value, { min })));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(String(normalizeIntegerQuantity(value, { min })));
    }
  }, [editing, min, value]);

  function clamp(valueToClamp: number) {
    return normalizeIntegerQuantity(valueToClamp, { min, max });
  }

  return (
    <Input
      type="number"
      min={min}
      max={max}
      step="1"
      value={editing ? draft : String(normalizeIntegerQuantity(value, { min }))}
      disabled={disabled}
      onFocus={() => {
        setEditing(true);
        setDraft(String(normalizeIntegerQuantity(value, { min })));
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);

        if (nextValue.trim()) {
          onValueChange(clamp(parseIntegerInput(nextValue, fallback)));
        }
      }}
      onBlur={() => {
        const nextValue = clamp(parseIntegerInput(draft, fallback));
        setEditing(false);
        setDraft(String(nextValue));
        onValueChange(nextValue);
      }}
      aria-label={ariaLabel}
      className={className}
    />
  );
}

function toActionItems(items: ItemDraft[]) {
  return items.map((item, index) => ({
    productId: item.productId,
    itemType: item.itemType,
    sortOrder: index,
    itemName: item.itemName,
    quantity: normalizeIntegerQuantity(item.quantity, { min: 1 }),
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
  const setPaymentAmountShortcut = (value: number) => {
    const shortcutAmount = roundMoney(value);

    if (shortcutAmount > 0) {
      setAmount(String(shortcutAmount));
    }
  };

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
        <div className="flex flex-wrap gap-2 self-end">
          <Button
            type="button"
            variant="secondary"
            className="flex-1 whitespace-nowrap sm:flex-none"
            disabled={order.balanceAmountValue <= 0}
            onClick={() => setPaymentAmountShortcut(order.balanceAmountValue / 2)}
          >
            Half balance
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1 whitespace-nowrap sm:flex-none"
            disabled={order.balanceAmountValue <= 0}
            onClick={() => setPaymentAmountShortcut(order.balanceAmountValue)}
          >
            Use full balance
          </Button>
        </div>
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
        <span className="font-medium">{money(projectedBalance)} balance</span>
        <span className="text-muted-foreground"> · </span>
        <span className="font-medium">{money(projectedPaid)} paid</span>
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

type DeliveryItemDraft = {
  orderItemId: string;
  selected: boolean;
  quantityPlanned: number;
};

function createDeliveryItemDrafts(order: OrderRow): DeliveryItemDraft[] {
  return remainingItemLines(order).map((item) => ({
    orderItemId: item.id,
    selected: false,
    quantityPlanned: normalizeIntegerQuantity(Math.min(item.remainingQuantity, 1))
  }));
}

function clampDeliveryQuantity(value: number, remainingQuantity: number) {
  return roundIntegerQuantity(Math.min(Math.max(value, 0), remainingQuantity));
}

function parseDeliveryStartTime(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { normalized: "", display: "", valid: true };
  }

  const match = trimmed.match(/^(\d{1,2})(?::([0-5]\d))?\s*([AaPp][Mm])?$/);

  if (!match) {
    return { normalized: "", display: trimmed, valid: false };
  }

  const meridiem = match[3]?.toUpperCase();
  let hour = Number(match[1]);
  const minute = match[2] ?? "00";

  if (meridiem) {
    if (hour < 1 || hour > 12) {
      return { normalized: "", display: trimmed, valid: false };
    }

    hour = hour % 12;

    if (meridiem === "PM") {
      hour += 12;
    }
  } else if (hour > 23) {
    return { normalized: "", display: trimmed, valid: false };
  }

  const normalized = `${String(hour).padStart(2, "0")}:${minute}`;
  const displayHour = hour % 12 || 12;
  const displayMeridiem = hour >= 12 ? "PM" : "AM";

  return {
    normalized,
    display: `${String(displayHour).padStart(2, "0")}:${minute} ${displayMeridiem}`,
    valid: true
  };
}

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function DeliveryTimePicker({
  value,
  onChange
}: {
  value: string;
  onChange: (formatted: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState("09");
  const [minute, setMinute] = useState("00");
  const [period, setPeriod] = useState<"AM" | "PM">("AM");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    if (value) {
      const match = value.match(/^(\d{2}):(\d{2})\s(AM|PM)$/);
      if (match) {
        setHour(match[1]);
        setMinute(match[2]);
        setPeriod(match[3] as "AM" | "PM");
      }
    } else {
      setHour("09");
      setMinute("00");
      setPeriod("AM");
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleApply() {
    onChange(`${hour}:${minute} ${period}`);
    setOpen(false);
  }

  function handleClear() {
    onChange("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-panel px-3 text-left text-[16px] text-foreground outline-none transition",
          "hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20",
          !value && "text-muted-foreground"
        )}
        aria-label="Delivery start time"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          {value || "Select time"}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[260px] rounded-lg border border-border bg-panel shadow-lg">
          <div className="grid grid-cols-3 gap-0 border-b border-border">
            <div className="border-r border-border px-1 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hour</div>
            <div className="border-r border-border px-1 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Min</div>
            <div className="px-1 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Period</div>
          </div>
          <div className="grid h-[168px] grid-cols-3 gap-0">
            <div className="scrollbar-thin h-[168px] overflow-y-auto border-r border-border">
              {HOUR_OPTIONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  data-selected={h === hour}
                  onClick={() => setHour(h)}
                  className={cn(
                    "h-10 w-full border border-transparent text-center text-sm font-medium leading-none transition-colors",
                    h === hour
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted/50"
                  )}
                >
                  {h}
                </button>
              ))}
            </div>
            <div className="scrollbar-thin h-[168px] overflow-y-auto border-r border-border">
              {MINUTE_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  data-selected={m === minute}
                  onClick={() => setMinute(m)}
                  className={cn(
                    "h-10 w-full border border-transparent text-center text-sm font-medium leading-none transition-colors",
                    m === minute
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted/50"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex h-[168px] flex-col">
              {(["AM", "PM"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "h-[84px] border border-transparent text-center text-sm font-semibold leading-none transition-colors",
                    p === period
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted/50"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-border p-2">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted/50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 rounded-md border border-primary/30 bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DeliveryPdfDetailsEditor({
  rows,
  onSave
}: {
  rows: PdfDetailRow[];
  onSave: (rows: PdfDetailRow[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const normalizedRows = useMemo(() => normalizePdfDetailRows(rows ?? []), [rows]);
  const [draftRows, setDraftRows] = useState<PdfDetailRow[]>(normalizedRows);
  const validationIssues = draftRows
    .map((row, index) => ({
      index,
      hasLabel: (row.label ?? "").trim().length > 0,
      hasValue: (row.value ?? "").trim().length > 0
    }))
    .filter((row) => row.hasLabel !== row.hasValue);

  useEffect(() => {
    if (!editing) {
      setDraftRows(normalizedRows);
    }
  }, [editing, normalizedRows]);

  function updateRow(id: string, key: "label" | "value", value: string) {
    setDraftRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, [key]: value } : row))
    );
  }

  function saveRows() {
    if (validationIssues.length) {
      return;
    }

    onSave(
      draftRows
        .map((row, index) => ({
          id: row.id ?? `row-${index + 1}`,
          label: (row.label ?? "").trim().slice(0, 80),
          value: (row.value ?? "").trim().slice(0, 200)
        }))
        .filter((row) => row.label || row.value)
        .slice(0, 12)
    );
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">
            Changes here affect the delivery receipt PDF display only. They do not change the official order or receipt number.
          </p>
          <Button
            type="button"
            variant="ghost"
            className="min-h-8 shrink-0 rounded-md px-2"
            onClick={() => {
              setDraftRows(normalizedRows);
              setEditing(true);
            }}
            aria-label="Edit PDF details"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
        <div className="divide-y divide-border rounded-md border border-border bg-panel">
          {rows.length ? (
            rows.map((row) => (
              <div key={row.id} className="grid gap-2 px-3 py-2 text-[13px] sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <span className="min-w-0 truncate font-medium text-muted-foreground">{row.label}</span>
                <span className="min-w-0 break-words text-foreground">{row.value}</span>
              </div>
            ))
          ) : (
            <p className="px-3 py-2 text-[13px] text-muted-foreground">No custom PDF detail rows.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        Changes here affect the delivery receipt PDF display only. They do not change the official order or receipt number.
      </p>
      <div className="space-y-2">
        <div className="hidden grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_2.5rem] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
          <span>Text Holder</span>
          <span>Text Value</span>
          <span />
        </div>
        {draftRows.map((row, index) => {
          const hasIssue = validationIssues.some((issue) => issue.index === index);

          return (
            <div key={row.id} className="space-y-1">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_2.5rem]">
                <Input
                  value={row.label ?? ""}
                  maxLength={80}
                  onChange={(event) => updateRow(row.id, "label", event.target.value)}
                  placeholder="Text Holder"
                  aria-label="PDF detail text holder"
                  className="text-[14px]"
                />
                <Input
                  value={row.value ?? ""}
                  maxLength={200}
                  onChange={(event) => updateRow(row.id, "value", event.target.value)}
                  placeholder="Text Value"
                  aria-label="PDF detail text value"
                  className="text-[14px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-10 rounded-md px-2 text-danger"
                  onClick={() => setDraftRows((currentRows) => currentRows.filter((candidate) => candidate.id !== row.id))}
                  aria-label="Remove PDF detail row"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {hasIssue ? <p className="text-xs text-danger">Both Text Holder and Text Value are required.</p> : null}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          className="min-h-8 rounded-md px-3 text-xs"
          disabled={draftRows.length >= 12}
          onClick={() =>
            setDraftRows((currentRows) => [
              ...currentRows,
              { id: `custom-${Date.now()}`, label: "", value: "" }
            ])
          }
        >
          <Plus className="h-4 w-4" />
          Add row
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="min-h-8 rounded-md px-3 text-xs"
            onClick={() => {
              setDraftRows(rows);
              setEditing(false);
            }}
          >
            Discard
          </Button>
          <Button
            type="button"
            className="min-h-8 rounded-md px-3 text-xs"
            disabled={validationIssues.length > 0}
            onClick={saveRows}
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeliveryForm({
  order,
  staffOptions,
  onSuccess
}: {
  order: OrderRow;
  staffOptions: StaffOption[];
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(createDeliveryAction, initialState);
  const handledSuccessRef = useRef(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledStartTimeInput, setScheduledStartTimeInput] = useState("");
  const [itemDrafts, setItemDrafts] = useState<DeliveryItemDraft[]>(() => createDeliveryItemDrafts(order));
  const [pdfDetails, setPdfDetails] = useState<PdfDetailRow[]>(() => defaultDeliveryPdfRows(order, "", ""));
  const [pdfDetailsEdited, setPdfDetailsEdited] = useState(false);
  const remainingItems = useMemo(() => remainingItemLines(order), [order]);
  const itemById = useMemo(() => new Map(remainingItems.map((item) => [item.id, item])), [remainingItems]);
  const parsedStartTime = parseDeliveryStartTime(scheduledStartTimeInput);
  const scheduledStartTime = parsedStartTime.valid ? parsedStartTime.normalized : "";
  const scheduledTimeWindow = parsedStartTime.valid ? parsedStartTime.display : scheduledStartTimeInput.trim();
  const defaultPdfDetails = useMemo(
    () => defaultDeliveryPdfRows(order, scheduledDate, scheduledTimeWindow),
    [order, scheduledDate, scheduledTimeWindow]
  );
  const selectedDrafts = itemDrafts.filter((item) => item.selected);
  const allRemainingItemsSelected =
    itemDrafts.length > 0 && itemDrafts.every((item) => item.selected);
  const deliveryItems = selectedDrafts
    .filter((item) => item.quantityPlanned > 0)
    .map((item) => {
      const orderItem = itemById.get(item.orderItemId);

      return {
        orderItemId: item.orderItemId,
        quantityPlanned: normalizeIntegerQuantity(item.quantityPlanned, {
          min: 0,
          max: orderItem?.remainingQuantity
        }),
        quantityDelivered: 0,
        notes: ""
      };
    });
  const selectedQuantityTotal = roundQuantity(
    deliveryItems.reduce((sum, item) => sum + item.quantityPlanned, 0)
  );
  const hasQuantityOverage = selectedDrafts.some((draft) => {
    const item = itemById.get(draft.orderItemId);

    return item ? draft.quantityPlanned > item.remainingQuantity : true;
  });
  const validationMessage = !scheduledDate
    ? "Choose a scheduled date."
    : !parsedStartTime.valid
      ? "Enter delivery start time like 02:30 PM or 14:30."
    : selectedDrafts.length === 0
        ? "Select at least one item."
        : deliveryItems.length === 0
          ? "Enter a quantity greater than zero."
          : hasQuantityOverage
            ? "Reduce quantities to each item's remaining amount."
            : "";
  const summaryMessage =
    scheduledDate && deliveryItems.length > 0
      ? [
          formatDateChipLabel(scheduledDate),
          scheduledTimeWindow || "All day",
          `${deliveryItems.length} ${deliveryItems.length === 1 ? "item" : "items"}`,
          `${selectedQuantityTotal} total qty`
        ].join(" · ")
      : !scheduledDate && deliveryItems.length === 0
        ? "Choose a date and select at least one item."
        : !scheduledDate
          ? "Choose a date."
          : "Select at least one item.";
  const today = toDateInputValue(new Date());
  const quickDates = [
    { label: "Today", value: today },
    { label: "Tomorrow", value: toDateInputValue(addDays(new Date(), 1)) },
    { label: "Next week", value: toDateInputValue(addDays(new Date(), 7)) }
  ];

  useEffect(() => {
    setItemDrafts(createDeliveryItemDrafts(order));
    setPdfDetailsEdited(false);
  }, [order]);

  useEffect(() => {
    if (!pdfDetailsEdited) {
      setPdfDetails(defaultPdfDetails);
    }
  }, [defaultPdfDetails, pdfDetailsEdited]);

  useEffect(() => {
    if (!state.ok) {
      handledSuccessRef.current = false;
      return;
    }

    if (handledSuccessRef.current) {
      return;
    }

    handledSuccessRef.current = true;
    setScheduledDate("");
    setScheduledStartTimeInput("");
    setItemDrafts(createDeliveryItemDrafts(order));
    setPdfDetailsEdited(false);
    setPdfDetails(defaultDeliveryPdfRows(order, "", ""));
    onSuccess?.();
  }, [onSuccess, order, state.ok]);

  function updateItemDraft(orderItemId: string, updater: (draft: DeliveryItemDraft, item: OrderItemRow) => DeliveryItemDraft) {
    setItemDrafts((currentDrafts) =>
      currentDrafts.map((draft) => {
        if (draft.orderItemId !== orderItemId) {
          return draft;
        }

        const item = itemById.get(orderItemId);

        return item ? updater(draft, item) : draft;
      })
    );
  }

  function toggleAllItemDrafts() {
    setItemDrafts((currentDrafts) =>
      currentDrafts.map((draft) => {
        const item = itemById.get(draft.orderItemId);

        if (!item) {
          return draft;
        }

        return {
          ...draft,
          selected: !allRemainingItemsSelected,
          quantityPlanned: !allRemainingItemsSelected
            ? normalizeIntegerQuantity(item.remainingQuantity)
            : clampDeliveryQuantity(draft.quantityPlanned, item.remainingQuantity)
        };
      })
    );
  }

  return (
    <form
      action={action}
      className="space-y-5 text-sm"
      onSubmit={(event) => {
        if (validationMessage) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="items" value={JSON.stringify(deliveryItems)} />
      <input type="hidden" name="scheduledTimeWindow" value={scheduledTimeWindow} />
      <input type="hidden" name="scheduledStartTime" value={scheduledStartTime} />
      <input type="hidden" name="pdfDetails" value={JSON.stringify(normalizePdfDetailRows(pdfDetails ?? []))} />

      <section className="space-y-3 rounded-md border border-border bg-panel p-4">
        <div>
          <h4 className="text-[15px] font-semibold">When</h4>
          <p className="mt-1 text-[13px] text-muted-foreground">Set the delivery date and when the delivery process starts.</p>
        </div>
        <label className="block space-y-2 text-[14px] font-medium text-foreground">
          Scheduled date
          <Input
            name="scheduledDate"
            type="date"
            required
            value={scheduledDate}
            onChange={(event) => setScheduledDate(event.target.value)}
            aria-label="Scheduled date"
            className="text-[15px]"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {quickDates.map((date) => (
            <Button
              key={date.label}
              type="button"
              variant={scheduledDate === date.value ? "primary" : "secondary"}
              className="min-h-8 rounded-md px-3 text-xs"
              onClick={() => setScheduledDate(date.value)}
            >
              {date.label}
            </Button>
          ))}
        </div>
        <div className="max-w-xs">
          <label className="block space-y-2 text-[14px] font-medium text-foreground">
            Delivery start time
            <DeliveryTimePicker
              value={scheduledStartTimeInput}
              onChange={(formatted) => setScheduledStartTimeInput(formatted)}
            />
          </label>
          {!parsedStartTime.valid ? (
            <p className="mt-2 text-xs text-danger">Use a time like 02:30 PM, 2:30 PM, or 14:30.</p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">Calendar events end automatically 30 minutes after this time.</p>
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-border bg-panel p-4">
        <div>
          <h4 className="text-[15px] font-semibold">Assignment</h4>
          <p className="mt-1 text-[13px] text-muted-foreground">Assign the delivery process to an active staff user.</p>
        </div>
        <label className="block space-y-2 text-[14px] font-medium text-foreground">
          Assign delivery to
          <Select name="assignedStaffId" defaultValue="" aria-label="Assign delivery to" className="text-[15px]">
            <option value="">Unassigned</option>
            {staffOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </Select>
        </label>
      </section>

      <section className="space-y-3 rounded-md border border-border bg-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-[15px] font-semibold">Items</h4>
            <p className="mt-1 text-[13px] text-muted-foreground">Select one or more remaining item quantities.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="min-h-8 rounded-md px-3 text-xs"
            disabled={remainingItems.length === 0}
            onClick={toggleAllItemDrafts}
          >
            {allRemainingItemsSelected ? "Unselect all" : "Select all"}
          </Button>
        </div>
        <div className="divide-y divide-border rounded-md border border-border bg-background">
          {remainingItems.map((item) => {
            const draft = itemDrafts.find((candidate) => candidate.orderItemId === item.id);
            const quantity = draft?.quantityPlanned ?? 0;
            const selected = draft?.selected ?? false;

            return (
              <div key={item.id} className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
                <label className="flex min-w-0 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) =>
                      updateItemDraft(item.id, (draftItem, orderItem) => ({
                        ...draftItem,
                        selected: event.target.checked,
                        quantityPlanned:
                          event.target.checked && draftItem.quantityPlanned <= 0
                            ? normalizeIntegerQuantity(Math.min(orderItem.remainingQuantity, 1))
                            : draftItem.quantityPlanned
                      }))
                    }
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    aria-label={`Select ${item.itemName}`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{item.itemName}</span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">
                      {item.remainingQuantity} remaining of {item.quantity}
                    </span>
                  </span>
                </label>
                <label className="space-y-1 text-[13px] font-medium text-muted-foreground">
                  Quantity
                  <IntegerInput
                    value={quantity}
                    onValueChange={(nextValue) =>
                      updateItemDraft(item.id, (draftItem, orderItem) => ({
                        ...draftItem,
                        quantityPlanned: clampDeliveryQuantity(nextValue, orderItem.remainingQuantity)
                      }))
                    }
                    min={0}
                    max={item.remainingQuantity}
                    fallback={selected ? normalizeIntegerQuantity(Math.min(item.remainingQuantity, 1)) : 0}
                    disabled={!selected}
                    aria-label={`${item.itemName} delivery quantity`}
                    className="text-[15px]"
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-border bg-panel p-4">
        <div>
          <h4 className="text-[15px] font-semibold">Provider and destination</h4>
          <p className="mt-1 text-[13px] text-muted-foreground">Add the delivery provider and destination snapshot.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-[14px] font-medium text-foreground">
            Provider type
            <Select
              name="deliveryProviderType"
              defaultValue=""
              aria-label="Delivery provider type"
              className="text-[15px]"
            >
              <option value="">Provider type</option>
              <option value="IN_HOUSE">In-house</option>
              <option value="CUSTOMER_PICKUP">Customer pickup</option>
              <option value="THIRD_PARTY">Third-party</option>
              <option value="OTHER">Other</option>
            </Select>
          </label>
          <label className="space-y-2 text-[14px] font-medium text-foreground">
            Provider name
            <Input
              name="deliveryProviderName"
              placeholder="Provider name"
              aria-label="Delivery provider name"
              className="text-[15px]"
            />
          </label>
        </div>
        <label className="block space-y-2 text-[14px] font-medium text-foreground">
          Phone
          <Input name="recipientPhone" placeholder="Phone optional" className="text-[15px]" />
        </label>
        <label className="block space-y-2 text-[14px] font-medium text-foreground">
          Address
          <Input
            name="deliveryAddress"
            defaultValue={order.deliveryAddressSnapshot ?? ""}
            placeholder="Address Name"
            className="text-[15px]"
          />
        </label>
        <label className="block space-y-2 text-[14px] font-medium text-foreground">
          Delivery notes
          <Textarea name="deliveryNotes" placeholder="Delivery notes optional" className="text-[15px]" />
        </label>
        <details className="rounded-md border border-dashed border-border bg-background/70 px-4 py-3">
          <summary className="cursor-pointer text-[14px] font-medium text-muted-foreground">
            PDF details
          </summary>
          <div className="mt-4">
            <DeliveryPdfDetailsEditor
              rows={pdfDetails}
              onSave={(rows) => {
                setPdfDetails(normalizePdfDetailRows(rows ?? []));
                setPdfDetailsEdited(true);
              }}
            />
          </div>
        </details>
      </section>

      <div className="rounded-md border border-border bg-background p-3">
        <p className="text-[14px] font-medium">{summaryMessage}</p>
        {validationMessage ? <p className="mt-1 text-[13px] text-danger">{validationMessage}</p> : null}
        <Button disabled={pending || Boolean(validationMessage)} className="mt-3 w-full text-[15px]">
          <Truck className="h-4 w-4" />
          Schedule delivery
        </Button>
      </div>
      {state.message ? (
        <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>
      ) : null}
    </form>
  );
}

function CompleteOrderForm({
  order,
  buttonClassName,
  variant = "secondary"
}: {
  order: OrderRow;
  buttonClassName?: string;
  variant?: "primary" | "secondary";
}) {
  const [state, action, pending] = useActionState(completeOrderAction, initialState);

  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="orderId" value={order.id} />
      <Button type="submit" variant={variant} disabled={pending || !order.canCompleteOrder} className={buttonClassName}>
        <CheckCircle2 className="h-4 w-4" />
        Complete order
      </Button>
      {state.message ? (
        <span className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</span>
      ) : null}
    </form>
  );
}

function DeliveryProgressForm({ delivery }: { delivery: DeliveryRow }) {
  const [state, action, pending] = useActionState(updateDeliveryProgressAction, initialState);
  const [status, setStatus] = useState(delivery.status);
  const [progressDate, setProgressDate] = useState("");
  const [markAllDelivered, setMarkAllDelivered] = useState(false);
  const [items, setItems] = useState(
    delivery.items.map((item) => ({
      deliveryItemId: item.id,
      quantityDelivered: normalizeIntegerQuantity(item.quantityDelivered, {
        min: 0,
        max: item.quantityPlanned
      }),
      notes: ""
    }))
  );
  const deliveryItemStateKey = delivery.items
    .map((item) => `${item.id}:${item.quantityDelivered}:${item.quantityPlanned}`)
    .join("|");
  const allowedNextStatuses = getAllowedNextStatuses("delivery", delivery.status as DeliveryStatus);
  const actionStatuses: DeliveryStatus[] = ["IN_TRANSIT", "DELIVERED", "CANCELLED"];
  const visibleActionStatuses = actionStatuses.filter((nextStatus) =>
    allowedNextStatuses.includes(nextStatus)
  );
  const submittedItems = markAllDelivered
    ? delivery.items.map((item) => ({
        deliveryItemId: item.id,
        quantityDelivered: normalizeIntegerQuantity(item.quantityPlanned),
        notes: items.find((candidate) => candidate.deliveryItemId === item.id)?.notes
      }))
    : items.map((item) => {
        const deliveryItem = delivery.items.find((candidate) => candidate.id === item.deliveryItemId);

        return {
          ...item,
          quantityDelivered: normalizeIntegerQuantity(item.quantityDelivered, {
            min: 0,
            max: deliveryItem?.quantityPlanned
          })
        };
      });

  function updateDeliveredQuantity(deliveryItemId: string, quantityDelivered: number) {
    setItems((current) =>
      current.map((item) => {
        if (item.deliveryItemId !== deliveryItemId) {
          return item;
        }

        const deliveryItem = delivery.items.find((candidate) => candidate.id === deliveryItemId);

        return {
          ...item,
          quantityDelivered: normalizeIntegerQuantity(quantityDelivered, {
            min: 0,
            max: deliveryItem?.quantityPlanned
          })
        };
      })
    );
  }

  function selectStatus(nextStatus: DeliveryStatus) {
    setStatus(nextStatus);

    if (nextStatus === "IN_TRANSIT" || nextStatus === "DELIVERED") {
      setProgressDate(toDateInputValue(new Date()));
    }
  }

  useEffect(() => {
    setStatus(delivery.status);
    setProgressDate("");
    setMarkAllDelivered(false);
    setItems(
      delivery.items.map((item) => ({
        deliveryItemId: item.id,
        quantityDelivered: normalizeIntegerQuantity(item.quantityDelivered, {
          min: 0,
          max: item.quantityPlanned
        }),
        notes: ""
      }))
    );
  }, [delivery.id, delivery.status, deliveryItemStateKey, delivery.items]);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="deliveryId" value={delivery.id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="items" value={JSON.stringify(submittedItems)} />
      {status === "DELIVERED" ? <input type="hidden" name="deliveredAt" value={progressDate} /> : null}
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          {visibleActionStatuses.map((nextStatus) => (
            <Button
              key={nextStatus}
              type="button"
              variant={status === nextStatus ? "primary" : "secondary"}
              className="min-h-9 px-3 text-xs"
              onClick={() => selectStatus(nextStatus)}
            >
              {deliveryStatusLabel(nextStatus)}
            </Button>
          ))}
        </div>
        {(status === "IN_TRANSIT" || status === "DELIVERED") ? (
          <label className="grid gap-1 text-xs font-medium text-muted-foreground md:max-w-[220px]">
            {status === "DELIVERED" ? "Delivered date" : "Progress date"}
            <Input
              type="date"
              value={progressDate}
              onChange={(event) => setProgressDate(event.target.value)}
              aria-label={status === "DELIVERED" ? "Delivered date" : "Progress date"}
            />
          </label>
        ) : null}
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
            <IntegerInput
              value={
                markAllDelivered
                  ? item.quantityPlanned
                  : (items.find((candidate) => candidate.deliveryItemId === item.id)?.quantityDelivered ?? 0)
              }
              disabled={markAllDelivered}
              onValueChange={(value) => updateDeliveredQuantity(item.id, value)}
              min={0}
              max={item.quantityPlanned}
              aria-label={`${item.itemName} delivered quantity`}
            />
          </label>
        ))}
      </div>
      <Textarea name="notes" placeholder="Internal progress notes" />
      <Button disabled={pending || visibleActionStatuses.length === 0 || !actionStatuses.includes(status as DeliveryStatus)}>
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

function DeliveryBlockedPanel({ order }: { order: OrderRow }) {
  const reasons = deliverySchedulingBlockReasons(order);

  return (
    <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Delivery scheduling is unavailable.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  );
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
          {order.relatedQuotationId ? (
            <a href={`/api/documents/quotation/${order.relatedQuotationId}`} className={pdfLinkClass}>
              <Download className="h-4 w-4" />
              Quotation PDF
            </a>
          ) : null}
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

function isTerminalOrder(order: OrderRow) {
  return ["CANCELLED", "COMPLETED"].includes(order.status);
}

function isDeliveryComplete(order: OrderRow) {
  return order.deliveryStatus === "DELIVERED";
}

function isDeliveryPartiallyDelivered(order: OrderRow) {
  return order.deliveryStatus === "PARTIALLY_DELIVERED";
}

function visibleDeliveryStatus(order: OrderRow) {
  if (order.nextDeliveryStatus && ["PLANNED", "SCHEDULED", "IN_TRANSIT"].includes(order.nextDeliveryStatus)) {
    return order.nextDeliveryStatus;
  }

  if (["PARTIALLY_DELIVERED", "DELIVERED", "CANCELLED"].includes(order.deliveryStatus)) {
    return order.deliveryStatus;
  }

  return order.nextDeliveryStatus ?? order.deliveryStatus;
}

function isDeliveryInTransit(order: OrderRow) {
  return visibleDeliveryStatus(order) === "IN_TRANSIT";
}

function isDeliveryScheduled(order: OrderRow) {
  return ["PLANNED", "SCHEDULED", "SCHEDULED_FOR_DELIVERY", "IN_TRANSIT"].includes(
    visibleDeliveryStatus(order)
  );
}

function isPaymentPaid(order: OrderRow) {
  return order.paymentStatus === "PAID" || !hasBalanceDue(order);
}

function isPaymentDueBeforeDelivery(order: OrderRow) {
  return order.paymentDueTiming === "BEFORE_DELIVERY" || !order.paymentDueTiming;
}

function isReadyToScheduleDelivery(order: OrderRow) {
  return order.canScheduleDelivery;
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

  if (canViewDeliveries && order.canCompleteOrder) {
    return "Ready to complete";
  }

  if (canViewDeliveries && isDeliveryPartiallyDelivered(order)) {
    return "Partially delivered";
  }

  if (canViewDeliveries && isDeliveryInTransit(order)) {
    return "In delivery";
  }

  if (canViewDeliveries && isDeliveryScheduled(order)) {
    return "Scheduled";
  }

  if (canViewDeliveries && isReadyToScheduleDelivery(order)) {
    return "Ready to schedule";
  }

  if (canViewPayments && hasBalanceDue(order) && isPaymentDueBeforeDelivery(order)) {
    return "Awaiting payment";
  }

  return "Review order";
}

function workflowStageTone(stage: string): StatusTone {
  if (["Completed", "Ready to complete", "Scheduled"].includes(stage)) {
    return "success";
  }

  if (["In delivery"].includes(stage)) {
    return "teal";
  }

  if (["Ready to schedule", "Collect balance", "Awaiting payment", "Partially delivered"].includes(stage)) {
    return "warning";
  }

  if (stage === "Cancelled") {
    return "danger";
  }

  return "neutral";
}

function workflowStageDescription(order: OrderRow, stage: string, canViewPayments: boolean, canViewDeliveries: boolean) {
  if (stage === "Awaiting payment" && canViewPayments) {
    return `${order.balanceAmount} due before delivery`;
  }

  if (stage === "Collect balance" && canViewPayments) {
    return `${order.balanceAmount} still open after delivery`;
  }

  if (stage === "Ready to schedule" && canViewDeliveries) {
    const remainingLines = order.items.filter((item) => item.remainingQuantity > 0).length;
    return `${itemCountLabel(remainingLines)} ready for delivery`;
  }

  if (stage === "Scheduled" && canViewDeliveries) {
    return deliverySummaryLabel(order);
  }

  if (stage === "In delivery" && canViewDeliveries) {
    return "Delivery progress is underway";
  }

  if (stage === "Partially delivered" && canViewDeliveries) {
    return "Some items have been delivered";
  }

  if (stage === "Ready to complete") {
    return "Paid and delivered";
  }

  if (stage === "Completed") {
    return "Order closed";
  }

  if (stage === "Cancelled") {
    return "No open staff action";
  }

  if (order.salesInvoiceRequested) {
    return "Sales invoice requested";
  }

  return "Review order details";
}

function nextActionLabel(order: OrderRow, canViewPayments: boolean, canViewDeliveries: boolean) {
  if (isTerminalOrder(order)) {
    return "No open action";
  }

  if (canViewDeliveries && order.canCompleteOrder) {
    return "Complete order";
  }

  if (canViewDeliveries && isDeliveryComplete(order) && canViewPayments && hasBalanceDue(order)) {
    return "Record payment";
  }

  if (canViewDeliveries && isReadyToScheduleDelivery(order)) {
    return "Schedule delivery";
  }

  if (canViewPayments && hasBalanceDue(order) && isPaymentDueBeforeDelivery(order)) {
    return "Record payment";
  }

  if (canViewDeliveries && (isDeliveryScheduled(order) || isDeliveryPartiallyDelivered(order))) {
    return "Update delivery progress";
  }

  if (canViewDeliveries && isDeliveryComplete(order) && (!canViewPayments || isPaymentPaid(order))) {
    return "Review details";
  }

  return "Review details";
}

function deliverySummaryLabel(order: OrderRow) {
  if (!order.nextDeliveryDate) {
    return "Not scheduled";
  }

  return [order.nextDeliveryDate, order.nextDeliveryProvider ? readableLabel(order.nextDeliveryProvider) : null]
    .filter(Boolean)
    .join(" · ");
}

function paymentSupportSummary(order: OrderRow) {
  if (!hasBalanceDue(order)) {
    return {
      label: "Paid in full",
      value: order.totalAmount,
      detail: `${order.paidAmount} received`
    };
  }

  return {
    label: paymentStatusLabel(order.paymentStatus),
    value: `${order.balanceAmount} due`,
    detail: [
      `${order.paidAmount} received`,
      order.paymentDueTiming ? paymentDueTimingLabel(order.paymentDueTiming) : null
    ]
      .filter(Boolean)
      .join(" · ")
  };
}

function deliverySupportSummary(order: OrderRow) {
  const status = visibleDeliveryStatus(order);

  if (order.deliveryStatus === "DELIVERED") {
    return {
      value: "Delivered",
      detail: deliveryStatusLabel(order.deliveryStatus)
    };
  }

  if (!order.nextDeliveryDate) {
    return {
      value: "Not scheduled",
      detail: deliveryStatusLabel(status)
    };
  }

  return {
    value: order.nextDeliveryDate,
    detail: [deliveryStatusLabel(status), order.nextDeliveryProvider ? readableLabel(order.nextDeliveryProvider) : null]
      .filter(Boolean)
      .join(" · ")
  };
}

function deliverySchedulingBlockReasons(order: OrderRow) {
  if (order.canScheduleDelivery) {
    return ["This order is eligible for delivery scheduling."];
  }

  const reasons: string[] = [];

  if (order.status === "COMPLETED") {
    reasons.push("Order is completed.");
  }

  if (order.status === "CANCELLED") {
    reasons.push("Order is cancelled.");
  }

  if (remainingItemLines(order).length === 0 || ["DELIVERED", "CANCELLED"].includes(order.deliveryStatus)) {
    reasons.push("All item quantities are already scheduled or delivered.");
  }

  if (reasons.length === 0) {
    reasons.push("Review remaining item quantities and order status before scheduling.");
  }

  return reasons;
}

function getDeliveryProgressTarget(order: OrderRow) {
  return (
    order.deliveries.find((delivery) =>
      ["SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED"].includes(delivery.status)
    ) ??
    order.deliveries.find((delivery) => !["DELIVERED", "FAILED", "CANCELLED"].includes(delivery.status)) ??
    null
  );
}

function getOrderNextStep({
  order,
  canUpdateOrders,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  canUpdateDeliveries
}: {
  order: OrderRow;
  canUpdateOrders: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  canUpdateDeliveries: boolean;
}): OrderNextStep {
  const stage = workflowStageLabel(order, canViewPayments, canViewDeliveries);
  const tone = workflowStageTone(stage);

  if (isTerminalOrder(order)) {
    return {
      label: order.status === "COMPLETED" ? "Review completed order" : "Review order",
      reason: order.status === "COMPLETED" ? "Order is closed." : "No open staff action for this order.",
      ctaLabel: "Review order",
      action: null,
      tone
    };
  }

  if (order.canCompleteOrder) {
    return {
      label: "Complete order",
      reason: canUpdateOrders
        ? "Payment and delivery are complete. Close the order when reviewed."
        : "Payment and delivery are complete, but your role cannot complete orders.",
      ctaLabel: "Complete order",
      action: canUpdateOrders ? "complete" : null,
      blocked: !canUpdateOrders,
      tone: canUpdateOrders ? "success" : "warning"
    };
  }

  if (isDeliveryComplete(order) && hasBalanceDue(order)) {
    if (!canViewPayments) {
      return {
        label: "Payment needs review",
        reason: "Payment details are restricted for your role.",
        ctaLabel: "Review order",
        action: null,
        blocked: true,
        tone: "warning"
      };
    }

    return {
      label: "Record payment",
      reason: canCreatePayments
        ? `${order.balanceAmount} balance remains after delivery.`
        : `${order.balanceAmount} balance remains, but your role cannot record payments.`,
      ctaLabel: "Record payment",
      action: canCreatePayments ? "payment" : null,
      blocked: !canCreatePayments,
      tone: "warning"
    };
  }

  if (order.canScheduleDelivery) {
    if (!canViewDeliveries) {
      return {
        label: "Delivery needs review",
        reason: "Delivery details are restricted for your role.",
        ctaLabel: "Review order",
        action: null,
        blocked: true,
        tone: "teal"
      };
    }

    return {
      label: "Schedule delivery",
      reason: canCreateDeliveries
        ? "Choose a delivery date, provider, and item quantities."
        : "Delivery can be scheduled, but your role cannot create deliveries.",
      ctaLabel: "Schedule delivery",
      action: canCreateDeliveries ? "delivery" : null,
      blocked: !canCreateDeliveries,
      tone: canCreateDeliveries ? "teal" : "warning"
    };
  }

  if (hasBalanceDue(order) && isPaymentDueBeforeDelivery(order)) {
    if (!canViewPayments) {
      return {
        label: "Payment needs review",
        reason: "Payment details are restricted for your role.",
        ctaLabel: "Review order",
        action: null,
        blocked: true,
        tone: "warning"
      };
    }

    return {
      label: "Record payment",
      reason: canCreatePayments
        ? `${order.balanceAmount} balance is still open.`
        : `${order.balanceAmount} balance is still open, but your role cannot record payments.`,
      ctaLabel: "Record payment",
      action: canCreatePayments ? "payment" : null,
      blocked: !canCreatePayments,
      tone: "warning"
    };
  }

  if (isDeliveryScheduled(order) || isDeliveryPartiallyDelivered(order)) {
    const delivery = getDeliveryProgressTarget(order);

    if (!canViewDeliveries) {
      return {
        label: "Delivery needs review",
        reason: "Delivery details are restricted for your role.",
        ctaLabel: "Review order",
        action: null,
        blocked: true,
        tone: "teal"
      };
    }

    return {
      label: "Update delivery progress",
      reason: canUpdateDeliveries
        ? "Delivery is scheduled. Update progress when dispatched or delivered."
        : "Delivery is scheduled, but your role cannot update delivery progress.",
      ctaLabel: "Update delivery progress",
      action: canUpdateDeliveries && delivery ? `deliveryProgress:${delivery.id}` : null,
      blocked: !canUpdateDeliveries || !delivery,
      tone: canUpdateDeliveries ? "teal" : "warning"
    };
  }

  if (isDeliveryComplete(order) && (!canViewPayments || isPaymentPaid(order))) {
    return {
      label: "Review order",
      reason: "Delivery is complete. Review the order details and documents.",
      ctaLabel: "Review order",
      action: null,
      tone
    };
  }

  return {
    label: "Review order",
    reason: workflowStageDescription(order, stage, canViewPayments, canViewDeliveries),
    ctaLabel: "Review order",
    action: null,
    tone
  };
}

function staffDisplayName(name: string | null) {
  if (!name) {
    return "Unassigned";
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
    itemCountLabel(order.items.length),
    staffDisplayName(order.assignedStaff),
    `Updated ${compactUpdatedAtLabel(order.updatedAt)}`
  ]
    .filter(Boolean)
    .join(" · ");
}

function orderDrawerMetaLine(order: OrderRow) {
  return [
    order.relatedQuotationNumber ? `Quote ${order.relatedQuotationNumber}` : null,
    readableLabel(order.sourceType),
    itemCountLabel(order.items.length),
    order.totalAmount
  ]
    .filter(Boolean)
    .join(" · ");
}

function remainingItemLines(order: OrderRow) {
  return order.items.filter((item) => item.remainingQuantity > 0);
}

function remainingItemCountLabel(order: OrderRow) {
  const count = remainingItemLines(order).length;

  return `${count} ${count === 1 ? "item" : "items"} remaining`;
}

function canScheduleDelivery(order: OrderRow, canViewDeliveries: boolean, canCreateDeliveries: boolean) {
  return canViewDeliveries && canCreateDeliveries && order.canScheduleDelivery;
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

  if (canScheduleDelivery(order, canViewDeliveries, canCreateDeliveries)) {
    return "scheduleDelivery";
  }

  if (canViewPayments && canCreatePayments && hasBalanceDue(order) && isPaymentDueBeforeDelivery(order)) {
    return "recordPayment";
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
      label: "Schedule delivery",
      nextLabel: nextActionLabel(order, canViewPayments, canViewDeliveries),
      onClick: onScheduleDelivery
    };
  }

  return {
    kind,
    label: isDetailsOpen ? "Hide details" : "View details",
    nextLabel: nextActionLabel(order, canViewPayments, canViewDeliveries),
    onClick: isDetailsOpen ? onHideDetails : onDetails
  };
}

export function NewOrderLauncher({
  canCreateOrders,
  canViewPayments
}: NewOrderLauncherProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<NewOrderMode>("choices");
  const [quotationOptions, setQuotationOptions] = useState<OptionLoadState<ApprovedQuotationOption>>(
    () => emptyOptionState()
  );
  const [customerOptions, setCustomerOptions] = useState<OptionLoadState<CustomerOption>>(
    () => emptyOptionState()
  );
  const [productOptions, setProductOptions] = useState<OptionLoadState<ProductOption>>(
    () => emptyOptionState()
  );
  useBodyScrollLock(open);

  if (!canCreateOrders) {
    return null;
  }

  async function loadQuotationOptions(query = quotationOptions.query) {
    setQuotationOptions((current) => ({
      ...current,
      query,
      loading: true,
      error: null
    }));

    try {
      const data = await fetchCreateOptions<ApprovedQuotationOption>("quotations", query);
      setQuotationOptions((current) => ({
        ...current,
        ...data,
        query,
        loading: false,
        loaded: true,
        error: null
      }));
    } catch (error) {
      setQuotationOptions((current) => ({
        ...current,
        loading: false,
        loaded: true,
        error: error instanceof Error ? error.message : "Unable to load approved quotations."
      }));
    }
  }

  async function loadCustomerOptions(query = customerOptions.query) {
    setCustomerOptions((current) => ({
      ...current,
      query,
      loading: true,
      error: null
    }));

    try {
      const data = await fetchCreateOptions<CustomerOption>("customers", query);
      setCustomerOptions((current) => ({
        ...current,
        ...data,
        query,
        loading: false,
        loaded: true,
        error: null
      }));
    } catch (error) {
      setCustomerOptions((current) => ({
        ...current,
        loading: false,
        loaded: true,
        error: error instanceof Error ? error.message : "Unable to load customers."
      }));
    }
  }

  async function loadProductOptions(query = productOptions.query) {
    setProductOptions((current) => ({
      ...current,
      query,
      loading: true,
      error: null
    }));

    try {
      const data = await fetchCreateOptions<ProductOption>("products", query);
      setProductOptions((current) => ({
        ...current,
        ...data,
        query,
        loading: false,
        loaded: true,
        error: null
      }));
    } catch (error) {
      setProductOptions((current) => ({
        ...current,
        loading: false,
        loaded: true,
        error: error instanceof Error ? error.message : "Unable to load products."
      }));
    }
  }

  function openPanel() {
    setOpen(true);

    if (!quotationOptions.loaded && !quotationOptions.loading) {
      void loadQuotationOptions("");
    }
  }

  function openManualMode() {
    setMode("manual");

    if (!customerOptions.loaded && !customerOptions.loading) {
      void loadCustomerOptions("");
    }

    if (!productOptions.loaded && !productOptions.loading) {
      void loadProductOptions("");
    }
  }

  function openQuotationMode() {
    setMode("quotation");

    if (!quotationOptions.loaded && !quotationOptions.loading) {
      void loadQuotationOptions("");
    }
  }

  function closePanel() {
    setOpen(false);
    setMode("choices");
  }

  const title =
    mode === "quotation"
      ? "Convert approved quotation"
      : mode === "manual"
        ? "Create manual order"
        : "Create new order";
  const description =
    mode === "quotation"
      ? "Start from a quotation that is already accepted."
      : mode === "manual"
        ? "Build a direct order for negotiated or custom sales."
        : "Start from an approved quotation or create an order manually.";
  const hasApprovedQuotations = quotationOptions.count > 0;
  const firstApprovedQuotation = quotationOptions.items[0] ?? null;
  const firstQuotationSummary = firstApprovedQuotation
    ? [
        firstApprovedQuotation.quotationNumber ?? "No quote number",
        firstApprovedQuotation.customerName,
        firstApprovedQuotation.totalAmount
      ].join(" · ")
    : null;
  const quotationSummary =
    quotationOptions.count === 1 && firstQuotationSummary
      ? `1 ready · ${firstQuotationSummary}`
      : quotationOptions.count > 1
        ? `${quotationOptions.count} approved quotations ready`
        : quotationOptions.loading
          ? "Checking approved quotations..."
          : "No approved quotations ready.";

  return (
    <>
      <Button type="button" onClick={openPanel} className="w-full sm:w-auto">
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
            aria-describedby="new-order-description"
            className={cn(
              "relative ml-auto flex h-full w-full flex-col overflow-hidden border-l border-border bg-panel shadow-xl",
              mode === "choices" ? "max-w-xl" : "max-w-3xl"
            )}
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
                <p id="new-order-description" className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                aria-label="Close create new order panel"
                className="-mr-1 min-h-10 rounded-full px-2 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                onClick={closePanel}
              >
                <X className="h-5 w-5" />
              </Button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-7">
              {mode === "choices" ? (
                <div className="mx-auto w-full max-w-lg">
                  <div className="space-y-3">
                    <button
                      type="button"
                      className="group w-full rounded-lg border border-primary/40 bg-soft-accent/45 p-5 text-left shadow-sm transition hover:border-primary/60 hover:bg-soft-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                      onClick={openManualMode}
                    >
                      <span className="block text-base font-semibold">Manual order</span>
                      <span className="mt-2 block text-sm leading-5 text-muted-foreground">
                        Create an order directly by adding customer, items, payment, delivery, and review details.
                      </span>
                      <span className="mt-4 flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                        <span>Customer</span>
                        <span className="text-muted-foreground" aria-hidden="true">
                          &rarr;
                        </span>
                        <span>Items</span>
                        <span className="text-muted-foreground" aria-hidden="true">
                          &rarr;
                        </span>
                        <span>Payment &amp; delivery</span>
                        <span className="text-muted-foreground" aria-hidden="true">
                          &rarr;
                        </span>
                        <span>Review</span>
                      </span>

                      <span className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-primary/30 bg-primary px-3 text-sm font-semibold text-primary-foreground transition group-hover:bg-primary/90">
                        Start manual order
                      </span>
                    </button>

                    {quotationOptions.loading && !quotationOptions.loaded ? (
                      <article className="rounded-lg border border-border bg-background p-5 text-left">
                        <span className="block h-5 w-44 animate-pulse rounded bg-muted" />
                        <span className="mt-3 block h-4 w-full animate-pulse rounded bg-muted" />
                        <span className="mt-2 block h-4 w-3/4 animate-pulse rounded bg-muted" />
                      </article>
                    ) : hasApprovedQuotations ? (
                      <button
                        type="button"
                        className="w-full rounded-lg border border-border bg-background p-5 text-left transition hover:border-primary/35 hover:bg-soft-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                        onClick={openQuotationMode}
                      >
                        <span className="block text-base font-semibold">From approved quotation</span>
                        <span className="mt-2 block text-sm leading-5 text-muted-foreground">
                          Start with customer, pricing, and items already approved.
                        </span>

                        <span className="mt-4 block text-sm font-medium text-foreground">
                          {quotationSummary}
                        </span>
                        {quotationOptions.count > 1 && firstQuotationSummary ? (
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            Next: {firstQuotationSummary}
                          </span>
                        ) : null}

                        <span className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border bg-panel px-3 text-sm font-semibold text-foreground transition hover:bg-muted">
                          Continue with quotation
                        </span>
                      </button>
                    ) : (
                      <article className="rounded-lg border border-dashed border-border bg-background/65 p-5 text-left opacity-85">
                        <span className="block text-base font-semibold text-muted-foreground">
                          From approved quotation
                        </span>
                        <span className="mt-2 block text-sm leading-5 text-muted-foreground">
                          Start with customer, pricing, and items already approved.
                        </span>
                        <span className="mt-4 block rounded-md border border-border bg-panel px-3 py-2 text-sm font-medium text-muted-foreground">
                          No approved quotations available.
                        </span>
                        <Link
                          href="/quotations"
                          className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border bg-panel px-3 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                        >
                          View quotations
                        </Link>
                      </article>
                    )}

                    <div className="rounded-lg border border-border bg-panel px-4 py-3 text-xs leading-5 text-muted-foreground">
                      New orders appear in the work queue for payment, delivery, and documents.
                    </div>
                  </div>
                </div>
              ) : null}

              {mode === "quotation" ? (
                <ConvertApprovedQuotationForm
                  approvedQuotations={quotationOptions.items}
                  approvedQuotationCount={quotationOptions.count}
                  loading={quotationOptions.loading}
                  error={quotationOptions.error}
                  query={quotationOptions.query}
                  onQueryChange={(query) =>
                    setQuotationOptions((current) => ({
                      ...current,
                      query
                    }))
                  }
                  onSearch={() => void loadQuotationOptions(quotationOptions.query)}
                />
              ) : null}

              {mode === "manual" ? (
                <ManualOrderForm
                  canViewPayments={canViewPayments}
                  customers={customerOptions.items}
                  customerCount={customerOptions.count}
                  customersLoading={customerOptions.loading}
                  customersError={customerOptions.error}
                  customerQuery={customerOptions.query}
                  onCustomerQueryChange={(query) =>
                    setCustomerOptions((current) => ({
                      ...current,
                      query
                    }))
                  }
                  onCustomerSearch={() => void loadCustomerOptions(customerOptions.query)}
                  products={productOptions.items}
                  productCount={productOptions.count}
                  productsLoading={productOptions.loading}
                  productsError={productOptions.error}
                  productQuery={productOptions.query}
                  onProductQueryChange={(query) =>
                    setProductOptions((current) => ({
                      ...current,
                      query
                    }))
                  }
                  onProductSearch={() => void loadProductOptions(productOptions.query)}
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
  approvedQuotations,
  approvedQuotationCount,
  loading,
  error,
  query,
  onQueryChange,
  onSearch
}: {
  approvedQuotations: ApprovedQuotationOption[];
  approvedQuotationCount: number;
  loading: boolean;
  error: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
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
  const hiddenMatchingCount = Math.max(approvedQuotationCount - approvedQuotations.length, 0);

  useEffect(() => {
    if (!selectedQuotationId && approvedQuotations.length === 1) {
      setSelectedQuotationId(approvedQuotations[0]?.id ?? "");
    }
  }, [approvedQuotations, selectedQuotationId]);

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    onSearch();
  }

  return (
    <form action={convertAction} className="max-w-3xl space-y-4">
      <input type="hidden" name="quotationId" value={selectedQuotationId} />

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search quotation number or customer"
          aria-label="Search approved quotations"
        />
        <Button type="button" variant="secondary" onClick={onSearch} disabled={loading}>
          Search
        </Button>
      </div>

      {error ? (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      {approvedQuotations.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3" role="radiogroup" aria-label="Approved quotations">
            {hiddenMatchingCount > 0 ? (
              <p className="rounded-md bg-panel px-3 py-2 text-xs text-muted-foreground">
                Showing first {approvedQuotations.length} of {approvedQuotationCount} matching quotations. Search to narrow the list.
              </p>
            ) : null}
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
          {loading
            ? "Loading approved quotations..."
            : "No approved quotations ready. Approve a quotation before converting it into an order."}
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
  customerCount,
  customersLoading,
  customersError,
  customerQuery,
  onCustomerQueryChange,
  onCustomerSearch,
  products,
  productCount,
  productsLoading,
  productsError,
  productQuery,
  onProductQueryChange,
  onProductSearch
}: {
  canViewPayments: boolean;
  customers: CustomerOption[];
  customerCount: number;
  customersLoading: boolean;
  customersError: string | null;
  customerQuery: string;
  onCustomerQueryChange: (query: string) => void;
  onCustomerSearch: () => void;
  products: ProductOption[];
  productCount: number;
  productsLoading: boolean;
  productsError: string | null;
  productQuery: string;
  onProductQueryChange: (query: string) => void;
  onProductSearch: () => void;
}) {
  const [manualState, manualAction, manualPending] = useActionState(
    createManualOrderAction,
    initialState
  );
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
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
    const product = selectedProduct ?? products.find((candidate) => candidate.id === selectedProductId);

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
    setSelectedProduct(null);
  }

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
              quantity:
                patch.quantity === undefined
                  ? item.quantity
                  : normalizeIntegerQuantity(patch.quantity, { min: 1 })
            }
          : item
      )
    );
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addCustomItem() {
    setItems((current) => [...current, createCustomItem(current.length)]);
  }

  const customerChoices =
    selectedCustomer && !customers.some((customer) => customer.id === selectedCustomer.id)
      ? [selectedCustomer, ...customers]
      : customers;
  const productChoices =
    selectedProduct && !products.some((product) => product.id === selectedProduct.id)
      ? [selectedProduct, ...products]
      : products;
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

  function handleCustomerSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    onCustomerSearch();
  }

  function handleProductSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    onProductSearch();
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
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                value={customerQuery}
                onChange={(event) => onCustomerQueryChange(event.target.value)}
                onKeyDown={handleCustomerSearchKeyDown}
                placeholder="Search customer name, company, or contact"
                aria-label="Search customers for manual order"
              />
              <Button type="button" variant="secondary" onClick={onCustomerSearch} disabled={customersLoading}>
                Search
              </Button>
            </div>
            {customersError ? (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{customersError}</p>
            ) : null}
            {customerCount > customerChoices.length ? (
              <p className="text-xs text-muted-foreground">
                Showing first {customerChoices.length} of {customerCount} matching customers. Search to narrow the list.
              </p>
            ) : null}
            {customerChoices.length > 0 ? (
              <label className="max-w-xl space-y-2 text-sm font-medium">
                Customer
                <Select
                  name="customerId"
                  required
                  value={customerId}
                  onChange={(event) => {
                    const nextCustomer =
                      customerChoices.find((customer) => customer.id === event.target.value) ?? null;
                    setCustomerId(event.target.value);
                    setSelectedCustomer(nextCustomer);
                  }}
                >
                  <option value="" disabled>
                    {customersLoading ? "Loading customers..." : "Choose customer"}
                  </option>
                  {customerChoices.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.displayName}
                      {customer.companyName ? ` - ${customer.companyName}` : ""}
                    </option>
                  ))}
                </Select>
              </label>
            ) : (
              <div className="studio-empty px-4 py-4 text-sm">
                {customersLoading
                  ? "Loading customers..."
                  : "No matching customers found. Add a customer record before creating a manual order."}
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
              <Input
                value={productQuery}
                onChange={(event) => onProductQueryChange(event.target.value)}
                onKeyDown={handleProductSearchKeyDown}
                placeholder="Search catalog item, code, or category"
                aria-label="Search products for manual order"
              />
              <Button type="button" variant="secondary" onClick={onProductSearch} disabled={productsLoading}>
                Search
              </Button>
            </div>
            {productsError ? (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{productsError}</p>
            ) : null}
            {productCount > productChoices.length ? (
              <p className="text-xs text-muted-foreground">
                Showing first {productChoices.length} of {productCount} matching catalog items. Search to narrow the list.
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Select
                value={selectedProductId}
                onChange={(event) => {
                  const nextProduct =
                    productChoices.find((product) => product.id === event.target.value) ?? null;
                  setSelectedProductId(event.target.value);
                  setSelectedProduct(nextProduct);
                }}
                aria-label="Catalog product"
              >
                <option value="">
                  {productsLoading ? "Loading catalog items..." : "Choose active catalog item"}
                </option>
                {productChoices.map((product) => (
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
                      <IntegerInput
                        value={item.quantity}
                        onValueChange={(value) => updateItem(index, { quantity: value })}
                        min={1}
                        fallback={1}
                        aria-label="Quantity"
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      Unit price
                      <DecimalInput
                        value={item.unitPrice}
                        onValueChange={(value) => updateItem(index, { unitPrice: value })}
                        min={0}
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
                        <DecimalInput
                          value={item.discountValue}
                          disabled={!item.discountType}
                          onValueChange={(value) => updateItem(index, { discountValue: value })}
                          min={0}
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
                      <DecimalInput
                        value={item.unitCostSnapshot}
                        onValueChange={(value) => updateItem(index, { unitCostSnapshot: value })}
                        min={0}
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
              Needs assemble
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
                placeholder="Assemble, access, timing, or client reminders"
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
              <p className="font-semibold">Delivery, assemble, invoice</p>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Assemble</span>
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
            <DecimalInput
              name="orderDiscountValue"
              value={orderDiscountValue}
              disabled={!orderDiscountType}
              onValueChange={setOrderDiscountValue}
              min={0}
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
  canDeleteOrders,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  canUpdateDeliveries,
  canExportDocuments,
  canCreateCustomers,
  canViewProducts,
  initialSelectedOrderId,
  orders,
  customers,
  products,
  staffOptions,
  persistenceUserKey
}: OrderListProps) {
  const initialWorkspaceDraft: OrderWorkspaceDraft = {
    selectedOrderId: initialSelectedOrderId ?? null,
    activePanelAction: null
  };
  const [workspaceDraft, setWorkspaceDraft, workspacePersistence] =
    usePersistentPageState<OrderWorkspaceDraft>({
      scope: "orders",
      userKey: persistenceUserKey,
      version: 1,
      initialState: initialWorkspaceDraft
    });
  const hasAppliedWorkspaceDraft = useRef(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialSelectedOrderId && orders.some((order) => order.id === initialSelectedOrderId)
      ? initialSelectedOrderId
      : null
  );
  const [activePanelAction, setActivePanelAction] = useState<ActiveOrderPanelAction | null>(null);
  const [pendingOrderAction, setPendingOrderAction] = useState<PendingOrderAction>(null);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null;

  useEffect(() => {
    if (!workspacePersistence.restored || hasAppliedWorkspaceDraft.current) {
      return;
    }

    hasAppliedWorkspaceDraft.current = true;

    if (initialSelectedOrderId && orders.some((order) => order.id === initialSelectedOrderId)) {
      setSelectedOrderId(initialSelectedOrderId);
      setActivePanelAction(null);
      return;
    }

    const restoredOrderId =
      workspaceDraft.selectedOrderId &&
      orders.some((order) => order.id === workspaceDraft.selectedOrderId)
        ? workspaceDraft.selectedOrderId
        : null;
    const restoredAction =
      workspaceDraft.activePanelAction &&
      restoredOrderId === workspaceDraft.activePanelAction.orderId
        ? workspaceDraft.activePanelAction
        : null;

    setSelectedOrderId(restoredOrderId);
    setActivePanelAction(restoredAction);
  }, [
    initialSelectedOrderId,
    orders,
    workspaceDraft.activePanelAction,
    workspaceDraft.selectedOrderId,
    workspacePersistence.restored
  ]);

  useEffect(() => {
    if (!workspacePersistence.restored || !hasAppliedWorkspaceDraft.current) {
      return;
    }

    setWorkspaceDraft({
      selectedOrderId,
      activePanelAction
    });
  }, [
    activePanelAction,
    selectedOrderId,
    setWorkspaceDraft,
    workspacePersistence.restored
  ]);

  useEffect(() => {
    if (initialSelectedOrderId && orders.some((order) => order.id === initialSelectedOrderId)) {
      setSelectedOrderId(initialSelectedOrderId);
    }
  }, [initialSelectedOrderId, orders]);

  function openDetails(orderId: string) {
    setSelectedOrderId(orderId);
    setActivePanelAction(null);
  }

  function openAction(orderId: string, action: OpenOrderAction, source: OrderActionSource = "next") {
    setSelectedOrderId(orderId);
    setActivePanelAction({ orderId, action, source });
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
              canUpdateOrders={canUpdateOrders}
              canDeleteOrders={canDeleteOrders}
              canCreatePayments={canCreatePayments}
              canViewDeliveries={canViewDeliveries}
              canCreateDeliveries={canCreateDeliveries}
              canExportDocuments={canExportDocuments}
              isDetailsOpen={selectedOrderId === order.id}
              onDetails={() => openDetails(order.id)}
              onHideDetails={() => setSelectedOrderId(null)}
              onRecordPayment={() => openAction(order.id, "payment")}
              onScheduleDelivery={() => openDetails(order.id)}
              onCancelOrder={() => setPendingOrderAction({ type: "cancel", order })}
              onDeleteOrder={() => setPendingOrderAction({ type: "delete", order })}
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
          key={selectedOrder.id}
          order={selectedOrder}
          activeAction={activePanelAction?.orderId === selectedOrder.id ? activePanelAction.action : null}
          activeActionSource={activePanelAction?.orderId === selectedOrder.id ? activePanelAction.source : null}
          canUpdateOrders={canUpdateOrders}
          canViewPayments={canViewPayments}
          canCreatePayments={canCreatePayments}
          canViewDeliveries={canViewDeliveries}
          canCreateDeliveries={canCreateDeliveries}
              canUpdateDeliveries={canUpdateDeliveries}
              canExportDocuments={canExportDocuments}
              canCreateCustomers={canCreateCustomers}
              canViewProducts={canViewProducts}
              customers={customers}
              products={products}
              staffOptions={staffOptions}
          persistenceUserKey={persistenceUserKey}
          onClose={() => {
            setSelectedOrderId(null);
            setActivePanelAction(null);
          }}
          onActionChange={(action, source = "section") =>
            setActivePanelAction(action ? { orderId: selectedOrder.id, action, source } : null)
          }
        />
      ) : null}

      <OrderActionDialog
        pendingAction={pendingOrderAction}
        onClose={() => setPendingOrderAction(null)}
      />
    </>
  );
}

function OrderCard({
  order,
  canUpdateOrders,
  canDeleteOrders,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  canExportDocuments,
  isDetailsOpen,
  onDetails,
  onHideDetails,
  onRecordPayment,
  onScheduleDelivery,
  onCancelOrder,
  onDeleteOrder
}: {
  order: OrderRow;
  canUpdateOrders: boolean;
  canDeleteOrders: boolean;
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
  onCancelOrder: () => void;
  onDeleteOrder: () => void;
}) {
  const showPaymentAction = canViewPayments && canCreatePayments && !isTerminalOrder(order) && hasBalanceDue(order);
  const showDeliveryAction = canScheduleDelivery(order, canViewDeliveries, canCreateDeliveries);
  const workflowStage = workflowStageLabel(order, canViewPayments, canViewDeliveries);
  const workflowTone = workflowStageTone(workflowStage);
  const workflowDescription = workflowStageDescription(order, workflowStage, canViewPayments, canViewDeliveries);
  const paymentSupport = paymentSupportSummary(order);
  const deliverySupport = deliverySupportSummary(order);
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

  function handleDetailsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onDetails();
  }

  return (
    <article className={cn("group bg-panel transition", isDetailsOpen ? "bg-primary/5" : "hover:bg-muted/25")}>
      <div className="grid gap-3 px-4 py-3 text-sm sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(150px,auto)] lg:items-center">
        <div
          role="button"
          tabIndex={0}
          aria-label={`Open details for ${order.displayId} ${order.customerName}`}
          onClick={onDetails}
          onKeyDown={handleDetailsKeyDown}
          className={cn(
            "-m-2 grid min-w-0 cursor-pointer gap-3 rounded-md p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 md:grid-cols-2",
            canViewPayments && canViewDeliveries
              ? "xl:grid-cols-[minmax(220px,1.35fr)_minmax(210px,1fr)_minmax(130px,.62fr)_minmax(150px,.72fr)]"
              : canViewPayments || canViewDeliveries
                ? "xl:grid-cols-[minmax(220px,1.35fr)_minmax(210px,1fr)_minmax(150px,.72fr)]"
                : "xl:grid-cols-[minmax(220px,1.35fr)_minmax(210px,1fr)]"
          )}
        >
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">
              {order.displayId} · {order.customerName}
            </h2>
            <p className="mt-1 truncate text-xs text-muted-foreground">{orderMetaLine(order)}</p>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Workflow</p>
            <div className="mt-1 [&_span]:px-2 [&_span]:py-0.5">
              <StatusPill tone={workflowTone}>{workflowStage}</StatusPill>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{workflowDescription}</p>
          </div>

          {canViewPayments ? (
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment</p>
              <div className="mt-1 [&_span]:px-2 [&_span]:py-0.5">
                <StatusPill tone={!hasBalanceDue(order) ? "success" : statusTone(order.paymentStatus)}>
                  {paymentSupport.label}
                </StatusPill>
              </div>
              <p className="mt-1 truncate font-semibold tabular-nums">{paymentSupport.value}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{paymentSupport.detail}</p>
            </div>
          ) : null}

          {canViewDeliveries ? (
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Delivery</p>
              <p className="mt-1 truncate font-semibold">{deliverySupport.value}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{deliverySupport.detail}</p>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 items-center justify-between gap-1.5 border-t border-border pt-3 lg:justify-end lg:border-t-0 lg:pt-0">
          <div className="min-w-0 truncate text-xs font-medium text-muted-foreground lg:hidden">
            {primaryAction.nextLabel}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              className="h-9 min-h-9 min-w-[8.75rem] shrink-0 justify-center whitespace-nowrap px-3 text-xs"
              onClick={primaryAction.onClick}
            >
              {primaryAction.kind === "recordPayment" ? <ReceiptText className="h-3.5 w-3.5" /> : null}
              {primaryAction.kind === "scheduleDelivery" ? <Truck className="h-3.5 w-3.5" /> : null}
              {primaryAction.label}
            </Button>
            <OrderCardMoreActions
              order={order}
              primaryActionKind={primaryAction.kind}
              canUpdateOrders={canUpdateOrders}
              canDeleteOrders={canDeleteOrders}
              canExportDocuments={canExportDocuments}
              isDetailsOpen={isDetailsOpen}
              showPaymentAction={showPaymentAction}
              showDeliveryAction={showDeliveryAction}
              onDetails={onDetails}
              onHideDetails={onHideDetails}
              onRecordPayment={onRecordPayment}
              onScheduleDelivery={onScheduleDelivery}
              onCancelOrder={onCancelOrder}
              onDeleteOrder={onDeleteOrder}
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
  canUpdateOrders,
  canDeleteOrders,
  canExportDocuments,
  isDetailsOpen,
  showPaymentAction,
  showDeliveryAction,
  onDetails,
  onHideDetails,
  onRecordPayment,
  onScheduleDelivery,
  onCancelOrder,
  onDeleteOrder
}: {
  order: OrderRow;
  primaryActionKind: OrderCardPrimaryActionKind;
  canUpdateOrders: boolean;
  canDeleteOrders: boolean;
  canExportDocuments: boolean;
  isDetailsOpen: boolean;
  showPaymentAction: boolean;
  showDeliveryAction: boolean;
  onDetails: () => void;
  onHideDetails: () => void;
  onRecordPayment: () => void;
  onScheduleDelivery: () => void;
  onCancelOrder: () => void;
  onDeleteOrder: () => void;
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
  const showCancelAction = canUpdateOrders && !["COMPLETED", "CANCELLED"].includes(order.status);
  const canShowMenu =
    showDetailsAction ||
    showPaymentMenuAction ||
    showDeliveryMenuAction ||
    showCancelAction ||
    canDeleteOrders ||
    canExportDocuments;

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
              Hide details
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
              View details
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
              Schedule delivery
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
          {showCancelAction ? (
            <Button
              type="button"
              variant="ghost"
              role="menuitem"
              className="min-h-9 justify-start rounded-md px-3 text-danger hover:text-danger"
              onClick={() => {
                closeMenu();
                onCancelOrder();
              }}
            >
              <X className="h-4 w-4" />
              Cancel order
            </Button>
          ) : null}
          {canDeleteOrders ? (
            <Button
              type="button"
              variant="ghost"
              role="menuitem"
              className="min-h-9 justify-start rounded-md px-3 text-danger hover:text-danger"
              onClick={() => {
                closeMenu();
                onDeleteOrder();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete order
            </Button>
          ) : null}
          {/* Add Edit order here once a real edit route/server action exists, gated by canUpdateOrders. */}
        </div>
      ) : null}
    </>
  );
}

function OrderActionDialog({
  pendingAction,
  onClose
}: {
  pendingAction: PendingOrderAction;
  onClose: () => void;
}) {
  if (!pendingAction) {
    return null;
  }

  return pendingAction.type === "cancel" ? (
    <CancelOrderDialog order={pendingAction.order} onClose={onClose} />
  ) : (
    <DeleteOrderDialog order={pendingAction.order} onClose={onClose} />
  );
}

function OrderDialogShell({
  title,
  children,
  onClose
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-action-dialog-title"
        className="w-full max-w-lg rounded-lg border border-border bg-panel p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="order-action-dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function CancelOrderDialog({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(cancelOrderAction, initialState);
  const activeDeliveries = order.deliveries.filter((delivery) =>
    !["DELIVERED", "CANCELLED", "FAILED"].includes(delivery.status)
  );

  useEffect(() => {
    if (state.ok) {
      onClose();
      router.refresh();
    }
  }, [onClose, router, state.ok]);

  return (
    <OrderDialogShell title="Cancel order" onClose={onClose}>
      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="orderId" value={order.id} />
        <p className="text-sm leading-6 text-muted-foreground">
          Cancel order {order.displayId}? This will stop active delivery workflow for this order but keep order history.
        </p>
        {order.payments.length > 0 ? (
          <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
            This order has recorded payment history. Cancelling will not remove or refund payments.
          </p>
        ) : null}
        {activeDeliveries.length > 0 ? (
          <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
            Active delivery schedules will be cancelled.
          </p>
        ) : null}
        <label className="block space-y-2 text-sm font-medium">
          Cancellation reason optional
          <Textarea name="cancellationReason" maxLength={1000} />
        </label>
        {state.message ? (
          <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
            Keep order
          </Button>
          <Button type="submit" variant="danger" disabled={pending}>
            Cancel order
          </Button>
        </div>
      </form>
    </OrderDialogShell>
  );
}

function DeleteOrderDialog({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteOrderAction, initialState);
  const hasProtectedHistory = order.payments.length > 0 || order.deliveries.length > 0 || order.documents.length > 0;

  useEffect(() => {
    if (state.ok) {
      onClose();
      router.refresh();
    }
  }, [onClose, router, state.ok]);

  return (
    <OrderDialogShell title="Delete order" onClose={onClose}>
      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="orderId" value={order.id} />
        <p className="text-sm leading-6 text-muted-foreground">
          Delete order {order.displayId}? This permanently removes the order if it has no protected payment,
          delivery, or document history.
        </p>
        {hasProtectedHistory ? (
          <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
            Orders with payments, delivered deliveries, or documents should be cancelled instead of deleted.
          </p>
        ) : null}
        {state.message ? (
          <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
            Keep order
          </Button>
          <Button type="submit" variant="danger" disabled={pending}>
            Delete order
          </Button>
        </div>
      </form>
    </OrderDialogShell>
  );
}

function OrderDetailPanel({
  order,
  activeAction,
  activeActionSource,
  canUpdateOrders,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  canUpdateDeliveries,
  canExportDocuments,
  canCreateCustomers,
  canViewProducts,
  customers,
  products,
  staffOptions,
  persistenceUserKey,
  onClose,
  onActionChange
}: {
  order: OrderRow;
  activeAction: ActiveOrderAction;
  activeActionSource: OrderActionSource | null;
  canUpdateOrders: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  canUpdateDeliveries: boolean;
  canExportDocuments: boolean;
  canCreateCustomers: boolean;
  canViewProducts: boolean;
  customers: CustomerOption[];
  products: ProductOption[];
  staffOptions: StaffOption[];
  persistenceUserKey?: string | null;
  onClose: () => void;
  onActionChange: (actionKey: ActiveOrderAction, source?: OrderActionSource) => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const [detailDraft, setDetailDraft, detailPersistence] =
    usePersistentPageState<OrderDetailPanelDraft>({
      scope: `orders:${order.id}:details`,
      userKey: persistenceUserKey,
      version: 1,
      initialState: {
        activeDetailTab: "overview"
      }
    });
  const hasAppliedDetailDraft = useRef(false);
  const [activeDetailTab, setActiveDetailTab] = useState<OrderDetailTab>("overview");
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [isEditingItems, setIsEditingItems] = useState(false);
  const nextStep = getOrderNextStep({
    order,
    canUpdateOrders,
    canViewPayments,
    canCreatePayments,
    canViewDeliveries,
    canCreateDeliveries,
    canUpdateDeliveries
  });
  useBodyScrollLock(true);
  const closePanel = useCallback(() => {
    if ((isEditingCustomer || isEditingItems) && !window.confirm("Discard unsaved changes and close order details?")) {
      return;
    }

    onClose();
  }, [isEditingCustomer, isEditingItems, onClose]);

  useEffect(() => {
    if (!detailPersistence.restored || hasAppliedDetailDraft.current) {
      return;
    }

    hasAppliedDetailDraft.current = true;
    setActiveDetailTab(
      orderDetailTabs.some((tab) => tab.key === detailDraft.activeDetailTab)
        ? detailDraft.activeDetailTab
        : "overview"
    );
  }, [detailDraft.activeDetailTab, detailPersistence.restored]);

  useEffect(() => {
    if (!detailPersistence.restored || !hasAppliedDetailDraft.current) {
      return;
    }

    setDetailDraft({ activeDetailTab });
  }, [activeDetailTab, detailPersistence.restored, setDetailDraft]);

  useEffect(() => {
    panelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePanel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePanel, order.id]);

  function handleDeliverySuccess() {
    if (canViewPayments && canCreatePayments && order.balanceAmountValue > 0) {
      setActiveDetailTab("payments");
      onActionChange("payment", "section");
      return;
    }

    setActiveDetailTab("deliveries");
    onActionChange(null, "section");
  }

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close order details"
        className="absolute inset-0 bg-foreground/25"
        onClick={closePanel}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
        aria-describedby="order-detail-description"
        tabIndex={-1}
        className={cn(
          "relative ml-auto flex h-full w-full flex-col overflow-hidden border-l border-border bg-background shadow-xl focus-visible:outline-none",
          activeDetailTab === "items" && isEditingItems
            ? "max-w-full lg:w-[66vw] lg:max-w-[1200px]"
            : "max-w-[780px]"
        )}
      >
        <OrderPanelHeader
          order={order}
          canViewPayments={canViewPayments}
          canViewDeliveries={canViewDeliveries}
          onClose={closePanel}
        />

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <p id="order-detail-description" className="sr-only">
            Order details for {order.displayId} and {order.customerName}.
          </p>
          <div className="w-full space-y-6 pb-10">
            <OrderNextStepCard
              order={order}
              nextStep={nextStep}
              activeAction={activeActionSource === "next" ? activeAction : null}
              canUpdateOrders={canUpdateOrders}
              canViewPayments={canViewPayments}
              canCreatePayments={canCreatePayments}
              canViewDeliveries={canViewDeliveries}
              canCreateDeliveries={canCreateDeliveries}
              canUpdateDeliveries={canUpdateDeliveries}
              staffOptions={staffOptions}
              onActionChange={(action) => onActionChange(action, "next")}
              onDeliverySuccess={handleDeliverySuccess}
            />
            <div className="space-y-5">
              <OrderDetailTabs activeTab={activeDetailTab} onTabChange={setActiveDetailTab} />
              {activeDetailTab === "overview" ? (
                <OrderOverviewSummary
                  order={order}
                  canViewPayments={canViewPayments}
                  canViewDeliveries={canViewDeliveries}
                />
              ) : null}
              {activeDetailTab === "customer" ? (
                <CustomerSection
                  order={order}
                  customers={customers}
                  canUpdateOrders={canUpdateOrders}
                  canCreateCustomers={canCreateCustomers}
                  persistenceUserKey={persistenceUserKey}
                  isEditing={isEditingCustomer}
                  setIsEditing={setIsEditingCustomer}
                />
              ) : null}
              {activeDetailTab === "items" ? (
                <ItemsSection
                  order={order}
                  canViewPayments={canViewPayments}
                  canViewDeliveries={canViewDeliveries}
                  canUpdateOrders={canUpdateOrders}
                  canViewProducts={canViewProducts}
                  products={products}
                  isEditing={isEditingItems}
                  setIsEditing={setIsEditingItems}
                />
              ) : null}
              {activeDetailTab === "payments" ? (
                <PaymentSection
                  order={order}
                  canUpdateOrders={canUpdateOrders}
                  canViewPayments={canViewPayments}
                  canCreatePayments={canCreatePayments}
                  activeAction={activeActionSource === "section" ? activeAction : null}
                  onActionChange={(action) => onActionChange(action, "section")}
                />
              ) : null}
              {activeDetailTab === "deliveries" ? (
                <DeliverySection
                  order={order}
                  canViewDeliveries={canViewDeliveries}
                  canCreateDeliveries={canCreateDeliveries}
                  canUpdateDeliveries={canUpdateDeliveries}
                  staffOptions={staffOptions}
                  activeAction={activeActionSource === "section" ? activeAction : null}
                  onActionChange={(action) => onActionChange(action, "section")}
                  onDeliverySuccess={handleDeliverySuccess}
                />
              ) : null}
              {activeDetailTab === "documents" ? (
                <DocumentsSection order={order} canExportDocuments={canExportDocuments} />
              ) : null}
              {activeDetailTab === "notes" ? (
                <NotesSection
                  order={order}
                  canViewPayments={canViewPayments}
                  canViewDeliveries={canViewDeliveries}
                />
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function OrderPanelHeader({
  order,
  canViewPayments,
  canViewDeliveries,
  onClose
}: {
  order: OrderRow;
  canViewPayments: boolean;
  canViewDeliveries: boolean;
  onClose: () => void;
}) {
  const workflowStage = workflowStageLabel(order, canViewPayments, canViewDeliveries);
  const headerDeliveryStatus = visibleDeliveryStatus(order);
  const showDeliveryStatusBadge =
    canViewDeliveries && !(workflowStage === "Scheduled" && isDeliveryScheduled(order));

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-5 backdrop-blur">
      <div className="w-full">
        <div className="flex items-start justify-between gap-4">
          <h2 id="order-detail-title" className="min-w-0 text-[21px] font-semibold leading-7">
            <span className="tabular-nums">{order.displayId}</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span>{order.customerName}</span>
          </h2>
          <Button
            type="button"
            variant="ghost"
            aria-label="Close order details"
            className="h-9 min-h-9 w-9 shrink-0 rounded-md p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close order details</span>
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <StatusPill tone={workflowStageTone(workflowStage)}>{workflowStage}</StatusPill>
          {canViewPayments ? (
            <StatusPill tone={statusTone(order.paymentStatus)}>
              {paymentStatusLabel(order.paymentStatus)}
            </StatusPill>
          ) : null}
          {showDeliveryStatusBadge ? (
            <StatusPill tone={statusTone(headerDeliveryStatus)}>
              {deliveryStatusLabel(headerDeliveryStatus)}
            </StatusPill>
          ) : null}
          {canViewDeliveries ? (
            <span className="inline-flex min-h-6 items-center rounded-full border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground">
              {remainingItemCountLabel(order)}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-[14px] leading-6 text-muted-foreground">{orderDrawerMetaLine(order)}</p>
      </div>
    </header>
  );
}

function OrderNextStepCard({
  order,
  nextStep,
  activeAction,
  canUpdateOrders,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  canUpdateDeliveries,
  staffOptions,
  onActionChange,
  onDeliverySuccess
}: {
  order: OrderRow;
  nextStep: OrderNextStep;
  activeAction: ActiveOrderAction;
  canUpdateOrders: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  canUpdateDeliveries: boolean;
  staffOptions: StaffOption[];
  onActionChange: (actionKey: ActiveOrderAction) => void;
  onDeliverySuccess: () => void;
}) {
  const formAction = nextStep.action && nextStep.action !== "complete" ? nextStep.action : null;
  const isExpanded = formAction !== null && activeAction === formAction;
  const expandedAction = activeAction;
  const showActionButton = !(order.status === "COMPLETED" && !nextStep.action);

  function handleReviewClick() {
    document.getElementById("order-summary")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <section
      className={cn(
        "rounded-lg border bg-panel p-5 shadow-sm sm:p-6",
        nextStep.tone === "warning"
          ? "border-warning/25"
          : nextStep.tone === "success"
            ? "border-success/25"
            : "border-primary/20"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">Next action</p>
          <h3 className="mt-1 text-[19px] font-semibold leading-7">{nextStep.label}</h3>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-muted-foreground">{nextStep.reason}</p>
        </div>
        {showActionButton ? (
          <div className="shrink-0">
            {nextStep.action === "complete" && canUpdateOrders ? (
              <CompleteOrderForm order={order} variant="primary" buttonClassName="w-full sm:w-auto" />
            ) : (
              <Button
                type="button"
                variant={isExpanded || !formAction || nextStep.blocked ? "secondary" : "primary"}
                disabled={nextStep.blocked}
                className="w-full sm:w-auto"
                onClick={() => {
                  if (formAction) {
                    onActionChange(isExpanded ? null : formAction);
                    return;
                  }

                  onActionChange(null);
                  handleReviewClick();
                }}
              >
                {nextStep.action === "payment" ? <ReceiptText className="h-4 w-4" /> : null}
                {nextStep.action === "delivery" ? <Truck className="h-4 w-4" /> : null}
                {typeof nextStep.action === "string" && nextStep.action.startsWith("deliveryProgress:") ? (
                  <Save className="h-4 w-4" />
                ) : null}
                {isExpanded ? "Close" : nextStep.ctaLabel}
              </Button>
            )}
          </div>
        ) : null}
      </div>
      {isExpanded && expandedAction ? (
        <div className="mt-6 border-t border-border/70 pt-5">
          <OrderInlineActionForm
            order={order}
            action={expandedAction}
            canUpdateOrders={canUpdateOrders}
            canViewPayments={canViewPayments}
            canCreatePayments={canCreatePayments}
            canViewDeliveries={canViewDeliveries}
            canCreateDeliveries={canCreateDeliveries}
            canUpdateDeliveries={canUpdateDeliveries}
            staffOptions={staffOptions}
            onDeliverySuccess={onDeliverySuccess}
          />
        </div>
      ) : null}
    </section>
  );
}

function OrderInlineActionForm({
  order,
  action,
  canUpdateOrders,
  canViewPayments,
  canCreatePayments,
  canViewDeliveries,
  canCreateDeliveries,
  canUpdateDeliveries,
  staffOptions,
  onDeliverySuccess
}: {
  order: OrderRow;
  action: OpenOrderAction;
  canUpdateOrders: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  canUpdateDeliveries: boolean;
  staffOptions: StaffOption[];
  onDeliverySuccess: () => void;
}) {
  const deliveryProgressId = action.startsWith("deliveryProgress:")
    ? action.replace("deliveryProgress:", "")
    : null;
  const delivery = deliveryProgressId
    ? order.deliveries.find((candidate) => candidate.id === deliveryProgressId)
    : null;

  if (action === "payment") {
    return canViewPayments && canCreatePayments && !isTerminalOrder(order) ? (
      <PaymentForm order={order} />
    ) : (
      <RestrictedPanel title="payment actions" />
    );
  }

  if (action === "paymentDue") {
    return canUpdateOrders && canViewPayments && !isTerminalOrder(order) ? (
      <PaymentDueTimingForm order={order} />
    ) : (
      <RestrictedPanel title="payment due timing" />
    );
  }

  if (action === "delivery") {
    if (!canViewDeliveries || !canCreateDeliveries) {
      return <RestrictedPanel title="delivery actions" />;
    }

    return order.canScheduleDelivery ? (
      <DeliveryForm order={order} staffOptions={staffOptions} onSuccess={onDeliverySuccess} />
    ) : (
      <DeliveryBlockedPanel order={order} />
    );
  }

  if (!delivery || !canViewDeliveries || !canUpdateDeliveries) {
    return <RestrictedPanel title="delivery progress" />;
  }

  return <DeliveryProgressForm delivery={delivery} />;
}

const orderDetailTabs: Array<{ key: OrderDetailTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "customer", label: "Customer" },
  { key: "items", label: "Items" },
  { key: "payments", label: "Payments" },
  { key: "deliveries", label: "Deliveries" },
  { key: "documents", label: "Documents" },
  { key: "notes", label: "Notes" }
];

function OrderDetailTabs({
  activeTab,
  onTabChange
}: {
  activeTab: OrderDetailTab;
  onTabChange: (tab: OrderDetailTab) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-1 rounded-lg bg-muted/30 p-1 sm:min-w-0" role="tablist">
        {orderDetailTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={cn(
              "min-h-10 whitespace-nowrap rounded-md px-3.5 text-[14px] font-medium text-muted-foreground transition hover:bg-panel/70 hover:text-foreground",
              activeTab === tab.key && "bg-panel text-foreground shadow-sm"
            )}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[128px_minmax(0,1fr)] items-start gap-3 text-[14px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{value}</span>
    </div>
  );
}

function CompactRemainingItems({
  order,
  canViewDeliveries,
  canViewPayments
}: {
  order: OrderRow;
  canViewDeliveries: boolean;
  canViewPayments: boolean;
}) {
  const items = canViewDeliveries ? remainingItemLines(order) : order.items;

  if (items.length === 0) {
    return <EmptyPanel message="No remaining item quantities." />;
  }

  return (
    <div className="divide-y divide-border rounded-md border border-border bg-panel text-[14px] shadow-sm">
      {items.slice(0, 4).map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{item.itemName}</p>
            <p className="text-[13px] text-muted-foreground">
              {canViewDeliveries ? `${item.remainingQuantity} remaining` : `${item.quantity} ordered`}
            </p>
          </div>
          {canViewPayments ? (
            <span className="shrink-0 text-sm font-semibold tabular-nums">{item.lineTotal}</span>
          ) : null}
        </div>
      ))}
      {items.length > 4 ? (
        <div className="px-4 py-2 text-[13px] text-muted-foreground">
          {items.length - 4} more {items.length - 4 === 1 ? "item" : "items"} in Items.
        </div>
      ) : null}
    </div>
  );
}

function OrderOverviewSummary({
  order,
  canViewPayments,
  canViewDeliveries
}: {
  order: OrderRow;
  canViewPayments: boolean;
  canViewDeliveries: boolean;
}) {
  return (
    <section id="order-summary" className="space-y-4">
      <div className="grid gap-4 text-[14px] md:grid-cols-[1fr_.9fr]">
        <div className="space-y-2">
          <h3 className="text-[16px] font-semibold">Overview</h3>
          <div className="rounded-md border border-border bg-panel p-5">
            <div className="space-y-3">
              <SummaryRow label="Customer" value={order.customerName} />
              <SummaryRow label="Total" value={order.totalAmount} />
              {canViewPayments ? (
                <>
                  <SummaryRow label="Paid" value={order.paidAmount} />
                  <SummaryRow label="Balance" value={order.balanceAmount} />
                </>
              ) : null}
              {canViewDeliveries ? (
                <>
                  <SummaryRow label="Delivery status" value={deliveryStatusLabel(visibleDeliveryStatus(order))} />
                  <SummaryRow label="Remaining items" value={remainingItemCountLabel(order)} />
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-[16px] font-semibold">Items</h3>
          <CompactRemainingItems
            order={order}
            canViewDeliveries={canViewDeliveries}
            canViewPayments={canViewPayments}
          />
        </div>
      </div>
    </section>
  );
}

function OrderPanelSection({
  id,
  title,
  description,
  children,
  className,
  action
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section id={id} className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-semibold">{title}</h3>
          {description ? <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function DetailField({
  label,
  value,
  muted
}: {
  label: string;
  value: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className={cn("text-[14px] leading-6 font-medium", muted && "font-normal text-muted-foreground")}>{value}</div>
    </div>
  );
}

function CustomerSection({
  order,
  customers,
  canUpdateOrders,
  canCreateCustomers,
  persistenceUserKey,
  isEditing,
  setIsEditing
}: {
  order: OrderRow;
  customers: CustomerOption[];
  canUpdateOrders: boolean;
  canCreateCustomers: boolean;
  persistenceUserKey?: string | null;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [pending, startCustomerSave] = useTransition();
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(() => ({
    id: order.customerId,
    displayName: order.customerName,
    detail: [order.companyName, order.contactSnapshot].filter(Boolean).join(" - ") || null
  }));

  function discard() {
    setSelectedCustomer({
      id: order.customerId,
      displayName: order.customerName,
      detail: [order.companyName, order.contactSnapshot].filter(Boolean).join(" - ") || null
    });
    setState(initialState);
    setIsEditing(false);
  }

  function startEditing() {
    setSelectedCustomer({
      id: order.customerId,
      displayName: order.customerName,
      detail: [order.companyName, order.contactSnapshot].filter(Boolean).join(" - ") || null
    });
    setState(initialState);
    setIsEditing(true);
  }

  function saveCustomer() {
    if (!selectedCustomer?.id) {
      setState({ ok: false, message: "Choose a customer." });
      return;
    }

    const formData = new FormData();
    formData.set("orderId", order.id);
    formData.set("customerId", selectedCustomer.id);

    startCustomerSave(async () => {
      const result = await updateOrderCustomerAction(initialState, formData);
      setState(result);

      if (result.ok) {
        setIsEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <OrderPanelSection
      title="Customer"
      description={order.status === "COMPLETED" || order.status === "CANCELLED" ? "Completed or cancelled orders cannot be edited." : undefined}
      action={
        canUpdateOrders && !isEditing && order.status !== "COMPLETED" && order.status !== "CANCELLED" ? (
          <Button type="button" variant="ghost" className="h-9 min-h-9 px-2" onClick={startEditing}>
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit customer</span>
          </Button>
        ) : isEditing ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={discard}>
              Discard
            </Button>
            <Button type="button" disabled={pending || !selectedCustomer?.id} onClick={saveCustomer}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        ) : null
      }
    >
      {isEditing ? (
        <div id="order-customer-edit-panel" className="space-y-3">
          <CustomerResolverPanel
            customers={customers as ResolverCustomerOption[]}
            selectedCustomer={selectedCustomer}
            setSelectedCustomer={setSelectedCustomer}
            canCreateCustomers={canCreateCustomers}
            persistenceScope={`orders:${order.id}:customer`}
            persistenceUserKey={persistenceUserKey}
            context="order"
          />
          {state.message ? (
            <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 rounded-md border border-border bg-panel p-5 text-sm sm:grid-cols-2">
          <DetailField label="Display name" value={order.customerName} />
          <DetailField label="Customer type" value={readableLabel(order.customerType)} />
          <DetailField label="Company" value={order.companyName ?? "Not set"} muted={!order.companyName} />
          <DetailField label="Contact person" value={order.contactPersonName ?? "Not set"} muted={!order.contactPersonName} />
          <DetailField label="Primary contact" value={order.contactSnapshot ?? "Not set"} muted={!order.contactSnapshot} />
          <DetailField label="Assigned staff" value={order.assignedStaff ?? "Not assigned"} muted={!order.assignedStaff} />
          <DetailField label="Source" value={readableLabel(order.sourceType)} />
          <DetailField label="Billing address" value={order.billingAddressSnapshot ?? "Not set"} muted={!order.billingAddressSnapshot} />
          <DetailField label="Delivery address" value={order.deliveryAddressSnapshot ?? "Not set"} muted={!order.deliveryAddressSnapshot} />
        </div>
      )}
    </OrderPanelSection>
  );
}

function orderItemsToSalesDraft(order: OrderRow): SalesItemDraft[] {
  return order.items.map((item, index) => ({
    id: item.id,
    orderItemId: item.orderItemId,
    productId: item.productId ?? undefined,
    itemType: item.itemType,
    sortOrder: item.sortOrder ?? index,
    snapshotProductCode: item.snapshotProductCode ?? undefined,
    selectedVariantId: item.selectedVariantId ?? undefined,
    selectedVariantName: item.selectedVariantName ?? undefined,
    selectedVariantHex: item.selectedVariantHex ?? undefined,
    itemName: item.itemName,
    description: item.description,
    specifications: item.specifications,
    quantity: item.quantity,
    unitPrice: item.unitPriceValue,
    unitCostSnapshot: item.unitCostSnapshotValue,
    requiresAssembly: item.requiresAssembly,
    discountValue: item.discountValue,
    customerNotes: item.customerNotes ?? "",
    internalNotes: item.internalNotes ?? "",
    images: item.images
  }));
}

function ItemsSection({
  order,
  canViewPayments,
  canViewDeliveries,
  canUpdateOrders,
  canViewProducts,
  products,
  isEditing,
  setIsEditing
}: {
  order: OrderRow;
  canViewPayments: boolean;
  canViewDeliveries: boolean;
  canUpdateOrders: boolean;
  canViewProducts: boolean;
  products: ProductOption[];
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [pending, startItemsSave] = useTransition();
  const [items, setItems] = useState<SalesItemDraft[]>(() => orderItemsToSalesDraft(order));
  const [additionalDiscount, setAdditionalDiscount] = useState(order.orderDiscountValue);
  const [additionalFees, setAdditionalFees] = useState(0);
  const [needsAssembly, setNeedsAssembly] = useState(order.needsAssembly);
  const [assemblyFeeRate, setAssemblyFeeRate] = useState(100);
  const [salesInvoiceRequested, setSalesInvoiceRequested] = useState(order.salesInvoiceRequested);
  const [salesInvoiceFeePercentage, setSalesInvoiceFeePercentage] = useState(8);
  const hasDeliveredItems = order.items.some((item) => item.deliveredQuantity > 0);
  const cannotEdit = !canUpdateOrders || order.status === "COMPLETED" || order.status === "CANCELLED" || hasDeliveredItems;
  const warnings = [
    order.payments.length > 0
      ? "This order has payment records. Updating items will recalculate the balance but will not remove payments."
      : null,
    order.documents.length > 0
      ? "This order has generated documents. Existing PDFs may no longer match the updated order."
      : null,
    order.deliveries.length > 0
      ? "This order has scheduled deliveries. Item changes may be restricted."
      : null,
    !canViewProducts ? "Product picker access requires product view permission. Custom items can still be edited." : null,
    order.status === "COMPLETED" || order.status === "CANCELLED"
      ? "Completed or cancelled orders cannot be edited."
      : null,
    hasDeliveredItems ? "Orders with delivered items cannot be edited." : null
  ].filter(Boolean);
  const totals = useMemo(
    () =>
      calculateSalesTotals({
        items,
        additionalDiscount,
        additionalFees,
        needsAssembly,
        assemblyFeeRate,
        salesInvoiceRequested,
        salesInvoiceFeePercentage
      }),
    [additionalDiscount, additionalFees, assemblyFeeRate, items, needsAssembly, salesInvoiceFeePercentage, salesInvoiceRequested]
  );

  function discard() {
    if (!window.confirm("Discard item changes?")) {
      return;
    }

    setItems(orderItemsToSalesDraft(order));
    setAdditionalDiscount(order.orderDiscountValue);
    setAdditionalFees(0);
    setNeedsAssembly(order.needsAssembly);
    setAssemblyFeeRate(100);
    setSalesInvoiceRequested(order.salesInvoiceRequested);
    setSalesInvoiceFeePercentage(8);
    setState(initialState);
    setIsEditing(false);
  }

  function startEditing() {
    setItems(orderItemsToSalesDraft(order));
    setAdditionalDiscount(order.orderDiscountValue);
    setAdditionalFees(0);
    setNeedsAssembly(order.needsAssembly);
    setAssemblyFeeRate(100);
    setSalesInvoiceRequested(order.salesInvoiceRequested);
    setSalesInvoiceFeePercentage(8);
    setState(initialState);
    setIsEditing(true);
  }

  function saveItems() {
    const formData = new FormData();
    formData.set("orderId", order.id);
    formData.set("items", JSON.stringify(toSalesActionItems(items, needsAssembly)));
    formData.set("orderDiscountType", additionalDiscount > 0 ? "FIXED_AMOUNT" : "");
    formData.set("orderDiscountValue", String(additionalDiscount));
    formData.set("additionalFees", String(additionalFees));
    formData.set("needsAssembly", needsAssembly ? "true" : "false");
    formData.set("assemblyFeeRate", String(assemblyFeeRate));
    formData.set("salesInvoiceRequested", salesInvoiceRequested ? "true" : "false");
    formData.set("salesInvoiceFeePercentage", String(salesInvoiceFeePercentage));

    startItemsSave(async () => {
      const result = await updateOrderItemsAction(initialState, formData);
      setState(result);

      if (result.ok) {
        setIsEditing(false);
        router.refresh();
      }
    });
  }

  if (isEditing) {
    return (
      <OrderPanelSection
        title="Items"
        description="Edit order-only items and totals. Existing payments, deliveries, and documents are preserved."
        action={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={discard}>
              Discard
            </Button>
            <Button type="button" disabled={pending || cannotEdit || items.length === 0} onClick={saveItems}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        }
      >
        {warnings.length ? (
          <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
            {warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        ) : null}
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <SalesItemsEditor
            products={(canViewProducts ? products : []).map((product) => ({
              ...product,
              primaryImage: product.primaryImage ?? null,
              colorVariants: product.colorVariants ?? []
            }))}
            items={items}
            setItems={setItems}
            needsAssembly={needsAssembly}
            setNeedsAssembly={setNeedsAssembly}
            assemblyFeeRate={assemblyFeeRate}
            setAssemblyFeeRate={setAssemblyFeeRate}
            salesInvoiceRequested={salesInvoiceRequested}
            setSalesInvoiceRequested={setSalesInvoiceRequested}
            salesInvoiceFeePercentage={salesInvoiceFeePercentage}
            setSalesInvoiceFeePercentage={setSalesInvoiceFeePercentage}
            subtotalAmount={totals.subtotalAmount}
            emptyLabel="Add a product or custom item to rebuild this order."
          />
          <SalesSummaryPanel
            title="Summary"
            subtitle="Order summary"
            customerName={order.customerName}
            customerDetail={[order.companyName, order.contactSnapshot].filter(Boolean).join(" - ") || null}
            items={items}
            additionalFees={additionalFees}
            setAdditionalFees={setAdditionalFees}
            additionalDiscount={additionalDiscount}
            setAdditionalDiscount={setAdditionalDiscount}
            totals={totals}
          >
            {state.message ? (
              <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>
            ) : null}
          </SalesSummaryPanel>
        </div>
      </OrderPanelSection>
    );
  }

  return (
    <OrderPanelSection
      title="Items"
      action={
        canUpdateOrders ? (
          <Button
            type="button"
            variant="ghost"
            disabled={cannotEdit}
            className="h-9 min-h-9 px-2"
            onClick={startEditing}
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit items</span>
          </Button>
        ) : null
      }
    >
      {warnings.length ? (
        <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          {warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-md border border-border bg-panel shadow-sm">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2.5 pl-3.5 font-medium">Item</th>
              <th className="py-2.5 font-medium">Qty</th>
              {canViewDeliveries ? <th className="py-2.5 font-medium">Scheduled</th> : null}
              {canViewDeliveries ? <th className="py-2.5 font-medium">Delivered</th> : null}
              {canViewPayments ? <th className="py-2.5 font-medium">Unit</th> : null}
              {canViewPayments ? <th className="py-2.5 font-medium">Discount</th> : null}
              {canViewPayments ? <th className="py-2.5 pr-3.5 font-medium">Line total</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="py-3.5 pl-3.5 font-medium">{item.itemName}</td>
                <td className="py-3.5 text-muted-foreground">{item.quantity}</td>
                {canViewDeliveries ? (
                  <td className="py-3.5 text-muted-foreground">{item.plannedQuantity}</td>
                ) : null}
                {canViewDeliveries ? (
                  <td className="py-3.5 text-muted-foreground">{item.deliveredQuantity}</td>
                ) : null}
                {canViewPayments ? <td className="py-3.5 text-muted-foreground">{item.unitPrice}</td> : null}
                {canViewPayments ? <td className="py-3.5 text-muted-foreground">{item.discountAmount}</td> : null}
                {canViewPayments ? <td className="py-3.5 pr-3.5 font-semibold">{item.lineTotal}</td> : null}
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
                  <th className="py-2 font-medium">Unit price</th>
                  <th className="py-2 font-medium">Line profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 font-medium">{item.itemName}</td>
                    <td className="py-2 text-muted-foreground">{item.unitCostSnapshot}</td>
                    <td className="py-2 text-muted-foreground">{item.unitPrice}</td>
                    <td className="py-2 font-medium">{item.lineProfit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </OrderPanelSection>
  );
}

function PaymentSection({
  order,
  canUpdateOrders,
  canViewPayments,
  canCreatePayments,
  activeAction,
  onActionChange
}: {
  order: OrderRow;
  canUpdateOrders: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  activeAction: ActiveOrderAction;
  onActionChange: (actionKey: ActiveOrderAction) => void;
}) {
  if (!canViewPayments) {
    return (
      <OrderPanelSection title="Payment">
        <RestrictedPanel title="payment data" />
      </OrderPanelSection>
    );
  }

  const isPaymentFormOpen = activeAction === "payment";
  const isPaymentDueFormOpen = activeAction === "paymentDue";
  const canEditPayments = !isTerminalOrder(order);

  return (
    <OrderPanelSection
      title="Payment"
      description={`${paymentSupportSummary(order).value}. ${paymentSupportSummary(order).detail}`}
    >
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

      {canEditPayments && (canCreatePayments || (canUpdateOrders && order.balanceAmountValue > 0)) ? (
        <div className="flex flex-wrap gap-2">
          {canCreatePayments ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onActionChange(isPaymentFormOpen ? null : "payment")}
            >
              <ReceiptText className="h-4 w-4" />
              {isPaymentFormOpen ? "Close" : "Record payment"}
            </Button>
          ) : null}
          {canUpdateOrders && order.balanceAmountValue > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onActionChange(isPaymentDueFormOpen ? null : "paymentDue")}
            >
              <CalendarClock className="h-4 w-4" />
              Set due timing
            </Button>
          ) : null}
        </div>
      ) : null}

      {isPaymentFormOpen && canEditPayments ? (
        <div className="border-t border-border pt-4">
          <PaymentForm order={order} />
        </div>
      ) : null}

      {isPaymentDueFormOpen && canEditPayments ? (
        <div className="border-t border-border pt-4">
          <PaymentDueTimingForm order={order} />
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
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel message="No payment records yet." />
      )}
    </OrderPanelSection>
  );
}

function DeliverySection({
  order,
  canViewDeliveries,
  canCreateDeliveries,
  canUpdateDeliveries,
  staffOptions,
  activeAction,
  onActionChange,
  onDeliverySuccess
}: {
  order: OrderRow;
  canViewDeliveries: boolean;
  canCreateDeliveries: boolean;
  canUpdateDeliveries: boolean;
  staffOptions: StaffOption[];
  activeAction: ActiveOrderAction;
  onActionChange: (actionKey: ActiveOrderAction) => void;
  onDeliverySuccess: () => void;
}) {
  if (!canViewDeliveries) {
    return (
      <OrderPanelSection title="Delivery">
        <RestrictedPanel title="delivery data" />
      </OrderPanelSection>
    );
  }

  const isDeliveryFormOpen = activeAction === "delivery";

  return (
    <OrderPanelSection
      title="Delivery"
      description={`${deliverySupportSummary(order).value}. ${deliverySupportSummary(order).detail}`}
    >
      <div className="grid gap-3 text-sm md:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Delivery status</p>
          <p className="mt-1 font-semibold">{deliveryStatusLabel(visibleDeliveryStatus(order))}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Next scheduled</p>
          <p className="mt-1 font-semibold">{order.nextDeliveryDate ?? "Not scheduled"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Provider</p>
          <p className="mt-1 font-semibold">
            {order.nextDeliveryProvider ? readableLabel(order.nextDeliveryProvider) : "None"}
          </p>
        </div>
      </div>

      {canScheduleDelivery(order, canViewDeliveries, canCreateDeliveries) ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onActionChange(isDeliveryFormOpen ? null : "delivery")}
          >
            <Truck className="h-4 w-4" />
            {isDeliveryFormOpen ? "Close" : "Schedule delivery"}
          </Button>
        </div>
      ) : canCreateDeliveries ? (
        <DeliveryBlockedPanel order={order} />
      ) : null}

      {isDeliveryFormOpen && canScheduleDelivery(order, canViewDeliveries, canCreateDeliveries) ? (
        <div className="border-t border-border pt-4">
          <DeliveryForm order={order} staffOptions={staffOptions} onSuccess={onDeliverySuccess} />
        </div>
      ) : null}

      {order.deliveries.length > 0 ? (
        <div className="divide-y divide-border rounded-lg border border-border bg-panel text-sm">
          {order.deliveries.map((delivery) => {
            const progressAction: OpenOrderAction = `deliveryProgress:${delivery.id}`;
            const isProgressFormOpen = activeAction === progressAction;
            const canUpdateDeliveryProgress =
              canUpdateDeliveries && ["SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED"].includes(delivery.status);

            return (
              <div key={delivery.id} className="p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-semibold">{delivery.deliveryNumber ?? "Not assigned"}</span>
                  <StatusPill tone={statusTone(delivery.status)}>{deliveryStatusLabel(delivery.status)}</StatusPill>
                </div>
                <p className="mt-1 text-muted-foreground">{delivery.scheduledDateLabel ?? "Not scheduled"}</p>
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
                {canUpdateDeliveryProgress ? (
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-9 px-3 text-xs"
                      aria-expanded={isProgressFormOpen}
                      onClick={() => onActionChange(isProgressFormOpen ? null : progressAction)}
                    >
                      <Save className="h-4 w-4" />
                      {isProgressFormOpen ? "Close" : "Update progress"}
                    </Button>
                  </div>
                ) : null}
                {isProgressFormOpen && canUpdateDeliveryProgress ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <DeliveryProgressForm delivery={delivery} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyPanel message="No delivery records yet." />
      )}
    </OrderPanelSection>
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
    <OrderPanelSection title="Documents">
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
    </OrderPanelSection>
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
    <OrderPanelSection title="Notes">
      <div className="grid gap-4 text-sm lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-border bg-panel p-4">
          <DetailField
            label="Customer snapshot"
            value={
              <>
                <p>{order.customerName}</p>
                {order.companyName ? <p className="font-normal text-muted-foreground">{order.companyName}</p> : null}
                {order.contactPersonName ? (
                  <p className="font-normal text-muted-foreground">{order.contactPersonName}</p>
                ) : null}
                {order.contactSnapshot ? (
                  <p className="font-normal text-muted-foreground">{order.contactSnapshot}</p>
                ) : null}
              </>
            }
          />
          {canViewDeliveries ? (
            <DetailField
              label="Delivery address"
              value={order.deliveryAddressSnapshot ?? "No delivery address snapshot"}
              muted={!order.deliveryAddressSnapshot}
            />
          ) : null}
          {order.relatedQuotationId || order.relatedInquiryId ? (
            <DetailField
              label="Related quotation / inquiry"
              value={
                <div className="space-y-1">
                  {order.relatedQuotationId ? (
                    <p>
                      Quotation: {order.relatedQuotationNumber ?? "Not assigned"}
                      {order.relatedQuotationStatus ? ` · ${readableLabel(order.relatedQuotationStatus)}` : ""}
                    </p>
                  ) : null}
                  {order.relatedInquiryId ? (
                    <p>
                      Inquiry: {order.relatedInquiryLabel ?? order.relatedInquiryId.slice(0, 8)}
                    </p>
                  ) : null}
                </div>
              }
            />
          ) : null}
        </div>
        <div className="space-y-4 rounded-lg border border-border bg-panel p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Needs assembly" value={order.needsAssembly ? "Yes" : "No"} />
            <DetailField label="Sales invoice" value={order.salesInvoiceRequested ? "Requested" : "No"} />
            {canViewDeliveries ? (
              <>
                <DetailField
                  label="Mode of delivery"
                  value={order.modeOfDelivery ?? "Not specified"}
                  muted={!order.modeOfDelivery}
                />
                <DetailField
                  label="Delivery method"
                  value={order.deliveryMethod ?? "Not specified"}
                  muted={!order.deliveryMethod}
                />
              </>
            ) : null}
          </div>
          <div className="space-y-4 border-t border-border pt-4">
            {canViewPayments ? (
              <DetailField
                label="Payment terms"
                value={order.paymentTerms ?? "Not specified"}
                muted={!order.paymentTerms}
              />
            ) : null}
            <DetailField
              label="Remarks / special instructions"
              value={order.specialInstructions ?? "Not specified"}
              muted={!order.specialInstructions}
            />
          </div>
          {order.customerNotes || order.internalNotes ? (
            <div className="space-y-4 border-t border-border pt-4">
              {order.customerNotes ? (
                <DetailField label="Customer notes" value={order.customerNotes} />
              ) : null}
              {order.internalNotes ? (
                <DetailField label="Internal notes" value={order.internalNotes} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </OrderPanelSection>
  );
}
