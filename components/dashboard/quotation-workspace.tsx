"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { QuotationStatus } from "@prisma/client";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  ImagePlus,
  MoreHorizontal,
  PackageSearch,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  UserPlus,
  X,
  XCircle
} from "lucide-react";
import { createCustomerAction } from "@/app/actions/customer-inquiries";
import {
  createQuotationAction,
  deleteQuotationAction,
  updateDraftQuotationAction,
  updateQuotationStatusAction
} from "@/app/actions/quotations";
import { convertQuotationToOrderAction } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CustomerOption = {
  id: string;
  displayName: string;
  companyName: string | null;
  primaryContact: string | null;
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
  primaryImage: {
    id: string;
    cloudinaryPublicId: string;
    secureUrl: string;
    resourceType: string;
    format: string | null;
    width: number | null;
    height: number | null;
    bytes: number | null;
    altText: string | null;
  } | null;
};

type QuotationRow = {
  id: string;
  quotationNumber: string | null;
  customerName: string;
  status: string;
  itemSummary: string;
  subtotalAmount: string;
  totalAmount: string;
  createdBy: string | null;
  updatedAt: string;
  orderId?: string | null;
  orderNumber?: string | null;
};

type QuotationBuilderProps = {
  customers: CustomerOption[];
  products: ProductOption[];
  canCreateCustomers: boolean;
  canUpdateQuotations?: boolean;
  backHref?: string;
  backLabel?: string;
  mode?: "create" | "edit";
  initialQuotation?: {
    id: string;
    status: string;
    customer: SelectedCustomer;
    items: ItemDraft[];
    quotationDiscountValue: number;
    needsAssembly: boolean;
    salesInvoiceRequested: boolean;
    modeOfDelivery: string;
    deliveryMethod: string;
    paymentTerms: string;
    specialInstructions: string;
    customerNotes: string;
    internalNotes: string;
  };
};

type SelectedCustomer = {
  id: string;
  displayName: string;
  detail: string | null;
};

type QuotationRecordsListProps = {
  quotations: QuotationRow[];
  query?: string;
  status?: string;
  view?: string;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    from: number;
    to: number;
  };
  canExportDocuments: boolean;
  canUpdateQuotations: boolean;
  canApproveQuotations: boolean;
  canDeleteQuotations: boolean;
};

type QuotationDetailActionsProps = {
  quotationId: string;
  status: string;
  canExportDocuments: boolean;
  canUpdateQuotations: boolean;
  canApproveQuotations: boolean;
  canCreateOrders: boolean;
  order?: {
    id: string;
    orderNumber: string | null;
  } | null;
};

type ItemImageDraft = {
  sourceProductImageId?: string;
  cloudinaryPublicId: string;
  secureUrl: string;
  resourceType: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
  altText?: string;
  sortOrder: number;
  isPrimary: boolean;
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
  discountValue: number;
  customerNotes: string;
  internalNotes: string;
  images: ItemImageDraft[];
};

type ActionState = {
  ok: boolean;
  message: string;
  customerId?: string;
  customerDisplayName?: string;
  quotationId?: string;
  status?: QuotationStatus;
  deleted?: boolean;
  intent?: string;
  orderId?: string;
  orderNumber?: string | null;
};

const initialState: ActionState = {
  ok: false,
  message: ""
};

const pdfLinkClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border bg-soft-accent/70 px-2 text-sm font-semibold text-foreground transition hover:bg-soft-accent";
const quotationStatusFilterOptions = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "CANCELLED"] as const;
const quotationViewOptions = ["active", "converted", "all"] as const;

function normalizeStatusFilter(value: string | undefined) {
  return quotationStatusFilterOptions.find((option) => option === value) ?? "";
}

function normalizeQuotationView(value: string | undefined) {
  return quotationViewOptions.find((option) => option === value) ?? "active";
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

function itemSubtotal(item: ItemDraft) {
  return roundMoney(item.quantity * item.unitPrice);
}

function itemDiscount(item: ItemDraft) {
  return roundMoney(Math.max(item.discountValue || 0, 0));
}

function lineTotal(item: ItemDraft) {
  return roundMoney(Math.max(itemSubtotal(item) - itemDiscount(item), 0));
}

function lineCostTotal(item: ItemDraft) {
  return roundMoney(item.quantity * Math.max(item.unitCostSnapshot || 0, 0));
}

function lineProfit(item: ItemDraft) {
  return roundMoney(lineTotal(item) - lineCostTotal(item));
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
    discountValue: 0,
    customerNotes: "",
    internalNotes: "",
    images: []
  };
}

function toSearchText(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function numericInputValue(value: number) {
  return value > 0 ? String(value) : "";
}

function parseMoneyInput(value: string) {
  if (!value.trim()) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

function normalizeQuantity(value: number) {
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1;
}

function parseQuantityInput(value: string) {
  if (!value.trim()) {
    return 1;
  }

  return normalizeQuantity(Number(value));
}

function MoneyInput({
  value,
  onValueChange,
  max,
  "aria-label": ariaLabel,
  placeholder = "0"
}: {
  value: number;
  onValueChange: (value: number) => void;
  max?: number;
  "aria-label"?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(numericInputValue(value));
    }
  }, [editing, value]);

  return (
    <Input
      type="number"
      min="0"
      max={max}
      step="0.01"
      value={editing ? draft : numericInputValue(value)}
      onFocus={() => {
        setEditing(true);
        setDraft(numericInputValue(value));
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);

        if (nextValue.trim()) {
          onValueChange(parseMoneyInput(nextValue));
        }
      }}
      onBlur={() => {
        setEditing(false);
        onValueChange(parseMoneyInput(draft));
      }}
      aria-label={ariaLabel}
      placeholder={placeholder}
    />
  );
}

function QuantityInput({
  value,
  onValueChange,
  "aria-label": ariaLabel
}: {
  value: number;
  onValueChange: (value: number) => void;
  "aria-label"?: string;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(String(value));
    }
  }, [editing, value]);

  return (
    <Input
      type="number"
      min="1"
      step="1"
      value={editing ? draft : String(value)}
      onFocus={() => {
        setEditing(true);
        setDraft(String(value));
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);

        if (nextValue.trim()) {
          onValueChange(parseQuantityInput(nextValue));
        }
      }}
      onBlur={() => {
        setEditing(false);
        onValueChange(parseQuantityInput(draft));
      }}
      aria-label={ariaLabel}
    />
  );
}

function friendlyActionMessage(message: string) {
  if (!message) {
    return "";
  }

  if (message.includes("Expected string") || message.includes("received null")) {
    return "Some optional details were blank. Please check the required fields and try again.";
  }

  if (message === "Choose a customer.") {
    return "Select or enter a customer name.";
  }

  if (message === "Add at least one quotation item.") {
    return "Add at least one item to continue.";
  }

  return message;
}

function toActionItems(items: ItemDraft[]) {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index,
    quantity: normalizeQuantity(item.quantity),
    discountType: item.discountValue > 0 ? "FIXED_AMOUNT" : undefined,
    discountValue: item.discountValue > 0 ? item.discountValue : undefined,
    description: item.description || undefined,
    specifications: item.specifications || undefined,
    customerNotes: item.customerNotes || undefined,
    internalNotes: item.internalNotes || undefined,
    snapshotProductCode: item.snapshotProductCode || undefined,
    images: item.images
      .filter((image) => image.cloudinaryPublicId && image.secureUrl)
      .map((image, imageIndex) => ({
        ...image,
        sortOrder: imageIndex,
        format: image.format || undefined,
        altText: image.altText || undefined
      }))
  }));
}

function quotationStatusBadgeClass(status: string) {
  return cn(
    "inline-flex h-7 w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none tracking-normal",
    status === "ACCEPTED" && "border-success/25 bg-success/15 text-success",
    status === "SENT" && "border-warning/25 bg-soft-accent text-warning",
    status === "DECLINED" || status === "CANCELLED"
      ? "border-danger/25 bg-danger/10 text-danger"
      : undefined,
    status === "DRAFT" && "border-border bg-muted/55 text-muted-foreground"
  );
}

function productImageStyle(product: ProductOption) {
  return product.primaryImage?.secureUrl
    ? {
        backgroundImage: `url("${product.primaryImage.secureUrl}")`
      }
    : undefined;
}

function createCatalogItem(product: ProductOption, sortOrder: number): ItemDraft {
  const primaryImage = product.primaryImage
    ? [
        {
          sourceProductImageId: product.primaryImage.id,
          cloudinaryPublicId: product.primaryImage.cloudinaryPublicId,
          secureUrl: product.primaryImage.secureUrl,
          resourceType: product.primaryImage.resourceType,
          format: product.primaryImage.format ?? undefined,
          width: product.primaryImage.width ?? undefined,
          height: product.primaryImage.height ?? undefined,
          bytes: product.primaryImage.bytes ?? undefined,
          altText: product.primaryImage.altText ?? product.name,
          sortOrder: 0,
          isPrimary: true
        }
      ]
    : [];

  return {
    productId: product.id,
    itemType: "CATALOG_PRODUCT",
    sortOrder,
    snapshotProductCode: product.code ?? undefined,
    itemName: product.name,
    description: product.description ?? "",
    specifications: product.specifications ?? "",
    quantity: 1,
    unitPrice: product.referencePrice ?? 0,
    unitCostSnapshot: product.referenceCost ?? 0,
    discountValue: 0,
    customerNotes: "",
    internalNotes: "",
    images: primaryImage
  };
}

function customerDetail(customer: CustomerOption) {
  return [customer.companyName, customer.primaryContact].filter(Boolean).join(" - ") || null;
}

function labelFromEnum(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function orderHref(orderId: string) {
  return `/orders?orderId=${encodeURIComponent(orderId)}`;
}

const compactStatusOptions = ["DRAFT", "SENT", "ACCEPTED"] as const;

function canPickQuotationStatus({
  currentStatus,
  nextStatus,
  canUpdateQuotations,
  canApproveQuotations
}: {
  currentStatus: string;
  nextStatus: (typeof compactStatusOptions)[number];
  canUpdateQuotations: boolean;
  canApproveQuotations: boolean;
}) {
  if (currentStatus === nextStatus) {
    return true;
  }

  if (nextStatus === "ACCEPTED" && !canApproveQuotations) {
    return false;
  }

  if ((nextStatus === "DRAFT" || nextStatus === "SENT") && !canUpdateQuotations) {
    return false;
  }

  if (currentStatus === "DRAFT") {
    return nextStatus === "SENT" || nextStatus === "ACCEPTED";
  }

  if (currentStatus === "SENT") {
    return nextStatus === "DRAFT" || nextStatus === "ACCEPTED";
  }

  return false;
}

function QuotationStatusSelect({
  quotation,
  action,
  pending,
  canUpdateQuotations,
  canApproveQuotations
}: {
  quotation: QuotationRow;
  action: (formData: FormData) => void;
  pending: boolean;
  canUpdateQuotations: boolean;
  canApproveQuotations: boolean;
}) {
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
    placement: "above" | "below";
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isSubmitting, startStatusTransition] = useTransition();
  const isOpen = menuPosition !== null;
  const isBusy = pending || isSubmitting;
  const canUseCompactStatus = compactStatusOptions.includes(
    quotation.status as (typeof compactStatusOptions)[number]
  );
  const hasAnyStatusPermission = canUpdateQuotations || canApproveQuotations;

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

  function toggleMenu() {
    if (isBusy) {
      return;
    }

    if (isOpen) {
      setMenuPosition(null);
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const menuWidth = 152;
    const estimatedHeight = 136;
    const hasRoomBelow = rect.bottom + estimatedHeight + 12 < window.innerHeight;
    setMenuPosition({
      left: Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rect.left)),
      top: hasRoomBelow ? rect.bottom + 8 : rect.top - 8,
      placement: hasRoomBelow ? "below" : "above"
    });
  }

  function submitStatusUpdate(nextStatus: (typeof compactStatusOptions)[number]) {
    const formData = new FormData();
    formData.set("quotationId", quotation.id);
    formData.set("status", nextStatus);

    setMenuPosition(null);
    startStatusTransition(() => {
      action(formData);
    });
  }

  if (!canUseCompactStatus || !hasAnyStatusPermission) {
    return (
      <span className={quotationStatusBadgeClass(quotation.status)}>{labelFromEnum(quotation.status)}</span>
    );
  }

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      className="contents"
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={isBusy}
        onClick={toggleMenu}
        className={cn(
          quotationStatusBadgeClass(quotation.status),
          "cursor-pointer transition hover:bg-soft-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
        )}
      >
        {labelFromEnum(quotation.status)}
      </button>
      {isOpen ? (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[80] grid min-w-36 gap-1 rounded-lg border border-border bg-panel p-2 shadow-xl"
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            transform: menuPosition.placement === "above" ? "translateY(-100%)" : undefined
          }}
        >
          {compactStatusOptions.map((option) => {
            const allowed = canPickQuotationStatus({
              currentStatus: quotation.status,
              nextStatus: option,
              canUpdateQuotations,
              canApproveQuotations
            });

            return (
              <Button
                key={option}
                type="button"
                variant="ghost"
                disabled={isBusy || !allowed}
                role="menuitem"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  submitStatusUpdate(option);
                }}
                className="min-h-8 justify-start rounded-md px-2"
              >
                <span className={quotationStatusBadgeClass(option)}>{labelFromEnum(option)}</span>
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function InlineCustomerCreate({
  enabled,
  initialName = "",
  submitLabel = "Add customer",
  onCreated
}: {
  enabled: boolean;
  initialName?: string;
  submitLabel?: string;
  onCreated: (customer: SelectedCustomer) => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createCustomerAction, initialState);
  const [name, setName] = useState(initialName);
  const [contact, setContact] = useState("");
  const [source, setSource] = useState("");

  const contacts = contact.trim()
    ? [
        {
          type: "OTHER",
          value: contact.trim(),
          isPrimary: true
        }
      ]
    : [];

  useEffect(() => {
    if (state.ok && state.customerId && state.customerDisplayName) {
      onCreated({
        id: state.customerId,
        displayName: state.customerDisplayName,
        detail: null
      });
      router.refresh();
    }
  }, [onCreated, router, state.customerDisplayName, state.customerId, state.ok]);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  if (!enabled) {
    return null;
  }

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="customerType" value="INDIVIDUAL" />
      <input type="hidden" name="contacts" value={JSON.stringify(contacts)} />
      <label className="sr-only" htmlFor="quick-customer-name">
        Customer name
      </label>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
        <Input
          id="quick-customer-name"
          name="displayName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Customer name"
          required
        />
        <Input
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          placeholder="Phone, Viber, or Facebook"
        />
        <Select name="source" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="">Source optional</option>
          <option value="FACEBOOK_MARKETPLACE">Facebook Marketplace</option>
          <option value="FACEBOOK_PAGE">Facebook Page</option>
          <option value="MESSENGER">Messenger</option>
          <option value="VIBER">Viber</option>
          <option value="WALK_IN">Walk-in</option>
          <option value="PHONE">Phone</option>
          <option value="REFERRAL">Referral</option>
          <option value="OTHER">Other</option>
        </Select>
        <Button disabled={pending || !name.trim()} variant="secondary" className="w-full whitespace-nowrap md:w-auto">
          <UserPlus className="h-4 w-4" />
          {submitLabel}
        </Button>
      </div>
      {state.message ? (
        <p className={cn("text-sm", state.ok ? "text-success" : "text-danger")}>
          {friendlyActionMessage(state.message)}
        </p>
      ) : null}
    </form>
  );
}

function CustomerSelector({
  customers,
  selectedCustomer,
  setSelectedCustomer,
  canCreateCustomers
}: {
  customers: CustomerOption[];
  selectedCustomer: SelectedCustomer | null;
  setSelectedCustomer: (value: SelectedCustomer | null) => void;
  canCreateCustomers: boolean;
}) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const trimmedQuery = query.trim();
  const filteredCustomers = trimmedQuery
    ? customers
        .filter((customer) =>
          toSearchText(customer.displayName, customer.companyName, customer.primaryContact).includes(
            trimmedQuery.toLowerCase()
          )
        )
        .slice(0, 8)
    : [];
  const hasExactMatch = filteredCustomers.some(
    (customer) => customer.displayName.toLowerCase() === trimmedQuery.toLowerCase()
  );

  return (
    <section className="space-y-3">
      <div>
        <p className="studio-kicker">Customer / Lead</p>
        <h2 className="text-sm font-semibold">Resolve the buyer record</h2>
      </div>
      <div className="studio-subpanel p-4">
        {selectedCustomer ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
            <div>
              <p className="font-semibold">{selectedCustomer.displayName}</p>
              {selectedCustomer.detail ? (
                <p className="text-sm text-muted-foreground">{selectedCustomer.detail}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCustomer(null);
                setQuery("");
              }}
              className="text-sm font-semibold text-accent hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 inline-flex rounded-lg border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-semibold transition",
                  mode === "existing" ? "bg-soft-accent text-foreground" : "text-muted-foreground"
                )}
              >
                Existing customer
              </button>
              {canCreateCustomers ? (
                <button
                  type="button"
                  onClick={() => setMode("new")}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-semibold transition",
                    mode === "new" ? "bg-soft-accent text-foreground" : "text-muted-foreground"
                  )}
                >
                  New quick customer
                </button>
              ) : null}
            </div>
            {mode === "existing" ? (
              <>
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search customer name, company, or contact"
                    className="pl-9"
                  />
                </label>
                {trimmedQuery ? (
                  <div className="mt-2 overflow-hidden rounded-lg border border-border bg-background">
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() =>
                          setSelectedCustomer({
                            id: customer.id,
                            displayName: customer.displayName,
                            detail: customerDetail(customer)
                          })
                        }
                        className="block w-full border-b border-border px-3 py-3 text-left text-sm transition last:border-b-0 hover:bg-soft-accent/50"
                      >
                        <span className="block font-semibold">{customer.displayName}</span>
                        <span className="block text-muted-foreground">
                          {customer.primaryContact ?? customer.companyName ?? "No contact saved"}
                        </span>
                      </button>
                    ))}
                    {trimmedQuery && filteredCustomers.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-muted-foreground">
                        No matching customers.
                      </div>
                    ) : null}
                    {trimmedQuery && !hasExactMatch && canCreateCustomers ? (
                      <div className="border-t border-border p-3">
                        <p className="mb-2 text-sm font-medium">
                          Create a customer record for &quot;{trimmedQuery}&quot;
                        </p>
                        <InlineCustomerCreate
                          enabled={canCreateCustomers}
                          initialName={trimmedQuery}
                          submitLabel="Create & select"
                          onCreated={setSelectedCustomer}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <InlineCustomerCreate
                enabled={canCreateCustomers}
                submitLabel="Create & select"
                onCreated={setSelectedCustomer}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ProductPicker({
  products,
  open,
  onClose,
  onAdd
}: {
  products: ProductOption[];
  open: boolean;
  onClose: () => void;
  onAdd: (product: ProductOption) => void;
}) {
  const [query, setQuery] = useState("");
  const filteredProducts = products.filter((product) =>
    toSearchText(product.name, product.code, product.category, product.description).includes(
      query.toLowerCase()
    )
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/35 p-3 backdrop-blur-sm md:p-6"
      onMouseDown={onClose}
    >
      <div
        className="mx-auto flex max-h-[94vh] max-w-7xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="studio-kicker">Products</p>
            <h2 className="text-base font-semibold">Add product</h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} className="min-h-9 px-2">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="border-b border-border p-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by product name, code, or category"
              className="pl-9"
            />
          </label>
        </div>
        <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => (
            <article key={product.id} className="flex min-h-[260px] flex-col overflow-hidden rounded-lg border border-border bg-background">
              <div
                className="flex aspect-[4/3] items-center justify-center border-b border-border bg-soft-accent/40 bg-cover bg-center text-muted-foreground"
                style={productImageStyle(product)}
              >
                {!product.primaryImage ? <ImagePlus className="h-8 w-8" /> : null}
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <p className="line-clamp-2 text-sm font-semibold">{product.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {product.code ? `Code: ${product.code}` : "No product code"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {product.category ? product.category : "No category"}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">
                    {money(product.referencePrice ?? 0)}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      onAdd(product);
                    }}
                    className="min-h-9 px-3"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {filteredProducts.length === 0 ? (
            <div className="studio-empty px-4 py-8 text-sm md:col-span-2">
              No products match that search.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function QuotationItemTable({
  items,
  updateItem,
  removeItem,
  finalTotal
}: {
  items: ItemDraft[];
  updateItem: (index: number, patch: Partial<ItemDraft>) => void;
  removeItem: (index: number) => void;
  finalTotal: number;
}) {
  function confirmRemoveItem(index: number) {
    const itemName = items[index]?.itemName?.trim() || `item ${index + 1}`;

    if (window.confirm(`Remove ${itemName} from this quotation?`)) {
      removeItem(index);
    }
  }

  return (
    <div className="space-y-3">
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-panel lg:block">
        <div className="grid min-w-[1280px] grid-cols-[minmax(320px,1fr)_92px_140px_128px_128px_128px_128px_76px] gap-4 border-b border-border bg-soft-accent/35 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
          <span>Item</span>
          <span className="text-left">Qty</span>
          <span className="text-left">Cost</span>
          <span className="text-left">Unit Price</span>
          <span className="text-left">Profit</span>
          <span className="text-left">Discount</span>
          <span className="text-left">Line Total</span>
          <span className="text-center">Actions</span>
        </div>
        {items.map((item, index) => (
          <div key={index} className="border-b border-border last:border-b-0">
            <div className="grid min-w-[1280px] grid-cols-[minmax(320px,1fr)_92px_140px_128px_128px_128px_128px_76px] items-start gap-4 px-4 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <ItemThumb item={item} />
                <div className="min-w-0 flex-1">
                  <Input
                    value={item.itemName}
                    onChange={(event) => updateItem(index, { itemName: event.target.value })}
                    placeholder="Item name"
                  />
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {[item.snapshotProductCode, item.itemType === "CATALOG_PRODUCT" ? "Catalog" : "Custom"]
                      .filter(Boolean)
                      .join(" - ")}
                  </p>
                </div>
              </div>
              <QuantityInput
                value={item.quantity}
                onValueChange={(value) => updateItem(index, { quantity: value })}
                aria-label="Quantity"
              />
              <MoneyInput
                value={item.unitCostSnapshot}
                onValueChange={(value) => updateItem(index, { unitCostSnapshot: value })}
                aria-label="Cost"
              />
              <MoneyInput
                value={item.unitPrice}
                onValueChange={(value) => updateItem(index, { unitPrice: value })}
                aria-label="Unit price"
              />
              <div className="flex min-h-10 items-center text-sm font-semibold">
                {money(lineProfit(item))}
              </div>
              <MoneyInput
                max={itemSubtotal(item)}
                value={item.discountValue}
                onValueChange={(value) => updateItem(index, { discountValue: value })}
                aria-label="Discount"
              />
              <div className="flex min-h-10 items-center text-sm font-semibold">
                {money(lineTotal(item))}
              </div>
              <div className="flex min-h-10 items-center justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => confirmRemoveItem(index)}
                  className="min-h-9 px-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Remove item</span>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 lg:hidden">
        {items.map((item, index) => (
          <div key={index} className="rounded-lg border border-border bg-panel p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <ItemThumb item={item} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {item.itemName || `Item ${index + 1}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.snapshotProductCode ?? (item.itemType === "CATALOG_PRODUCT" ? "Catalog" : "Custom")}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => confirmRemoveItem(index)}
                  className="min-h-9 px-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Remove item</span>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground sm:col-span-2">
                Item
                <Input
                  value={item.itemName}
                  onChange={(event) => updateItem(index, { itemName: event.target.value })}
                  placeholder="Item name"
                  className="font-normal normal-case"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
                Qty
                <QuantityInput
                  value={item.quantity}
                  onValueChange={(value) => updateItem(index, { quantity: value })}
                  aria-label="Quantity"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
                Cost
                <MoneyInput
                  value={item.unitCostSnapshot}
                  onValueChange={(value) => updateItem(index, { unitCostSnapshot: value })}
                  aria-label="Cost"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
                Unit Price
                <MoneyInput
                  value={item.unitPrice}
                  onValueChange={(value) => updateItem(index, { unitPrice: value })}
                  aria-label="Unit price"
                />
              </label>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-soft-accent/30 px-3 py-2 text-sm">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Profit</span>
                <span className="font-semibold">{money(lineProfit(item))}</span>
              </div>
              <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
                Discount
                <MoneyInput
                  max={itemSubtotal(item)}
                  value={item.discountValue}
                  onValueChange={(value) => updateItem(index, { discountValue: value })}
                  aria-label="Discount"
                />
              </label>
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Line total</span>
                <span className="font-semibold">{money(lineTotal(item))}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <QuotationItemCostProfitSummary items={items} finalTotal={finalTotal} />
    </div>
  );
}

function QuotationItemCostProfitSummary({
  items,
  finalTotal
}: {
  items: ItemDraft[];
  finalTotal: number;
}) {
  const totalCost = roundMoney(items.reduce((sum, item) => sum + lineCostTotal(item), 0));
  const grossProfit = roundMoney(finalTotal - totalCost);

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <div className="grid min-w-[1280px] grid-cols-[minmax(320px,1fr)_92px_140px_128px_128px_128px_128px_76px] gap-4 rounded-lg border border-border bg-soft-accent/45 px-4 py-3 text-sm">
          <div className="col-start-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Total cost</p>
            <p className="mt-1 font-semibold text-foreground">{money(totalCost)}</p>
          </div>
          <div className="col-start-5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Gross profit</p>
            <p className="mt-1 font-semibold text-foreground">{money(grossProfit)}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 rounded-lg border border-border bg-soft-accent/45 p-4 text-sm sm:grid-cols-2 lg:hidden">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Total cost</p>
          <p className="mt-1 font-semibold text-foreground">{money(totalCost)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Gross profit</p>
          <p className="mt-1 font-semibold text-foreground">{money(grossProfit)}</p>
        </div>
      </div>
    </>
  );
}

function ItemThumb({ item }: { item: ItemDraft }) {
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-soft-accent/40 bg-cover bg-center text-muted-foreground"
      style={item.images[0]?.secureUrl ? { backgroundImage: `url("${item.images[0].secureUrl}")` } : undefined}
    >
      {!item.images[0]?.secureUrl ? <ImagePlus className="h-4 w-4" /> : null}
    </div>
  );
}

export function QuotationBuilder({
  customers,
  products,
  canCreateCustomers,
  backHref,
  backLabel,
  mode = "create",
  initialQuotation
}: QuotationBuilderProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    mode === "edit" ? updateDraftQuotationAction : createQuotationAction,
    initialState
  );
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(
    initialQuotation?.customer ?? null
  );
  const [items, setItems] = useState<ItemDraft[]>(
    () =>
      initialQuotation?.items.map((item) => ({
        ...item,
        quantity: normalizeQuantity(item.quantity)
      })) ?? []
  );
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [additionalDiscount, setAdditionalDiscount] = useState(
    initialQuotation?.quotationDiscountValue ?? 0
  );
  const [noteOpen, setNoteOpen] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [customerNotes, setCustomerNotes] = useState(initialQuotation?.customerNotes ?? "");
  const [needsAssembly, setNeedsAssembly] = useState(initialQuotation?.needsAssembly ?? false);
  const [salesInvoiceRequested, setSalesInvoiceRequested] = useState(
    initialQuotation?.salesInvoiceRequested ?? false
  );
  const [modeOfDelivery, setModeOfDelivery] = useState(initialQuotation?.modeOfDelivery ?? "");
  const [deliveryMethod, setDeliveryMethod] = useState(initialQuotation?.deliveryMethod ?? "");
  const [paymentTerms, setPaymentTerms] = useState(initialQuotation?.paymentTerms ?? "");
  const [specialInstructions, setSpecialInstructions] = useState(
    initialQuotation?.specialInstructions ?? ""
  );
  const [internalNotes, setInternalNotes] = useState(initialQuotation?.internalNotes ?? "");

  useEffect(() => {
    if (state.ok && state.quotationId) {
      router.push(`/quotations/${state.quotationId}`);
      router.refresh();
    }
  }, [router, state.ok, state.quotationId]);

  const totals = useMemo(() => {
    const subtotalAmount = roundMoney(items.reduce((sum, item) => sum + itemSubtotal(item), 0));
    const itemDiscountTotal = roundMoney(items.reduce((sum, item) => sum + itemDiscount(item), 0));
    const postItemDiscountTotal = roundMoney(items.reduce((sum, item) => sum + lineTotal(item), 0));
    const quotationDiscountAmount = roundMoney(Math.max(additionalDiscount || 0, 0));

    return {
      subtotalAmount,
      itemDiscountTotal,
      postItemDiscountTotal,
      quotationDiscountAmount,
      totalDiscount: roundMoney(itemDiscountTotal + quotationDiscountAmount),
      totalAmount: roundMoney(Math.max(postItemDiscountTotal - quotationDiscountAmount, 0))
    };
  }, [items, additionalDiscount]);

  const validationMessages = useMemo(() => {
    const messages: string[] = [];

    if (!selectedCustomer?.id) {
      messages.push("Select or enter a customer name.");
    }

    if (!items.length) {
      messages.push("Add at least one item to continue.");
    }

    items.forEach((item, index) => {
      if (!item.itemName.trim()) {
        messages.push(`Item ${index + 1} needs a name.`);
      }

      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        messages.push(`Item ${index + 1} quantity must be a whole number of at least 1.`);
      }

      if (item.discountValue < 0) {
        messages.push(`Item ${index + 1} discount cannot be negative.`);
      }

      if (itemDiscount(item) > itemSubtotal(item)) {
        messages.push(`Item ${index + 1} discount cannot exceed its subtotal.`);
      }
    });

    if (additionalDiscount < 0) {
      messages.push("Additional discount cannot be negative.");
    }

    if (additionalDiscount > totals.postItemDiscountTotal) {
      messages.push("Additional discount cannot exceed subtotal after item discounts.");
    }

    return messages;
  }, [additionalDiscount, items, selectedCustomer?.id, totals.postItemDiscountTotal]);

  function addCustomItem() {
    setItems((current) => [...current, createCustomItem(current.length)]);
  }

  function addProduct(product: ProductOption) {
    setItems((current) => {
      const existingIndex = current.findIndex((item) => {
        if (item.itemType !== "CATALOG_PRODUCT") {
          return false;
        }

        if (item.productId && product.id) {
          return item.productId === product.id;
        }

        return Boolean(item.snapshotProductCode && product.code && item.snapshotProductCode === product.code);
      });

      if (existingIndex >= 0) {
        return current.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: normalizeQuantity(item.quantity + 1) }
            : item
        );
      }

      return [...current, createCatalogItem(product, current.length)];
    });
  }

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
              quantity:
                patch.quantity === undefined ? item.quantity : normalizeQuantity(patch.quantity)
            }
          : item
      )
    );
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  const showClientValidation = hasAttemptedSubmit && validationMessages.length > 0;

  return (
    <>
      <ProductPicker
        products={products}
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onAdd={addProduct}
      />
      <div className="space-y-6">
        {backHref && backLabel ? (
          <Link
            href={backHref}
            className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-lg border border-border bg-soft-accent/70 px-4 text-sm font-semibold text-foreground transition hover:bg-soft-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        ) : null}
        <CustomerSelector
          customers={customers}
          selectedCustomer={selectedCustomer}
          setSelectedCustomer={setSelectedCustomer}
          canCreateCustomers={canCreateCustomers}
        />
      </div>
      <form
        action={action}
        onSubmit={() => setHasAttemptedSubmit(true)}
        className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]"
      >
        {initialQuotation?.id ? (
          <input type="hidden" name="quotationId" value={initialQuotation.id} />
        ) : null}
        <input type="hidden" name="customerId" value={selectedCustomer?.id ?? ""} />
        <input type="hidden" name="items" value={JSON.stringify(toActionItems(items))} />
        <input
          type="hidden"
          name="quotationDiscountType"
          value={additionalDiscount > 0 ? "FIXED_AMOUNT" : ""}
        />
        <input type="hidden" name="quotationDiscountValue" value={additionalDiscount} />
        <input
          type="hidden"
          name="needsAssembly"
          value={needsAssembly ? "true" : "false"}
        />
        <input
          type="hidden"
          name="salesInvoiceRequested"
          value={salesInvoiceRequested ? "true" : "false"}
        />

        <section className="space-y-5">
          <section className="studio-card">
            <div className="studio-card-header flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="studio-kicker">Items</p>
                <h2 className="text-sm font-semibold">Build the quotation cart</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setProductPickerOpen(true)}>
                  <PackageSearch className="h-4 w-4" />
                  Add product
                </Button>
                <Button type="button" variant="secondary" onClick={addCustomItem}>
                  <Plus className="h-4 w-4" />
                  Add custom item
                </Button>
              </div>
            </div>
            <div className="p-5">
              {items.length ? (
                <QuotationItemTable
                  items={items}
                  updateItem={updateItem}
                  removeItem={removeItem}
                  finalTotal={totals.totalAmount}
                />
              ) : (
                <div className="studio-empty flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                  <ShoppingCart className="h-7 w-7 text-accent" />
                  <p className="text-sm">Add a product or custom item to start the quotation.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button type="button" variant="secondary" onClick={() => setProductPickerOpen(true)}>
                      <PackageSearch className="h-4 w-4" />
                      Add product
                    </Button>
                    <Button type="button" variant="secondary" onClick={addCustomItem}>
                      <Plus className="h-4 w-4" />
                      Add custom item
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <details
            className="studio-card"
            open={noteOpen}
            onToggle={(event) => setNoteOpen(event.currentTarget.open)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold">
              <span>Quotation note</span>
              <ChevronDown className={cn("h-4 w-4 transition", noteOpen ? "rotate-180" : undefined)} />
            </summary>
            <div className="border-t border-border p-5">
              <Textarea
                name="customerNotes"
                value={customerNotes}
                onChange={(event) => setCustomerNotes(event.target.value)}
                placeholder="Optional note for this quotation"
                className="min-h-24"
              />
            </div>
          </details>

          <section className="studio-card">
            <div className="studio-card-header">
              <p className="studio-kicker">Terms</p>
              <h2 className="text-sm font-semibold">Terms, delivery, and instructions</h2>
            </div>
            <div className="grid gap-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border bg-background px-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={needsAssembly}
                    onChange={(event) => setNeedsAssembly(event.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Needs assembly
                </label>
                <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border bg-background px-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={salesInvoiceRequested}
                    onChange={(event) => setSalesInvoiceRequested(event.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Sales invoice requested
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  <span className="text-muted-foreground">Mode of delivery</span>
                  <Input
                    name="modeOfDelivery"
                    value={modeOfDelivery}
                    onChange={(event) => setModeOfDelivery(event.target.value)}
                    placeholder="Delivery, pickup, third-party courier"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  <span className="text-muted-foreground">Delivery method</span>
                  <Input
                    name="deliveryMethod"
                    value={deliveryMethod}
                    onChange={(event) => setDeliveryMethod(event.target.value)}
                    placeholder="Furniture Odyssey truck, client pickup"
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                <span className="text-muted-foreground">Payment terms</span>
                <Textarea
                  name="paymentTerms"
                  value={paymentTerms}
                  onChange={(event) => setPaymentTerms(event.target.value)}
                  placeholder="Downpayment, balance timing, installment notes"
                  className="min-h-24"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span className="text-muted-foreground">Special instructions</span>
                <Textarea
                  name="specialInstructions"
                  value={specialInstructions}
                  onChange={(event) => setSpecialInstructions(event.target.value)}
                  placeholder="Delivery access, assembly notes, customer requests"
                  className="min-h-24"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span className="text-muted-foreground">Internal notes</span>
                <Textarea
                  name="internalNotes"
                  value={internalNotes}
                  onChange={(event) => setInternalNotes(event.target.value)}
                  placeholder="Staff-only quotation notes"
                  className="min-h-24"
                />
              </label>
            </div>
          </section>
        </section>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <section className="studio-card">
            <div className="studio-card-header">
              <p className="studio-kicker">Summary</p>
              <h2 className="text-sm font-semibold">Quotation summary</h2>
            </div>
            <div className="p-5 text-sm">
              <div className="border-b border-border pb-4">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="text-right font-semibold">
                    {selectedCustomer?.displayName ?? "Not selected"}
                  </span>
                </div>
                {selectedCustomer?.detail ? (
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {selectedCustomer.detail}
                  </p>
                ) : null}
              </div>
              <div className="max-h-64 overflow-y-auto border-b border-border py-2">
                {items.map((item, index) => (
                  <div key={index} className="py-2">
                    <div className="flex justify-between gap-4">
                      <div className="min-w-0">
                        <p className="whitespace-normal break-words font-medium leading-5">
                          {item.quantity} x {item.itemName || `Item ${index + 1}`}
                        </p>
                        {item.description ? (
                          <p className="mt-1 whitespace-normal break-words text-xs leading-5 text-muted-foreground">
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 font-semibold">{money(lineTotal(item))}</span>
                    </div>
                    {itemDiscount(item) > 0 ? (
                      <div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
                        <span>Discount</span>
                        <span>-{money(itemDiscount(item))}</span>
                      </div>
                    ) : null}
                  </div>
                ))}
                {!items.length ? (
                  <div className="py-4 text-muted-foreground">No items added yet.</div>
                ) : null}
              </div>
              <div className="space-y-3 py-4">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{money(totals.subtotalAmount)}</span>
                </div>
                {totals.itemDiscountTotal > 0 ? (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Item discounts</span>
                    <span className="font-medium">-{money(totals.itemDiscountTotal)}</span>
                  </div>
                ) : null}
                <label className="grid gap-2 font-medium">
                  <span className="text-muted-foreground">Additional discount</span>
                  <MoneyInput
                    max={totals.postItemDiscountTotal}
                    value={additionalDiscount}
                    onValueChange={setAdditionalDiscount}
                    aria-label="Additional discount"
                  />
                </label>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Total discount</span>
                  <span className="font-medium">-{money(totals.totalDiscount)}</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-4 text-base">
                  <span className="font-semibold">Final total</span>
                  <span className="text-lg font-semibold">{money(totals.totalAmount)}</span>
                </div>
              </div>
              {showClientValidation ? (
                <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-danger">
                  {validationMessages[0]}
                </div>
              ) : null}
              {state.message && (state.ok || !showClientValidation) ? (
                <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>
                  {friendlyActionMessage(state.message)}
                </p>
              ) : null}
              <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-[auto_1fr]">
                <Link
                  href={mode === "edit" && initialQuotation?.id ? `/quotations/${initialQuotation.id}` : "/quotations"}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 text-sm font-semibold text-danger transition hover:bg-danger/15"
                >
                  <X className="h-4 w-4" />
                  Discard
                </Link>
                <Button
                  disabled={pending || state.ok}
                  name="intent"
                  value="save_draft"
                >
                  <Save className="h-4 w-4" />
                  {mode === "edit" ? "Update quotation" : "Save draft"}
                </Button>
              </div>
            </div>
          </section>
        </aside>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-panel/95 p-3 shadow-xl backdrop-blur xl:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Final total</p>
              <p className="font-semibold">{money(totals.totalAmount)}</p>
            </div>
            <Button
              disabled={pending || state.ok}
              name="intent"
              value="save_draft"
              className="min-h-10"
            >
              <Save className="h-4 w-4" />
              {mode === "edit" ? "Update quotation" : "Save draft"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

function QuotationRecordActions({
  quotation,
  statusAction,
  deleteAction,
  pending,
  canUpdateQuotations,
  canApproveQuotations,
  canDeleteQuotations
}: {
  quotation: QuotationRow;
  statusAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  pending: boolean;
  canUpdateQuotations: boolean;
  canApproveQuotations: boolean;
  canDeleteQuotations: boolean;
}) {
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
    placement: "above" | "below";
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isSubmitting, startActionTransition] = useTransition();
  const isOpen = menuPosition !== null;
  const isBusy = pending || isSubmitting;

  const canShowMenu =
    ((quotation.status === "DRAFT" || quotation.status === "SENT") &&
      (canApproveQuotations || canUpdateQuotations)) ||
    canDeleteQuotations;

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

  function toggleMenu() {
    if (isBusy) {
      return;
    }

    if (isOpen) {
      setMenuPosition(null);
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const menuWidth = 192;
    const estimatedHeight = 188;
    const hasRoomBelow = rect.bottom + estimatedHeight + 12 < window.innerHeight;
    setMenuPosition({
      left: Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rect.right - menuWidth)),
      top: hasRoomBelow ? rect.bottom + 8 : rect.top - 8,
      placement: hasRoomBelow ? "below" : "above"
    });
  }

  function submitStatusUpdate(nextStatus: QuotationStatus) {
    const formData = new FormData();
    formData.set("quotationId", quotation.id);
    formData.set("status", nextStatus);

    setMenuPosition(null);
    startActionTransition(() => {
      statusAction(formData);
    });
  }

  function submitDelete() {
    const formData = new FormData();
    formData.set("quotationId", quotation.id);

    setMenuPosition(null);
    startActionTransition(() => {
      deleteAction(formData);
    });
  }

  if (!canShowMenu) {
    return null;
  }

  return (
    <div className="contents">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={isBusy}
        onClick={toggleMenu}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border bg-panel px-2 text-sm font-semibold text-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">Quotation actions</span>
      </button>
      {isOpen ? (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[80] grid min-w-48 gap-1 rounded-lg border border-border bg-panel p-2 shadow-xl"
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            transform: menuPosition.placement === "above" ? "translateY(-100%)" : undefined
          }}
        >
          {(quotation.status === "DRAFT" || quotation.status === "SENT") && canUpdateQuotations ? (
            <a
              href={`/quotations/${quotation.id}/edit`}
              role="menuitem"
              className="inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-soft-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              onClick={(event) => {
                event.stopPropagation();
                setMenuPosition(null);
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit quotation
            </a>
          ) : null}
          {(quotation.status === "DRAFT" || quotation.status === "SENT") && canApproveQuotations ? (
            <Button
              type="button"
              variant="ghost"
              disabled={isBusy}
              role="menuitem"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                submitStatusUpdate("ACCEPTED");
              }}
              className="min-h-9 justify-start rounded-md px-3"
            >
              <CheckCircle2 className="h-4 w-4" />
              Accept
            </Button>
          ) : null}
          {(quotation.status === "DRAFT" || quotation.status === "SENT") && canUpdateQuotations ? (
            <Button
              type="button"
              variant="ghost"
              disabled={isBusy}
              role="menuitem"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                submitStatusUpdate("CANCELLED");
              }}
              className="min-h-9 justify-start rounded-md px-3"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          ) : null}
          {canDeleteQuotations ? (
            <Button
              type="button"
              variant="ghost"
              disabled={isBusy}
              role="menuitem"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();

                if (!window.confirm(`Delete ${quotation.quotationNumber ?? "this quotation"}?`)) {
                  return;
                }

                submitDelete();
              }}
              className="min-h-9 justify-start rounded-md px-3 text-danger hover:bg-danger/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function QuotationRecordsList({
  quotations,
  query = "",
  status = "",
  view = "active",
  pagination,
  canExportDocuments,
  canUpdateQuotations,
  canApproveQuotations,
  canDeleteQuotations
}: QuotationRecordsListProps) {
  const router = useRouter();
  const normalizedStatus = normalizeStatusFilter(status);
  const normalizedView = normalizeQuotationView(view);
  const [rows, setRows] = useState<QuotationRow[]>(quotations);
  const [searchQuery, setSearchQuery] = useState(query);
  const [selectedStatus, setSelectedStatus] = useState(normalizedStatus);
  const [selectedView, setSelectedView] = useState(normalizedView);
  const [statusState, statusAction, statusPending] = useActionState(
    updateQuotationStatusAction,
    initialState
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteQuotationAction,
    initialState
  );

  useEffect(() => {
    setSearchQuery(query);
  }, [query]);

  useEffect(() => {
    setRows(quotations);
  }, [quotations]);

  useEffect(() => {
    setSelectedStatus(normalizedStatus);
  }, [normalizedStatus]);

  useEffect(() => {
    setSelectedView(normalizedView);
  }, [normalizedView]);

  useEffect(() => {
    if (statusState.message) {
      if (statusState.ok && statusState.quotationId && statusState.status) {
        setRows((current) =>
          current.map((quotation) =>
            quotation.id === statusState.quotationId
              ? { ...quotation, status: statusState.status ?? quotation.status }
              : quotation
          )
        );
      }

      router.refresh();
    }
  }, [router, statusState.message, statusState.ok, statusState.quotationId, statusState.status]);

  useEffect(() => {
    if (deleteState.message) {
      if (deleteState.ok && deleteState.quotationId) {
        setRows((current) => current.filter((quotation) => quotation.id !== deleteState.quotationId));
      }

      router.refresh();
    }
  }, [deleteState.message, deleteState.ok, deleteState.quotationId, router]);

  function quotationHref(nextQuery: string, nextStatus: string, nextView: string, page?: number) {
    const params = new URLSearchParams();
    const safeStatus = normalizeStatusFilter(nextStatus);
    const safeView = normalizeQuotationView(nextView);
    const safeQuery = nextQuery.trim();

    if (safeQuery) {
      params.set("q", safeQuery);
    }

    if (safeView !== "active") {
      params.set("view", safeView);
    }

    if (safeStatus) {
      params.set("status", safeStatus);
    }

    if (page && page > 1) {
      params.set("page", String(page));
    }

    const queryString = params.toString();
    return queryString ? `/quotations?${queryString}` : "/quotations";
  }

  function applyFilters(
    nextQuery = searchQuery,
    nextStatus = selectedStatus,
    nextView = selectedView
  ) {
    router.push(quotationHref(nextQuery, nextStatus, nextView));
  }

  function pageHref(page: number) {
    return quotationHref(query, normalizedStatus, normalizedView, page);
  }

  function openQuotation(quotationId: string) {
    router.push(`/quotations/${quotationId}`);
  }

  const emptyStatusLabel = normalizedStatus ? labelFromEnum(normalizedStatus) : "selected";
  const hasActiveFilters = Boolean(query || normalizedStatus || normalizedView !== "active");
  const emptyRecordMessage = hasActiveFilters
    ? normalizedStatus && query
      ? `No ${emptyStatusLabel.toLowerCase()} quotation records match "${query}".`
      : normalizedStatus
        ? `No ${emptyStatusLabel.toLowerCase()} quotation records are currently saved.`
        : `No quotation records match "${query}".`
    : "Created quotation records will appear here after staff save a draft.";

  return (
    <section className="studio-card">
      <div className="studio-card-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="studio-kicker">Records</p>
            <h2 className="text-sm font-semibold">Quotation records</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search quotation records and update their workflow status without opening the builder.
            </p>
          </div>
          <form
            className="grid w-full gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_180px_112px] lg:w-auto lg:grid-cols-[260px_150px_180px_112px]"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <Input
              name="q"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search quotations"
            />
            <Select
              name="view"
              value={selectedView}
              aria-label="Quotation view"
              onChange={(event) => {
                const nextView = normalizeQuotationView(event.target.value);
                setSelectedView(nextView);
                applyFilters(searchQuery, selectedStatus, nextView);
              }}
            >
              <option value="active">Active</option>
              <option value="converted">Converted</option>
              <option value="all">All</option>
            </Select>
            <Select
              name="status"
              value={selectedStatus}
              aria-label="Status filter"
              onChange={(event) => {
                const nextStatus = event.target.value;
                setSelectedStatus(nextStatus);
                applyFilters(searchQuery, nextStatus);
              }}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="DECLINED">Declined</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <Button>
              <Search className="h-4 w-4" />
              Search
            </Button>
          </form>
        </div>
        {statusState.message || deleteState.message ? (
          <p
            className={
              statusState.message
                ? statusState.ok
                  ? "mt-2 text-sm text-success"
                  : "mt-2 text-sm text-danger"
                : deleteState.ok
                  ? "mt-2 text-sm text-success"
                  : "mt-2 text-sm text-danger"
            }
          >
            {statusState.message || deleteState.message}
          </p>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="studio-table w-full min-w-[1040px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Quotation</th>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Items</th>
              <th className="px-5 py-3 font-medium">Subtotal</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Created by</th>
              <th className="px-5 py-3 font-medium">Updated</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          {rows.length > 0 ? (
            <tbody className="divide-y divide-border">
              {rows.map((quotation) => (
                <tr
                  key={quotation.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openQuotation(quotation.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openQuotation(quotation.id);
                    }
                  }}
                  className="cursor-pointer transition hover:bg-soft-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <td className="px-5 py-3 font-medium">
                    <a
                      href={`/quotations/${quotation.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="text-primary hover:underline"
                    >
                      {quotation.quotationNumber ?? "Not assigned"}
                    </a>
                    {quotation.orderId ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span>Converted to {quotation.orderNumber ?? "order"}</span>
                        <Link
                          href={orderHref(quotation.orderId)}
                          onClick={(event) => event.stopPropagation()}
                          className="text-accent hover:underline"
                        >
                          View order
                        </Link>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 font-medium">{quotation.customerName}</td>
                  <td className="px-5 py-3" onClick={(event) => event.stopPropagation()}>
                    <QuotationStatusSelect
                      quotation={quotation}
                      action={statusAction}
                      pending={statusPending}
                      canUpdateQuotations={canUpdateQuotations}
                      canApproveQuotations={canApproveQuotations}
                    />
                  </td>
                  <td className="max-w-[260px] px-5 py-3 text-muted-foreground">
                    <span className="line-clamp-2">{quotation.itemSummary}</span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{quotation.subtotalAmount}</td>
                  <td className="px-5 py-3 font-medium">{quotation.totalAmount}</td>
                  <td className="px-5 py-3 text-muted-foreground">{quotation.createdBy ?? "Unknown"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{quotation.updatedAt}</td>
                  <td className="px-5 py-3" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/quotations/${quotation.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className={pdfLinkClass}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </a>
                      {canExportDocuments ? (
                        <a
                          href={`/api/documents/quotation/${quotation.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className={pdfLinkClass}
                        >
                          <Download className="h-4 w-4" />
                          PDF
                        </a>
                      ) : null}
                      {quotation.orderId ? (
                        <Link
                          href={orderHref(quotation.orderId)}
                          onClick={(event) => event.stopPropagation()}
                          className={pdfLinkClass}
                        >
                          <ShoppingCart className="h-4 w-4" />
                          View order
                        </Link>
                      ) : null}
                      <QuotationRecordActions
                        quotation={quotation}
                        statusAction={statusAction}
                        deleteAction={deleteAction}
                        pending={statusPending || deletePending}
                        canUpdateQuotations={canUpdateQuotations}
                        canApproveQuotations={canApproveQuotations}
                        canDeleteQuotations={canDeleteQuotations}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          ) : null}
        </table>
      </div>
      {rows.length === 0 ? (
        <div className="border-t border-border px-5 py-12 text-center">
          <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-3">
            <p className="text-sm font-semibold text-foreground">
              {hasActiveFilters ? "No matching quotations" : "No quotations yet"}
            </p>
            <p className="text-sm text-muted-foreground">{emptyRecordMessage}</p>
            {hasActiveFilters ? (
              <Link href="/quotations" className="text-sm font-semibold text-accent hover:underline">
                Clear filters
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 border-t border-border px-5 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {pagination.totalCount > 0
            ? `Showing ${pagination.from}-${pagination.to} of ${pagination.totalCount}`
            : "Showing 0 of 0"}
        </p>
        <div className="flex items-center gap-2">
          <a
            href={pageHref(Math.max(1, pagination.page - 1))}
            aria-disabled={pagination.page <= 1}
            className={cn(
              pdfLinkClass,
              pagination.page <= 1 && "pointer-events-none opacity-50"
            )}
          >
            Previous
          </a>
          <span className="px-2">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <a
            href={pageHref(Math.min(pagination.totalPages, pagination.page + 1))}
            aria-disabled={pagination.page >= pagination.totalPages}
            className={cn(
              pdfLinkClass,
              pagination.page >= pagination.totalPages && "pointer-events-none opacity-50"
            )}
          >
            Next
          </a>
        </div>
      </div>
    </section>
  );
}

export function QuotationDetailActions({
  quotationId,
  status,
  canExportDocuments,
  canUpdateQuotations,
  canApproveQuotations,
  canCreateOrders,
  order
}: QuotationDetailActionsProps) {
  const router = useRouter();
  const [statusState, statusAction, statusPending] = useActionState(
    updateQuotationStatusAction,
    initialState
  );
  const [convertState, convertAction, convertPending] = useActionState(
    convertQuotationToOrderAction,
    initialState
  );
  const linkedOrderId = order?.id ?? convertState.orderId ?? null;
  const linkedOrderNumber = order?.orderNumber ?? convertState.orderNumber ?? null;

  useEffect(() => {
    if (statusState.message || convertState.message) {
      router.refresh();
    }
  }, [convertState.message, router, statusState.message]);

  return (
    <div className="space-y-3">
      <form action={statusAction} className="grid gap-2">
        <input type="hidden" name="quotationId" value={quotationId} />
        {canExportDocuments ? (
          <a href={`/api/documents/quotation/${quotationId}`} className={cn(pdfLinkClass, "w-full justify-start px-3")}>
            <Download className="h-4 w-4" />
            Download PDF
          </a>
        ) : null}
        {(status === "DRAFT" || status === "SENT") && canUpdateQuotations ? (
          <a href={`/quotations/${quotationId}/edit`} className={cn(pdfLinkClass, "w-full justify-start px-3")}>
            <Pencil className="h-4 w-4" />
            Edit quotation
          </a>
        ) : null}
        {status === "DRAFT" && canUpdateQuotations ? (
          <Button
            type="submit"
            name="status"
            value="SENT"
            variant="secondary"
            disabled={statusPending}
            className="w-full justify-start"
          >
            <Send className="h-4 w-4" />
            Mark as sent
          </Button>
        ) : null}
        {(status === "DRAFT" || status === "SENT") && canApproveQuotations ? (
          <Button
            type="submit"
            name="status"
            value="ACCEPTED"
            variant="secondary"
            disabled={statusPending}
            className="w-full justify-start"
          >
            <CheckCircle2 className="h-4 w-4" />
            Accept
          </Button>
        ) : null}
        {status === "SENT" && canApproveQuotations ? (
          <Button
            type="submit"
            name="status"
            value="DECLINED"
            variant="secondary"
            disabled={statusPending}
            className="w-full justify-start"
          >
            <XCircle className="h-4 w-4" />
            Decline
          </Button>
        ) : null}
        {(status === "DRAFT" || status === "SENT") && canUpdateQuotations ? (
          <Button
            type="submit"
            name="status"
            value="CANCELLED"
            variant="secondary"
            disabled={statusPending}
            className="w-full justify-start"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
        ) : null}
      </form>
      {status === "ACCEPTED" && !linkedOrderId && canCreateOrders ? (
        <form action={convertAction} className="grid gap-2 border-t border-border pt-3">
          <input type="hidden" name="quotationId" value={quotationId} />
          <Button disabled={convertPending} className="w-full justify-start">
            <ShoppingCart className="h-4 w-4" />
            Create order from quotation
          </Button>
        </form>
      ) : null}
      {linkedOrderId ? (
        <Link
          href={orderHref(linkedOrderId)}
          className={cn(pdfLinkClass, "w-full justify-start px-3")}
        >
          <ShoppingCart className="h-4 w-4" />
          View order
          {linkedOrderNumber ? (
            <span className="ml-auto text-xs text-muted-foreground">{linkedOrderNumber}</span>
          ) : null}
        </Link>
      ) : null}
      {statusState.message ? (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            statusState.ok
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          )}
        >
          {statusState.message}
        </p>
      ) : null}
      {convertState.message ? (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            convertState.ok
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          )}
        >
          {convertState.message}
          {convertState.ok && convertState.orderId ? (
            <Link href={orderHref(convertState.orderId)} className="ml-2 font-semibold underline">
              View order
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
