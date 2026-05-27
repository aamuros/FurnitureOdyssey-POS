"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { FormEvent, MouseEvent as ReactMouseEvent } from "react";
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
import { AdminModal } from "@/components/dashboard/admin-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePersistentPageState } from "@/lib/use-persistent-page-state";
import { cn } from "@/lib/utils";

type CustomerOption = {
  id: string;
  displayName: string;
  companyName: string | null;
  primaryContact: string | null;
};

type ProductImageOption = {
  id: string;
  cloudinaryPublicId: string;
  secureUrl: string;
  resourceType: string;
  format: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  altText: string | null;
};

type ProductColorVariantOption = {
  id: string;
  name: string;
  hex: string | null;
  image: ProductImageOption | null;
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
  primaryImage: ProductImageOption | null;
  colorVariants: ProductColorVariantOption[];
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
  persistenceUserKey?: string | null;
  backHref?: string;
  backLabel?: string;
  mode?: "create" | "edit";
  initialQuotation?: {
    id: string;
    status: string;
    customer: SelectedCustomer;
    items: ItemDraft[];
    quotationDiscountValue: number;
    additionalFees?: number;
    needsAssembly: boolean;
    assemblyFeeRate?: number;
    salesInvoiceRequested: boolean;
    salesInvoiceFeePercentage?: number;
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
  selectedVariantId?: string;
  selectedVariantName?: string;
  selectedVariantHex?: string;
  itemName: string;
  description: string;
  specifications: string;
  quantity: number;
  unitPrice: number;
  unitCostSnapshot: number;
  requiresAssembly: boolean;
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

type QuotationBuilderDraft = {
  selectedCustomer: SelectedCustomer | null;
  items: ItemDraft[];
  productPickerOpen: boolean;
  additionalDiscount: number;
  additionalFees: number;
  noteOpen: boolean;
  termsOpen: boolean;
  customerNotes: string;
  needsAssembly: boolean;
  assemblyFeeRate: number;
  salesInvoiceRequested: boolean;
  salesInvoiceFeePercentage: number;
  modeOfDelivery: string;
  deliveryMethod: string;
  paymentTerms: string;
  specialInstructions: string;
  internalNotes: string;
};

type CustomerSelectorDraft = {
  query: string;
  mode: "existing" | "new";
};

const initialState: ActionState = {
  ok: false,
  message: ""
};

const pdfLinkClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border bg-soft-accent/70 px-2 text-sm font-semibold text-foreground transition hover:bg-soft-accent";
const quotationStatusFilterOptions = ["DRAFT", "SENT", "ACCEPTED", "CANCELLED"] as const;
const quotationViewOptions = ["active", "converted", "all"] as const;
const defaultAssemblyFeeRate = 100;
const defaultSalesInvoiceFeePercentage = 8;
const quotationItemGridClass =
  "grid-cols-[minmax(140px,2fr)_minmax(46px,.42fr)_minmax(66px,.68fr)_minmax(72px,.72fr)_minmax(68px,.62fr)_minmax(70px,.68fr)_minmax(76px,.72fr)_40px]";
const quotationItemAssemblyGridClass =
  "grid-cols-[minmax(64px,.5fr)_minmax(126px,2fr)_minmax(46px,.42fr)_minmax(66px,.68fr)_minmax(72px,.72fr)_minmax(68px,.62fr)_minmax(70px,.68fr)_minmax(76px,.72fr)_40px]";

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

function assemblyFeeTotal(items: ItemDraft[], needsAssembly: boolean, assemblyFeeRate: number) {
  if (!needsAssembly) {
    return 0;
  }

  return roundMoney(
    items.reduce(
      (sum, item) => (item.requiresAssembly ? sum + item.quantity * assemblyFeeRate : sum),
      0
    )
  );
}

function signedMoney(value: number, sign: "+" | "-") {
  return `${sign}${money(value)}`;
}

function createCustomItem(sortOrder: number, requiresAssembly = false): ItemDraft {
  return {
    itemType: "CUSTOM_ITEM",
    sortOrder,
    itemName: "",
    description: "",
    specifications: "",
    quantity: 1,
    unitPrice: 0,
    unitCostSnapshot: 0,
    requiresAssembly,
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
  placeholder = "0",
  className
}: {
  value: number;
  onValueChange: (value: number) => void;
  max?: number;
  "aria-label"?: string;
  placeholder?: string;
  className?: string;
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
      className={className}
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

function toActionItems(items: ItemDraft[], needsAssembly: boolean) {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index,
    quantity: normalizeQuantity(item.quantity),
    requiresAssembly: needsAssembly ? item.requiresAssembly : false,
    discountType: item.discountValue > 0 ? "FIXED_AMOUNT" : undefined,
    discountValue: item.discountValue > 0 ? item.discountValue : undefined,
    description: item.description || undefined,
    specifications: item.specifications || undefined,
    customerNotes: item.customerNotes || undefined,
    internalNotes: item.internalNotes || undefined,
    snapshotProductCode: item.snapshotProductCode || undefined,
    snapshotVariantId: item.selectedVariantId || undefined,
    snapshotVariantName: item.selectedVariantName || undefined,
    snapshotVariantHex: item.selectedVariantHex || undefined,
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

function productImageStyle(product: ProductOption, variant?: ProductColorVariantOption | null) {
  const image = variant?.image ?? product.primaryImage;

  return image?.secureUrl
    ? {
        backgroundImage: `url("${image.secureUrl}")`
      }
    : undefined;
}

function normalizeProductText(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length ? normalized : null;
}

function normalizeProductMoney(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(amount, 0) : null;
}

function normalizeProductImage(image: ProductImageOption | null | undefined): ProductImageOption | null {
  return image?.id && image.cloudinaryPublicId && image.secureUrl && image.resourceType
      ? {
          id: image.id,
          cloudinaryPublicId: image.cloudinaryPublicId,
          secureUrl: image.secureUrl,
          resourceType: image.resourceType,
          format: normalizeProductText(image.format),
          width: image.width ?? null,
          height: image.height ?? null,
          bytes: image.bytes ?? null,
          altText: normalizeProductText(image.altText)
        }
      : null;

}

function normalizeProductOption(product: ProductOption): ProductOption {
  const primaryImage = normalizeProductImage(product.primaryImage);

  return {
    id: product.id,
    code: normalizeProductText(product.code),
    name: normalizeProductText(product.name) ?? "Unnamed product",
    category: normalizeProductText(product.category),
    description: normalizeProductText(product.description),
    specifications: normalizeProductText(product.specifications),
    referencePrice: normalizeProductMoney(product.referencePrice),
    referenceCost: normalizeProductMoney(product.referenceCost),
    primaryImage,
    colorVariants: (product.colorVariants ?? [])
      .map((variant) => ({
        id: variant.id,
        name: normalizeProductText(variant.name) ?? "Unnamed variant",
        hex: normalizeProductText(variant.hex),
        image: normalizeProductImage(variant.image)
      }))
      .filter((variant) => Boolean(variant.id && variant.name))
  };
}

function productImageToDraft(image: ProductImageOption | null, altText: string): ItemImageDraft[] {
  return image
    ? [
        {
          sourceProductImageId: image.id,
          cloudinaryPublicId: image.cloudinaryPublicId,
          secureUrl: image.secureUrl,
          resourceType: image.resourceType,
          format: image.format ?? undefined,
          width: image.width ?? undefined,
          height: image.height ?? undefined,
          bytes: image.bytes ?? undefined,
          altText: image.altText ?? altText,
          sortOrder: 0,
          isPrimary: true
        }
      ]
    : [];
}

function variantSpecifications(specifications: string | null, variant?: ProductColorVariantOption | null) {
  return [specifications, variant ? `Variant: ${variant.name}` : null].filter(Boolean).join("\n");
}

function variantLabel(item: Pick<ItemDraft, "selectedVariantName" | "specifications">) {
  if (item.selectedVariantName) {
    return item.selectedVariantName;
  }

  const variantLine = item.specifications
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith("variant:"));

  return variantLine ? variantLine.replace(/^variant:\s*/i, "") : null;
}

function createCatalogItem(
  product: ProductOption,
  sortOrder: number,
  requiresAssembly = false,
  variant?: ProductColorVariantOption | null
): ItemDraft {
  const selectedImage = variant?.image ?? product.primaryImage;

  return {
    productId: product.id,
    itemType: "CATALOG_PRODUCT",
    sortOrder,
    snapshotProductCode: product.code ?? undefined,
    selectedVariantId: variant?.id,
    selectedVariantName: variant?.name,
    selectedVariantHex: variant?.hex ?? undefined,
    itemName: product.name,
    description: product.description ?? "",
    specifications: variantSpecifications(product.specifications, variant),
    quantity: 1,
    unitPrice: product.referencePrice ?? 0,
    unitCostSnapshot: product.referenceCost ?? 0,
    requiresAssembly,
    discountValue: 0,
    customerNotes: "",
    internalNotes: "",
    images: productImageToDraft(selectedImage, variant ? `${product.name} - ${variant.name}` : product.name)
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
  canCreateCustomers,
  persistenceScope,
  persistenceUserKey
}: {
  customers: CustomerOption[];
  selectedCustomer: SelectedCustomer | null;
  setSelectedCustomer: (value: SelectedCustomer | null) => void;
  canCreateCustomers: boolean;
  persistenceScope: string;
  persistenceUserKey?: string | null;
}) {
  const initialSelectorDraft: CustomerSelectorDraft = {
    query: "",
    mode: "existing"
  };
  const [selectorDraft, setSelectorDraft, selectorPersistence] = usePersistentPageState<CustomerSelectorDraft>({
    scope: `${persistenceScope}:customer-selector`,
    userKey: persistenceUserKey,
    version: 1,
    initialState: initialSelectorDraft
  });
  const hasAppliedSelectorDraft = useRef(false);
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

  useEffect(() => {
    if (!selectorPersistence.restored || hasAppliedSelectorDraft.current) {
      return;
    }

    hasAppliedSelectorDraft.current = true;
    setQuery(selectorDraft.query ?? "");
    setMode(selectorDraft.mode === "new" && canCreateCustomers ? "new" : "existing");
  }, [canCreateCustomers, selectorDraft.mode, selectorDraft.query, selectorPersistence.restored]);

  useEffect(() => {
    if (!selectorPersistence.restored || !hasAppliedSelectorDraft.current || selectedCustomer) {
      return;
    }

    setSelectorDraft({
      query,
      mode
    });
  }, [mode, query, selectedCustomer, selectorPersistence.restored, setSelectorDraft]);

  return (
    <section className="studio-card">
      <div className="studio-card-header">
        <p className="studio-kicker">Customer / Lead</p>
        <h2 className="text-sm font-semibold">Resolve the buyer record</h2>
      </div>
      <div className="p-5">
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
                        onClick={() => {
                          selectorPersistence.clear();
                          setSelectedCustomer({
                            id: customer.id,
                            displayName: customer.displayName,
                            detail: customerDetail(customer)
                          });
                        }}
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
                          onCreated={(customer) => {
                            selectorPersistence.clear();
                            setSelectedCustomer(customer);
                          }}
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
                onCreated={(customer) => {
                  selectorPersistence.clear();
                  setSelectedCustomer(customer);
                }}
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
  const [selectedVariantByProductId, setSelectedVariantByProductId] = useState<Record<string, string>>({});
  const productGridRef = useRef<HTMLDivElement | null>(null);
  const normalizedProducts = useMemo(
    () => products.map((product) => normalizeProductOption(product)),
    [products]
  );
  const filteredProducts = normalizedProducts.filter((product) =>
    toSearchText(
      product.name,
      product.code,
      product.category,
      product.description,
      ...product.colorVariants.map((variant) => variant.name)
    ).includes(query.toLowerCase())
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

  function restoreProductGridScroll(scrollTop: number, scrollLeft: number, activeElement: HTMLElement | null) {
    const grid = productGridRef.current;

    if (grid) {
      grid.scrollTop = scrollTop;
      grid.scrollLeft = scrollLeft;
    }

    if (activeElement?.isConnected) {
      activeElement.focus({ preventScroll: true });
    }
  }

  function addProductWithoutScrollJump(
    product: ProductOption,
    selectedVariant?: ProductColorVariantOption | null,
    event?: ReactMouseEvent<HTMLButtonElement>
  ) {
    event?.preventDefault();

    const grid = productGridRef.current;
    const scrollTop = grid?.scrollTop ?? 0;
    const scrollLeft = grid?.scrollLeft ?? 0;
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    onAdd({ ...product, colorVariants: selectedVariant ? [selectedVariant] : [] });
    restoreProductGridScroll(scrollTop, scrollLeft, activeElement);
    window.requestAnimationFrame(() => {
      restoreProductGridScroll(scrollTop, scrollLeft, activeElement);
      window.requestAnimationFrame(() => {
        restoreProductGridScroll(scrollTop, scrollLeft, activeElement);
      });
    });
  }

  function ProductCard({ product }: { product: ProductOption }) {
    const selectedVariantId = selectedVariantByProductId[product.id] ?? product.colorVariants[0]?.id ?? "";
    const selectedVariant = product.colorVariants.find((variant) => variant.id === selectedVariantId) ?? null;

    return (
      <article className="flex min-h-[380px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
        <div
          className="flex h-48 shrink-0 items-center justify-center border-b border-border bg-soft-accent/40 bg-contain bg-center bg-no-repeat text-muted-foreground sm:h-56 lg:h-60"
          style={productImageStyle(product, selectedVariant)}
        >
          {!(selectedVariant?.image ?? product.primaryImage) ? <ImagePlus className="h-8 w-8" /> : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 break-words text-sm font-semibold">{product.name}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {product.code ? `Code: ${product.code}` : "No product code"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {product.category ? product.category : "No category"}
            </p>
            {product.colorVariants.length ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Color variant</p>
                <div className="flex flex-wrap gap-2">
                  {product.colorVariants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() =>
                        setSelectedVariantByProductId((current) => ({
                          ...current,
                          [product.id]: variant.id
                        }))
                      }
                      className={cn(
                        "inline-flex min-h-8 max-w-full items-center gap-2 rounded-md border px-2 text-xs font-medium",
                        selectedVariantId === variant.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-panel text-muted-foreground"
                      )}
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-border"
                        style={variant.hex ? { backgroundColor: variant.hex } : undefined}
                      />
                      <span className="min-w-0 break-words text-left">{variant.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="mt-auto flex shrink-0 items-center justify-between gap-3 border-t border-border pt-3">
            <span className="min-w-0 truncate text-sm font-semibold">
              {money(product.referencePrice ?? 0)}
            </span>
            <Button
              type="button"
              variant="secondary"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => addProductWithoutScrollJump(product, selectedVariant, event)}
              className="min-h-9 shrink-0 px-3"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <AdminModal
      onBackdropMouseDown={onClose}
      labelledBy="quotation-product-picker-title"
      className="items-start justify-center"
      panelClassName="mx-auto flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-xl"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="studio-kicker">Products</p>
          <h2 id="quotation-product-picker-title" className="text-base font-semibold">
            Add product
          </h2>
        </div>
        <Button type="button" variant="ghost" onClick={onClose} className="min-h-9 px-2">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="shrink-0 border-b border-border p-5">
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
      <div
        ref={productGridRef}
        className="grid min-h-0 flex-1 gap-4 overflow-y-auto overflow-x-hidden overscroll-contain p-5 sm:grid-cols-2 xl:grid-cols-3"
      >
        {filteredProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        {filteredProducts.length === 0 ? (
          <div className="studio-empty px-4 py-8 text-sm md:col-span-2">
            No products match that search.
          </div>
        ) : null}
      </div>
    </AdminModal>
  );
}

function QuotationItemTable({
  items,
  showAssemblyColumn,
  needsAssembly,
  onNeedsAssemblyChange,
  assemblyFeeRate,
  onAssemblyFeeRateChange,
  salesInvoiceRequested,
  onSalesInvoiceRequestedChange,
  salesInvoiceFeePercentage,
  onSalesInvoiceFeePercentageChange,
  updateItem,
  removeItem,
  subtotalAmount
}: {
  items: ItemDraft[];
  showAssemblyColumn: boolean;
  needsAssembly: boolean;
  onNeedsAssemblyChange: (checked: boolean) => void;
  assemblyFeeRate: number;
  onAssemblyFeeRateChange: (value: number) => void;
  salesInvoiceRequested: boolean;
  onSalesInvoiceRequestedChange: (checked: boolean) => void;
  salesInvoiceFeePercentage: number;
  onSalesInvoiceFeePercentageChange: (value: number) => void;
  updateItem: (index: number, patch: Partial<ItemDraft>) => void;
  removeItem: (index: number) => void;
  subtotalAmount: number;
}) {
  function confirmRemoveItem(index: number) {
    const itemName = items[index]?.itemName?.trim() || `item ${index + 1}`;

    if (window.confirm(`Remove ${itemName} from this quotation?`)) {
      removeItem(index);
    }
  }

  return (
    <div className="space-y-3">
      <div className="hidden min-w-[920px] rounded-lg border border-border bg-panel lg:block">
        <div
          className={cn(
            "grid gap-2 border-b border-border bg-soft-accent/35 px-3 py-2 text-[11px] font-semibold uppercase leading-4 text-muted-foreground [&>*]:min-w-0",
            showAssemblyColumn ? quotationItemAssemblyGridClass : quotationItemGridClass
          )}
        >
          {showAssemblyColumn ? <span className="px-1 text-center">Assemble</span> : null}
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
            <div
              className={cn(
                "grid items-start gap-2 px-3 py-3 [&>*]:min-w-0 [&_input]:px-2 [&_input]:text-sm",
                showAssemblyColumn ? quotationItemAssemblyGridClass : quotationItemGridClass
              )}
            >
              {showAssemblyColumn ? (
                <label className="flex min-h-9 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={item.requiresAssembly}
                    onChange={(event) =>
                      updateItem(index, { requiresAssembly: event.target.checked })
                    }
                    aria-label={`Requires assembly for ${item.itemName || `item ${index + 1}`}`}
                    className="h-4 w-4 rounded border-border"
                  />
                </label>
              ) : null}
              <div className="flex min-w-0 items-start gap-2">
                <ItemThumb item={item} compact />
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
                  {variantLabel(item) ? (
                    <p className="mt-1 whitespace-normal break-words text-xs font-medium text-accent">
                      Variant: {variantLabel(item)}
                    </p>
                  ) : null}
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
              <div className="flex min-h-9 min-w-0 items-center break-words text-sm font-semibold leading-5">
                {money(lineProfit(item))}
              </div>
              <MoneyInput
                max={itemSubtotal(item)}
                value={item.discountValue}
                onValueChange={(value) => updateItem(index, { discountValue: value })}
                aria-label="Discount"
              />
              <div className="flex min-h-9 min-w-0 items-center break-words text-sm font-semibold leading-5">
                {money(lineTotal(item))}
              </div>
              <div className="flex min-h-9 items-center justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => confirmRemoveItem(index)}
                  className="h-8 min-h-8 px-2"
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
                  {variantLabel(item) ? (
                    <p className="mt-1 whitespace-normal break-words text-xs font-medium text-accent">
                      Variant: {variantLabel(item)}
                    </p>
                  ) : null}
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
              {showAssemblyColumn ? (
                <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border bg-soft-accent/30 px-3 text-sm font-medium sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={item.requiresAssembly}
                    onChange={(event) =>
                      updateItem(index, { requiresAssembly: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  Requires assembly
                </label>
              ) : null}
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

      <QuotationItemCostProfitSummary
        items={items}
        showAssemblyColumn={showAssemblyColumn}
        subtotalAmount={subtotalAmount}
        needsAssembly={needsAssembly}
        onNeedsAssemblyChange={onNeedsAssemblyChange}
        assemblyFeeRate={assemblyFeeRate}
        onAssemblyFeeRateChange={onAssemblyFeeRateChange}
        salesInvoiceRequested={salesInvoiceRequested}
        onSalesInvoiceRequestedChange={onSalesInvoiceRequestedChange}
        salesInvoiceFeePercentage={salesInvoiceFeePercentage}
        onSalesInvoiceFeePercentageChange={onSalesInvoiceFeePercentageChange}
      />
    </div>
  );
}

function QuotationItemCostProfitSummary({
  items,
  showAssemblyColumn,
  subtotalAmount,
  needsAssembly,
  onNeedsAssemblyChange,
  assemblyFeeRate,
  onAssemblyFeeRateChange,
  salesInvoiceRequested,
  onSalesInvoiceRequestedChange,
  salesInvoiceFeePercentage,
  onSalesInvoiceFeePercentageChange
}: {
  items: ItemDraft[];
  showAssemblyColumn: boolean;
  subtotalAmount: number;
  needsAssembly: boolean;
  onNeedsAssemblyChange: (checked: boolean) => void;
  assemblyFeeRate: number;
  onAssemblyFeeRateChange: (value: number) => void;
  salesInvoiceRequested: boolean;
  onSalesInvoiceRequestedChange: (checked: boolean) => void;
  salesInvoiceFeePercentage: number;
  onSalesInvoiceFeePercentageChange: (value: number) => void;
}) {
  const [assemblyRateOpen, setAssemblyRateOpen] = useState(false);
  const [salesInvoicePercentOpen, setSalesInvoicePercentOpen] = useState(false);
  const totalCost = roundMoney(items.reduce((sum, item) => sum + lineCostTotal(item), 0));
  const grossProfit = roundMoney(subtotalAmount - totalCost);

  const feeControls = (
    <div className="grid gap-2 md:grid-cols-2 lg:max-w-[420px]">
      <div className="rounded-md border border-border bg-panel/70 p-2.5">
        <div className="flex min-h-8 items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={needsAssembly}
              onChange={(event) => onNeedsAssemblyChange(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="truncate">Assemble</span>
          </label>
          <button
            type="button"
            aria-label={assemblyRateOpen ? "Collapse assemble rate" : "Expand assemble rate"}
            aria-expanded={assemblyRateOpen}
            onClick={() => setAssemblyRateOpen((open) => !open)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <ChevronDown className={cn("h-4 w-4 transition", assemblyRateOpen ? "rotate-180" : undefined)} />
          </button>
        </div>
        {assemblyRateOpen ? (
          <label className="mt-2 grid gap-1 border-t border-border pt-2 text-xs font-semibold uppercase text-muted-foreground">
            Rate per assembled item
            <MoneyInput
              value={assemblyFeeRate}
              onValueChange={onAssemblyFeeRateChange}
              aria-label="Needs Assemble rate per item"
            />
            <span className="text-[11px] font-normal normal-case leading-4 text-muted-foreground">
              Default is 100 per selected item quantity.
            </span>
          </label>
        ) : null}
      </div>
      <div className="rounded-md border border-border bg-panel/70 p-2.5">
        <div className="flex min-h-8 items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={salesInvoiceRequested}
              onChange={(event) => onSalesInvoiceRequestedChange(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="truncate">Sales Invoice</span>
          </label>
          <button
            type="button"
            aria-label={salesInvoicePercentOpen ? "Collapse sales invoice percent" : "Expand sales invoice percent"}
            aria-expanded={salesInvoicePercentOpen}
            onClick={() => setSalesInvoicePercentOpen((open) => !open)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <ChevronDown className={cn("h-4 w-4 transition", salesInvoicePercentOpen ? "rotate-180" : undefined)} />
          </button>
        </div>
        {salesInvoicePercentOpen ? (
          <label className="mt-2 grid gap-1 border-t border-border pt-2 text-xs font-semibold uppercase text-muted-foreground">
            Sales invoice percentage
            <MoneyInput
              max={100}
              value={salesInvoiceFeePercentage}
              onValueChange={onSalesInvoiceFeePercentageChange}
              aria-label="Sales Invoice percentage"
            />
            <span className="text-[11px] font-normal normal-case leading-4 text-muted-foreground">
              Default is 8% of the final subtotal.
            </span>
          </label>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden lg:block">
        <div
          className={cn(
            "grid items-center gap-2 rounded-lg border border-border bg-soft-accent/45 px-3 py-3 text-sm [&>*]:min-w-0",
            showAssemblyColumn ? quotationItemAssemblyGridClass : quotationItemGridClass
          )}
        >
          <div className={showAssemblyColumn ? "col-span-3" : "col-span-2"}>
            {feeControls}
          </div>
          <div className="self-center">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Total Cost</p>
            <p className="mt-1 font-semibold text-foreground">{money(totalCost)}</p>
          </div>
          <div aria-hidden="true" />
          <div className="self-center">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Gross Profit</p>
            <p className="mt-1 font-semibold text-foreground">{money(grossProfit)}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 rounded-lg border border-border bg-soft-accent/45 p-4 text-sm sm:grid-cols-2 lg:hidden">
        <div className="sm:col-span-2">{feeControls}</div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Total Cost</p>
          <p className="mt-1 font-semibold text-foreground">{money(totalCost)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Gross Profit</p>
          <p className="mt-1 font-semibold text-foreground">{money(grossProfit)}</p>
        </div>
      </div>
    </>
  );
}

function ItemThumb({ item, compact = false }: { item: ItemDraft; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border border-border bg-soft-accent/40 bg-contain bg-center bg-no-repeat text-muted-foreground",
        compact ? "h-9 w-9" : "h-14 w-14"
      )}
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
  persistenceUserKey,
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
  const [, startBuilderActionTransition] = useTransition();
  const initialBuilderDraft = useMemo<QuotationBuilderDraft>(
    () => ({
      selectedCustomer: initialQuotation?.customer ?? null,
      items:
        initialQuotation?.items.map((item) => ({
          ...item,
          quantity: normalizeQuantity(item.quantity)
        })) ?? [],
      productPickerOpen: false,
      additionalDiscount: initialQuotation?.quotationDiscountValue ?? 0,
      additionalFees: initialQuotation?.additionalFees ?? 0,
      noteOpen: false,
      termsOpen: false,
      customerNotes: initialQuotation?.customerNotes ?? "",
      needsAssembly: initialQuotation?.needsAssembly ?? false,
      assemblyFeeRate: initialQuotation?.assemblyFeeRate ?? defaultAssemblyFeeRate,
      salesInvoiceRequested: initialQuotation?.salesInvoiceRequested ?? false,
      salesInvoiceFeePercentage:
        initialQuotation?.salesInvoiceFeePercentage ?? defaultSalesInvoiceFeePercentage,
      modeOfDelivery: initialQuotation?.modeOfDelivery ?? "",
      deliveryMethod: initialQuotation?.deliveryMethod ?? "",
      paymentTerms: initialQuotation?.paymentTerms ?? "",
      specialInstructions: initialQuotation?.specialInstructions ?? "",
      internalNotes: initialQuotation?.internalNotes ?? ""
    }),
    [initialQuotation]
  );
  const persistenceScope =
    mode === "edit" && initialQuotation?.id
      ? `quotations:${initialQuotation.id}:edit`
      : "quotations:new";
  const [builderDraft, setBuilderDraft, builderPersistence] =
    usePersistentPageState<QuotationBuilderDraft>({
      scope: persistenceScope,
      userKey: persistenceUserKey,
      version: 1,
      initialState: initialBuilderDraft
    });
  const hasAppliedBuilderDraft = useRef(false);
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
  const [additionalFees, setAdditionalFees] = useState(initialQuotation?.additionalFees ?? 0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [customerNotes, setCustomerNotes] = useState(initialQuotation?.customerNotes ?? "");
  const [needsAssembly, setNeedsAssembly] = useState(initialQuotation?.needsAssembly ?? false);
  const [assemblyFeeRate, setAssemblyFeeRate] = useState(
    initialQuotation?.assemblyFeeRate ?? defaultAssemblyFeeRate
  );
  const [salesInvoiceRequested, setSalesInvoiceRequested] = useState(
    initialQuotation?.salesInvoiceRequested ?? false
  );
  const [salesInvoiceFeePercentage, setSalesInvoiceFeePercentage] = useState(
    initialQuotation?.salesInvoiceFeePercentage ?? defaultSalesInvoiceFeePercentage
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
      builderPersistence.clear(initialBuilderDraft);
      router.push(`/quotations/${state.quotationId}`);
      router.refresh();
    }
  }, [builderPersistence, initialBuilderDraft, router, state.ok, state.quotationId]);

  useEffect(() => {
    if (!builderPersistence.restored || hasAppliedBuilderDraft.current) {
      return;
    }

    hasAppliedBuilderDraft.current = true;
    setSelectedCustomer(builderDraft.selectedCustomer ?? null);
    setItems(
      Array.isArray(builderDraft.items)
        ? builderDraft.items.map((item) => ({
            ...item,
            quantity: normalizeQuantity(item.quantity)
          }))
        : []
    );
    setProductPickerOpen(Boolean(builderDraft.productPickerOpen));
    setAdditionalDiscount(Number(builderDraft.additionalDiscount) || 0);
    setAdditionalFees(Number(builderDraft.additionalFees) || 0);
    setNoteOpen(Boolean(builderDraft.noteOpen));
    setTermsOpen(Boolean(builderDraft.termsOpen));
    setCustomerNotes(builderDraft.customerNotes ?? "");
    setNeedsAssembly(Boolean(builderDraft.needsAssembly));
    setAssemblyFeeRate(Number(builderDraft.assemblyFeeRate) || defaultAssemblyFeeRate);
    setSalesInvoiceRequested(Boolean(builderDraft.salesInvoiceRequested));
    setSalesInvoiceFeePercentage(
      Number(builderDraft.salesInvoiceFeePercentage) || defaultSalesInvoiceFeePercentage
    );
    setModeOfDelivery(builderDraft.modeOfDelivery ?? "");
    setDeliveryMethod(builderDraft.deliveryMethod ?? "");
    setPaymentTerms(builderDraft.paymentTerms ?? "");
    setSpecialInstructions(builderDraft.specialInstructions ?? "");
    setInternalNotes(builderDraft.internalNotes ?? "");
  }, [builderDraft, builderPersistence.restored]);

  useEffect(() => {
    if (!builderPersistence.restored || !hasAppliedBuilderDraft.current || state.ok) {
      return;
    }

    setBuilderDraft({
      selectedCustomer,
      items,
      productPickerOpen,
      additionalDiscount,
      additionalFees,
      noteOpen,
      termsOpen,
      customerNotes,
      needsAssembly,
      assemblyFeeRate,
      salesInvoiceRequested,
      salesInvoiceFeePercentage,
      modeOfDelivery,
      deliveryMethod,
      paymentTerms,
      specialInstructions,
      internalNotes
    });
  }, [
    additionalDiscount,
    additionalFees,
    assemblyFeeRate,
    builderPersistence.restored,
    customerNotes,
    deliveryMethod,
    internalNotes,
    items,
    modeOfDelivery,
    needsAssembly,
    noteOpen,
    paymentTerms,
    productPickerOpen,
    salesInvoiceFeePercentage,
    salesInvoiceRequested,
    selectedCustomer,
    setBuilderDraft,
    specialInstructions,
    state.ok,
    termsOpen
  ]);

  const totals = useMemo(() => {
    const subtotalAmount = roundMoney(items.reduce((sum, item) => sum + itemSubtotal(item), 0));
    const itemDiscountTotal = roundMoney(items.reduce((sum, item) => sum + itemDiscount(item), 0));
    const postItemDiscountTotal = roundMoney(items.reduce((sum, item) => sum + lineTotal(item), 0));
    const quotationDiscountAmount = roundMoney(Math.max(additionalDiscount || 0, 0));
    const totalDiscount = roundMoney(itemDiscountTotal + quotationDiscountAmount);
    const assemblyFee = assemblyFeeTotal(items, needsAssembly, assemblyFeeRate);
    const additionalFeeAmount = roundMoney(Math.max(additionalFees || 0, 0));
    const finalSubtotal = roundMoney(
      postItemDiscountTotal + assemblyFee + additionalFeeAmount - quotationDiscountAmount
    );
    const salesInvoiceFee = salesInvoiceRequested
      ? roundMoney(Math.max(finalSubtotal, 0) * (salesInvoiceFeePercentage / 100))
      : 0;
    const totalAdditionalFees = roundMoney(assemblyFee + salesInvoiceFee + additionalFeeAmount);

    return {
      subtotalAmount,
      itemDiscountTotal,
      postItemDiscountTotal,
      quotationDiscountAmount,
      assemblyFee,
      salesInvoiceFee,
      additionalFeeAmount,
      finalSubtotal,
      totalAdditionalFees,
      totalDiscount,
      totalAmount: roundMoney(finalSubtotal + salesInvoiceFee)
    };
  }, [
    additionalDiscount,
    additionalFees,
    assemblyFeeRate,
    items,
    needsAssembly,
    salesInvoiceFeePercentage,
    salesInvoiceRequested
  ]);

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

    const discountBase = roundMoney(
      totals.postItemDiscountTotal + totals.assemblyFee + totals.additionalFeeAmount
    );

    if (additionalDiscount > discountBase) {
      messages.push("Additional discount cannot exceed subtotal plus fees.");
    }

    if (totals.finalSubtotal < 0) {
      messages.push("Final subtotal cannot be negative.");
    }

    if (assemblyFeeRate < 0) {
      messages.push("Needs Assemble rate cannot be negative.");
    }

    if (salesInvoiceFeePercentage < 0 || salesInvoiceFeePercentage > 100) {
      messages.push("Sales Invoice percentage must be between 0 and 100.");
    }

    if (additionalFees < 0) {
      messages.push("Additional Fees cannot be negative.");
    }

    return messages;
  }, [
    additionalDiscount,
    additionalFees,
    assemblyFeeRate,
    items,
    salesInvoiceFeePercentage,
    selectedCustomer?.id,
    totals.additionalFeeAmount,
    totals.assemblyFee,
    totals.finalSubtotal,
    totals.postItemDiscountTotal
  ]);

  function addCustomItem() {
    setItems((current) => [...current, createCustomItem(current.length, needsAssembly)]);
  }

  function addProduct(product: ProductOption) {
    const selectedVariant = product.colorVariants[0] ?? null;
    setItems((current) => {
      const existingIndex = current.findIndex((item) => {
        if (item.itemType !== "CATALOG_PRODUCT") {
          return false;
        }

        if (item.productId && product.id) {
          return item.productId === product.id && (item.selectedVariantId ?? "") === (selectedVariant?.id ?? "");
        }

        return Boolean(
          item.snapshotProductCode &&
            product.code &&
            item.snapshotProductCode === product.code &&
            (item.selectedVariantId ?? "") === (selectedVariant?.id ?? "")
        );
      });

      if (existingIndex >= 0) {
        return current.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: normalizeQuantity(item.quantity + 1) }
            : item
        );
      }

      return [...current, createCatalogItem(product, current.length, needsAssembly, selectedVariant)];
    });
  }

  function handleNeedsAssemblyChange(checked: boolean) {
    setNeedsAssembly(checked);
    setItems((current) =>
      current.map((item) => ({
        ...item,
        requiresAssembly: checked
      }))
    );
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

  function handleQuotationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasAttemptedSubmit(true);

    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(form);

    if (
      submitter instanceof HTMLButtonElement &&
      submitter.name &&
      !formData.has(submitter.name)
    ) {
      formData.append(submitter.name, submitter.value);
    }

    startBuilderActionTransition(() => {
      action(formData);
    });
  }

  const showClientValidation = hasAttemptedSubmit && validationMessages.length > 0;
  const quotationFormId = initialQuotation?.id
    ? `quotation-builder-${initialQuotation.id}`
    : "quotation-builder-new";

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
      </div>
      <div className="mt-6 grid min-w-0 max-w-full gap-6 overflow-x-hidden xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <CustomerSelector
            customers={customers}
            selectedCustomer={selectedCustomer}
            setSelectedCustomer={setSelectedCustomer}
            canCreateCustomers={canCreateCustomers}
            persistenceScope={persistenceScope}
            persistenceUserKey={persistenceUserKey}
          />
          <form
            id={quotationFormId}
            onSubmit={handleQuotationSubmit}
            className="min-w-0 space-y-5"
          >
            {initialQuotation?.id ? (
              <input type="hidden" name="quotationId" value={initialQuotation.id} />
            ) : null}
            <input type="hidden" name="customerId" value={selectedCustomer?.id ?? ""} />
            <input type="hidden" name="items" value={JSON.stringify(toActionItems(items, needsAssembly))} />
            <input
              type="hidden"
              name="quotationDiscountType"
              value={additionalDiscount > 0 ? "FIXED_AMOUNT" : ""}
            />
            <input type="hidden" name="quotationDiscountValue" value={additionalDiscount} />
            <input type="hidden" name="additionalFees" value={additionalFees} />
            <input
              type="hidden"
              name="needsAssembly"
              value={needsAssembly ? "true" : "false"}
            />
            <input type="hidden" name="assemblyFeeRate" value={assemblyFeeRate} />
            <input
              type="hidden"
              name="salesInvoiceRequested"
              value={salesInvoiceRequested ? "true" : "false"}
            />
            <input type="hidden" name="salesInvoiceFeePercentage" value={salesInvoiceFeePercentage} />

          <section className="studio-card min-w-0">
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
            <div className="min-w-0 max-w-full overflow-x-auto p-5">
              {items.length ? (
                <QuotationItemTable
                  items={items}
                  showAssemblyColumn={needsAssembly}
                  needsAssembly={needsAssembly}
                  onNeedsAssemblyChange={handleNeedsAssemblyChange}
                  assemblyFeeRate={assemblyFeeRate}
                  onAssemblyFeeRateChange={setAssemblyFeeRate}
                  salesInvoiceRequested={salesInvoiceRequested}
                  onSalesInvoiceRequestedChange={setSalesInvoiceRequested}
                  salesInvoiceFeePercentage={salesInvoiceFeePercentage}
                  onSalesInvoiceFeePercentageChange={setSalesInvoiceFeePercentage}
                  updateItem={updateItem}
                  removeItem={removeItem}
                  subtotalAmount={totals.subtotalAmount}
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
            className="studio-card min-w-0"
            open={termsOpen}
            onToggle={(event) => setTermsOpen(event.currentTarget.open)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold">
              <span className="studio-kicker">Terms, delivery, and instructions</span>
              <ChevronDown className={cn("h-4 w-4 transition", termsOpen ? "rotate-180" : undefined)} />
            </summary>
            <div className="grid gap-4 border-t border-border p-5">
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
                  placeholder="Delivery access, assemble notes, customer requests"
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
          </details>

          <details
            className="studio-card min-w-0"
            open={noteOpen}
            onToggle={(event) => setNoteOpen(event.currentTarget.open)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold">
              <span className="studio-kicker">Quotation note</span>
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
          </form>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
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
                        {variantLabel(item) ? (
                          <p className="mt-1 whitespace-normal break-words text-xs leading-5 text-accent">
                            Variant: {variantLabel(item)}
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
              <div className="space-y-3 border-b border-border py-4">
                <label className="grid gap-2 font-medium sm:grid-cols-[1fr_9.5rem] sm:items-center">
                  <span className="text-emerald-800">Additional Fees</span>
                  <MoneyInput
                    value={additionalFees}
                    onValueChange={setAdditionalFees}
                    aria-label="Additional Fees"
                    className="font-semibold text-emerald-800"
                  />
                </label>
                <label className="grid gap-2 font-medium sm:grid-cols-[1fr_9.5rem] sm:items-center">
                  <span className="text-danger">Additional Discount</span>
                  <MoneyInput
                    max={roundMoney(
                      totals.postItemDiscountTotal + totals.assemblyFee + totals.additionalFeeAmount
                    )}
                    value={additionalDiscount}
                    onValueChange={setAdditionalDiscount}
                    aria-label="Additional discount"
                  />
                </label>
              </div>
              <div className="space-y-3 py-4">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Subtotal for Items</span>
                  <span className="font-medium">{money(totals.postItemDiscountTotal)}</span>
                </div>
                <div className="flex justify-between gap-4 rounded-md bg-success/10 px-3 py-2 text-emerald-800">
                  <span className="font-medium">Assemble Fee</span>
                  <span className="font-medium">{signedMoney(totals.assemblyFee, "+")}</span>
                </div>
                <div className="flex justify-between gap-4 rounded-md bg-success/10 px-3 py-2 text-emerald-800">
                  <span className="font-medium">Additional Fees</span>
                  <span className="font-medium">{signedMoney(totals.additionalFeeAmount, "+")}</span>
                </div>
                <div className="flex justify-between gap-4 rounded-md bg-danger/10 px-3 py-2 text-danger">
                  <span className="font-medium">Additional Discount</span>
                  <span className="font-medium">{signedMoney(totals.quotationDiscountAmount, "-")}</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-3">
                  <span className="font-semibold">Final Subtotal</span>
                  <span className="font-semibold">{money(totals.finalSubtotal)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Sales Invoice Fee</span>
                  <span className="font-medium">{signedMoney(totals.salesInvoiceFee, "+")}</span>
                </div>
                <div className="flex justify-between gap-4 rounded-lg border border-border bg-soft-accent/55 px-3 py-3 text-base">
                  <span className="font-semibold">Final Total</span>
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
                  onClick={() => builderPersistence.clear(initialBuilderDraft)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 text-sm font-semibold text-danger transition hover:bg-danger/15"
                >
                  <X className="h-4 w-4" />
                  Discard
                </Link>
                <Button
                  form={quotationFormId}
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
              <p className="text-xs text-muted-foreground">Final Total</p>
              <p className="font-semibold">{money(totals.totalAmount)}</p>
            </div>
            <Button
              form={quotationFormId}
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
      </div>
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
