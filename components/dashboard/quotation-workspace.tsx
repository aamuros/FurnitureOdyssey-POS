"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileText,
  ImagePlus,
  PackageSearch,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  UserPlus,
  X
} from "lucide-react";
import { createCustomerAction } from "@/app/actions/customer-inquiries";
import { createQuotationAction, updateQuotationStatusAction } from "@/app/actions/quotations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
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
  itemCount: number;
  subtotalAmount: string;
  totalAmount: string;
  createdBy: string | null;
  updatedAt: string;
};

type QuotationBuilderProps = {
  customers: CustomerOption[];
  products: ProductOption[];
  canCreateCustomers: boolean;
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
  discountValue: number;
  customerNotes: string;
  internalNotes: string;
  images: ItemImageDraft[];
};

type ActionState = {
  ok: boolean;
  message: string;
  intent?: "save_draft" | "save_preview" | "save_mark_sent";
  quotationId?: string;
  quotationNumber?: string | null;
  previewUrl?: string;
  downloadUrl?: string;
  status?: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  customerId?: string;
  customerDisplayName?: string;
};

const initialState: ActionState = {
  ok: false,
  message: ""
};

const pdfLinkClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border bg-soft-accent/70 px-2 text-sm font-semibold text-foreground transition hover:bg-soft-accent";

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

function createCustomItem(sortOrder: number): ItemDraft {
  return {
    itemType: "CUSTOM_ITEM",
    sortOrder,
    itemName: "",
    description: "",
    specifications: "",
    quantity: 1,
    unitPrice: 0,
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

function friendlyActionMessage(message: string) {
  if (!message) {
    return "";
  }

  if (message.includes("Expected string") || message.includes("received null")) {
    return "Some optional details were blank. Please check the required fields and try again.";
  }

  if (message === "Choose a customer.") {
    return "Select an existing customer or create a new customer record.";
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

function statusTone(status: string) {
  if (status === "ACCEPTED") {
    return "success" as const;
  }

  if (status === "DECLINED" || status === "CANCELLED") {
    return "danger" as const;
  }

  if (status === "SENT") {
    return "warning" as const;
  }

  return "neutral" as const;
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
    discountValue: 0,
    customerNotes: "",
    internalNotes: "",
    images: primaryImage
  };
}

function customerDetail(customer: CustomerOption) {
  return [customer.companyName, customer.primaryContact].filter(Boolean).join(" - ") || null;
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
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <input type="hidden" name="customerType" value="INDIVIDUAL" />
      <input type="hidden" name="contacts" value="[]" />
      <label className="sr-only" htmlFor="quick-customer-name">
        Customer name
      </label>
      <Input
        id="quick-customer-name"
        name="displayName"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Customer name"
        required
      />
      <Button disabled={pending || !name.trim()} variant="secondary">
        <UserPlus className="h-4 w-4" />
        {submitLabel}
      </Button>
      {state.message ? (
        <p className={cn("text-sm sm:col-span-2", state.ok ? "text-success" : "text-danger")}>
          {friendlyActionMessage(state.message)}
        </p>
      ) : null}
    </form>
  );
}

function QuotationPdfPreview({
  previewUrl,
  downloadUrl,
  title
}: {
  previewUrl: string;
  downloadUrl: string;
  title: string;
}) {
  return (
    <section className="studio-card overflow-hidden">
      <div className="studio-card-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="studio-kicker">PDF preview</p>
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <a href={downloadUrl} className={pdfLinkClass}>
          <Download className="h-4 w-4" />
          Download PDF
        </a>
      </div>
      <object
        data={previewUrl}
        type="application/pdf"
        className="h-[72vh] min-h-[520px] w-full border-t border-border bg-background"
      >
        <div className="grid min-h-[320px] place-items-center border-t border-border bg-background p-6 text-center">
          <div className="max-w-md space-y-3">
            <FileText className="mx-auto h-8 w-8 text-accent" />
            <p className="font-semibold">PDF preview is not available in this browser.</p>
            <p className="text-sm text-muted-foreground">
              You can still download the quotation PDF and open it locally.
            </p>
            <a href={downloadUrl} className={pdfLinkClass}>
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </div>
        </div>
      </object>
    </section>
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
  const selectedLabel = selectedCustomer ? "Selected customer" : "No customer selected yet";

  return (
    <section className="space-y-3">
      <div>
        <p className="studio-kicker">Customer</p>
        <h2 className="text-sm font-semibold">Search existing customer</h2>
      </div>
      <div className="studio-subpanel p-4">
        {selectedCustomer ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
            <div>
              <p className="studio-kicker">{selectedLabel}</p>
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
            <p className="mb-2 text-sm font-medium text-muted-foreground">{selectedLabel}</p>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search customer name or contact"
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
                  <div className="px-3 py-3 text-sm text-muted-foreground">No matching customers.</div>
                ) : null}
                {trimmedQuery && !hasExactMatch && canCreateCustomers ? (
                  <div className="border-t border-border p-3">
                    <p className="studio-kicker">Create new customer record</p>
                    <p className="mb-2 text-sm font-medium">
                      No exact customer match. Create a new customer record for &quot;{trimmedQuery}&quot;?
                    </p>
                    <InlineCustomerCreate
                      enabled={canCreateCustomers}
                      initialName={trimmedQuery}
                      submitLabel="Create buyer record"
                      onCreated={(customer) => {
                        setSelectedCustomer(customer);
                        setQuery("");
                      }}
                    />
                  </div>
                ) : null}
                {trimmedQuery && !hasExactMatch && !canCreateCustomers ? (
                  <div className="border-t border-border px-3 py-3 text-sm text-muted-foreground">
                    No exact match. Ask an admin to create this customer or select an existing record.
                  </div>
                ) : null}
              </div>
            ) : null}
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

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/35 p-3 backdrop-blur-sm md:p-6">
      <div className="mx-auto flex max-h-[94vh] max-w-7xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-xl">
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
  removeItem
}: {
  items: ItemDraft[];
  updateItem: (index: number, patch: Partial<ItemDraft>) => void;
  removeItem: (index: number) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const editingItem = editingIndex === null ? null : items[editingIndex] ?? null;
  const removingItem = removeIndex === null ? null : items[removeIndex] ?? null;
  const requestRemove = (index: number) => setRemoveIndex(index);

  return (
    <div className="space-y-3">
      <div className="hidden rounded-lg border border-border bg-panel lg:block">
        <div className="grid grid-cols-[72px_1.4fr_100px_140px_140px_140px_100px] gap-3 border-b border-border bg-soft-accent/35 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
          <span>Image</span>
          <span>Item</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span>Discount</span>
          <span>Line total</span>
          <span>Actions</span>
        </div>
        {items.map((item, index) => (
          <div key={index} className="border-b border-border last:border-b-0">
            <div className="grid grid-cols-[72px_1.4fr_100px_140px_140px_140px_100px] items-center gap-3 px-4 py-3">
              <ItemThumb item={item} />
              <div className="min-w-0">
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
              <Input
                type="number"
                min="0"
                max={itemSubtotal(item)}
                step="0.01"
                value={numericInputValue(item.discountValue)}
                onChange={(event) =>
                  updateItem(index, { discountValue: parseMoneyInput(event.target.value) })
                }
                aria-label="Fixed item discount"
              />
              <div className="text-sm font-semibold">{money(lineTotal(item))}</div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" onClick={() => setEditingIndex(index)} className="min-h-9 px-2">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" onClick={() => requestRemove(index)} className="min-h-9 px-2">
                  <Trash2 className="h-4 w-4" />
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
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" variant="ghost" onClick={() => setEditingIndex(index)} className="min-h-9 px-2">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" onClick={() => requestRemove(index)} className="min-h-9 px-2">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={item.itemName}
                onChange={(event) => updateItem(index, { itemName: event.target.value })}
                placeholder="Item name"
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
              <Input
                type="number"
                min="0"
                max={itemSubtotal(item)}
                step="0.01"
                value={numericInputValue(item.discountValue)}
                onChange={(event) =>
                  updateItem(index, { discountValue: parseMoneyInput(event.target.value) })
                }
                aria-label="Fixed item discount"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Line total</span>
              <span className="font-semibold">{money(lineTotal(item))}</span>
            </div>
          </div>
        ))}
      </div>
      {editingItem && editingIndex !== null ? (
        <ItemEditModal
          item={editingItem}
          onClose={() => setEditingIndex(null)}
          onSave={(patch) => {
            updateItem(editingIndex, patch);
            setEditingIndex(null);
          }}
        />
      ) : null}
      {removingItem && removeIndex !== null ? (
        <div className="fixed inset-0 z-50 bg-foreground/35 p-3 backdrop-blur-sm md:p-6">
          <div className="mx-auto mt-20 max-w-md rounded-xl border border-border bg-panel shadow-xl">
            <div className="border-b border-border px-5 py-4">
              <p className="studio-kicker">Remove item</p>
              <h2 className="text-base font-semibold">
                Remove {removingItem.itemName || `item ${removeIndex + 1}`} from the quotation?
              </h2>
            </div>
            <div className="space-y-3 p-5 text-sm text-muted-foreground">
              <p>This only removes it from the draft quotation.</p>
              <div className="rounded-lg border border-border bg-background p-3 text-foreground">
                <p className="font-semibold">{removingItem.itemName || `Item ${removeIndex + 1}`}</p>
                <p className="text-sm text-muted-foreground">{money(lineTotal(removingItem))}</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border p-5">
              <Button type="button" variant="secondary" onClick={() => setRemoveIndex(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  removeItem(removeIndex);
                  setRemoveIndex(null);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
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

function ItemEditModal({
  item,
  onClose,
  onSave
}: {
  item: ItemDraft;
  onClose: () => void;
  onSave: (patch: Partial<ItemDraft>) => void;
}) {
  const [draft, setDraft] = useState<ItemDraft>(item);

  useEffect(() => {
    setDraft(item);
  }, [item]);

  const draftSubtotal = itemSubtotal(draft);
  const draftLineTotal = lineTotal(draft);
  const canSave =
    draft.itemName.trim().length > 0 &&
    draft.quantity > 0 &&
    draft.unitPrice >= 0 &&
    draft.discountValue >= 0 &&
    itemDiscount(draft) <= draftSubtotal;

  function patchDraft(patch: Partial<ItemDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/35 p-3 backdrop-blur-sm md:p-6">
      <div className="mx-auto flex max-h-[92vh] max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="studio-kicker">Item</p>
            <h2 className="text-base font-semibold">Edit item</h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} className="min-h-9 px-2">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid gap-4 overflow-y-auto p-5">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
            <ItemThumb item={draft} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{draft.itemName || "Untitled item"}</p>
              <p className="text-xs text-muted-foreground">
                {draft.snapshotProductCode ?? (draft.itemType === "CATALOG_PRODUCT" ? "Catalog" : "Custom")}
              </p>
            </div>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Item name
            <Input
              value={draft.itemName}
              onChange={(event) => patchDraft({ itemName: event.target.value })}
              placeholder="Item name"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium">
              Quantity
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={draft.quantity > 0 ? String(draft.quantity) : ""}
                onChange={(event) => patchDraft({ quantity: parseMoneyInput(event.target.value) })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Unit price
              <Input
                type="number"
                min="0"
                step="0.01"
                value={numericInputValue(draft.unitPrice)}
                onChange={(event) => patchDraft({ unitPrice: parseMoneyInput(event.target.value) })}
                placeholder="0"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Fixed item discount
              <Input
                type="number"
                min="0"
                max={draftSubtotal}
                step="0.01"
                value={numericInputValue(draft.discountValue)}
                onChange={(event) => patchDraft({ discountValue: parseMoneyInput(event.target.value) })}
                placeholder="0"
              />
            </label>
          </div>
          <div className="rounded-lg border border-border bg-background p-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Line total</span>
              <span className="font-semibold">{money(draftLineTotal)}</span>
            </div>
            {itemDiscount(draft) > draftSubtotal ? (
              <p className="mt-2 text-danger">Discount cannot exceed this item subtotal.</p>
            ) : null}
          </div>
          <Textarea
            value={draft.description}
            onChange={(event) => patchDraft({ description: event.target.value })}
            placeholder="Optional description"
          />
          <Textarea
            value={draft.specifications}
            onChange={(event) => patchDraft({ specifications: event.target.value })}
            placeholder="Optional specifications"
          />
          <Textarea
            value={draft.customerNotes}
            onChange={(event) => patchDraft({ customerNotes: event.target.value })}
            placeholder="Optional customer note"
          />
          <Textarea
            value={draft.internalNotes}
            onChange={(event) => patchDraft({ internalNotes: event.target.value })}
            placeholder="Optional internal note"
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border p-5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => onSave(draft)}>
            <Save className="h-4 w-4" />
            Save item
          </Button>
        </div>
      </div>
    </div>
  );
}

export function QuotationBuilder({
  customers,
  products,
  canCreateCustomers
}: QuotationBuilderProps) {
  const [state, action, pending] = useActionState(createQuotationAction, initialState);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [additionalDiscount, setAdditionalDiscount] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

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
      messages.push("Select an existing customer or create a new customer record.");
    }

    if (!items.length) {
      messages.push("Add at least one item to continue.");
    }

    items.forEach((item, index) => {
      if (!item.itemName.trim()) {
        messages.push(`Item ${index + 1} needs a name.`);
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
          index === existingIndex ? { ...item, quantity: roundMoney(item.quantity + 1) } : item
        );
      }

      return [...current, createCatalogItem(product, current.length)];
    });
  }

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  const canSubmit = validationMessages.length === 0;
  const savedQuotationLabel = state.quotationNumber ?? state.quotationId ?? "quotation";

  useEffect(() => {
    if (state.ok && state.intent === "save_preview" && state.previewUrl) {
      setShowPdfPreview(true);
    }
  }, [state.intent, state.ok, state.previewUrl]);

  return (
    <>
      <ProductPicker
        products={products}
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onAdd={addProduct}
      />
      <div className="space-y-6">
        <CustomerSelector
          customers={customers}
          selectedCustomer={selectedCustomer}
          setSelectedCustomer={setSelectedCustomer}
          canCreateCustomers={canCreateCustomers}
        />
      </div>
      {state.ok && state.quotationId && state.previewUrl && state.downloadUrl ? (
        <div className="mt-6 space-y-4">
          <section className="studio-card">
            <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="studio-kicker">Saved quotation</p>
                <h2 className="text-base font-semibold">
                  {state.status === "SENT"
                    ? `${savedQuotationLabel} was marked sent`
                    : `${savedQuotationLabel} was saved as draft`}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{friendlyActionMessage(state.message)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowPdfPreview((current) => !current)}>
                  <Eye className="h-4 w-4" />
                  {showPdfPreview ? "Hide PDF" : "Preview PDF"}
                </Button>
                <a href={state.downloadUrl} className={pdfLinkClass}>
                  <Download className="h-4 w-4" />
                  Download PDF
                </a>
              </div>
            </div>
          </section>
          {showPdfPreview ? (
            <QuotationPdfPreview
              previewUrl={state.previewUrl}
              downloadUrl={state.downloadUrl}
              title={String(savedQuotationLabel)}
            />
          ) : null}
        </div>
      ) : null}

      <form action={action} className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <input type="hidden" name="customerId" value={selectedCustomer?.id ?? ""} />
        <input type="hidden" name="items" value={JSON.stringify(toActionItems(items))} />
        <input
          type="hidden"
          name="quotationDiscountType"
          value={additionalDiscount > 0 ? "FIXED_AMOUNT" : ""}
        />
        <input type="hidden" name="quotationDiscountValue" value={additionalDiscount} />

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
                <QuotationItemTable items={items} updateItem={updateItem} removeItem={removeItem} />
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
                placeholder="Optional note for this quotation"
                className="min-h-24"
              />
            </div>
          </details>
        </section>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <section className="studio-card">
            <div className="studio-card-header">
              <p className="studio-kicker">Summary</p>
              <h2 className="text-sm font-semibold">Cart total</h2>
            </div>
            <div className="space-y-4 p-5 text-sm">
              {selectedCustomer ? (
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="font-semibold">{selectedCustomer.displayName}</p>
                  {selectedCustomer.detail ? (
                    <p className="text-muted-foreground">{selectedCustomer.detail}</p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-background p-3 text-muted-foreground">
                  No customer selected
                </div>
              )}
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div key={index} className="rounded-md bg-background px-3 py-2">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {item.quantity} x {item.itemName || `Item ${index + 1}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {money(item.unitPrice)} each
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold">{money(lineTotal(item))}</span>
                    </div>
                    {itemDiscount(item) > 0 ? (
                      <div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
                        <span>Item discount</span>
                        <span>-{money(itemDiscount(item))}</span>
                      </div>
                    ) : null}
                  </div>
                ))}
                {!items.length ? (
                  <div className="studio-empty px-3 py-4 text-muted-foreground">No items added yet.</div>
                ) : null}
              </div>
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{money(totals.subtotalAmount)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Item discounts</span>
                  <span className="font-medium">-{money(totals.itemDiscountTotal)}</span>
                </div>
                <label className="block space-y-2 font-medium">
                  Additional fixed discount
                  <Input
                    type="number"
                    min="0"
                    max={totals.postItemDiscountTotal}
                    step="0.01"
                    value={numericInputValue(additionalDiscount)}
                    onChange={(event) => setAdditionalDiscount(parseMoneyInput(event.target.value))}
                    placeholder="0"
                  />
                </label>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Total discount</span>
                  <span className="font-medium">-{money(totals.totalDiscount)}</span>
                </div>
                <div className="flex justify-between gap-4 rounded-lg bg-soft-accent/70 px-3 py-3 text-base">
                  <span className="font-semibold">Final total</span>
                  <span className="text-lg font-semibold">{money(totals.totalAmount)}</span>
                </div>
              </div>
              {validationMessages.length ? (
                <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-danger">
                  {validationMessages[0]}
                </div>
              ) : null}
              {state.message ? (
                <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>
                  {friendlyActionMessage(state.message)}
                </p>
              ) : null}
              <div className="grid gap-2">
                <Button disabled={pending || !canSubmit} name="intent" value="save_draft">
                  <Save className="h-4 w-4" />
                  Save draft
                </Button>
                <Button variant="secondary" disabled={pending || !canSubmit} name="intent" value="save_preview">
                  <FileText className="h-4 w-4" />
                  Save and preview
                </Button>
                <Button variant="secondary" disabled={pending || !canSubmit} name="intent" value="save_mark_sent">
                  <Send className="h-4 w-4" />
                  Save and mark sent
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
            <div className="grid shrink-0 grid-cols-3 gap-2">
              <Button disabled={pending || !canSubmit} name="intent" value="save_draft" className="min-h-10 px-2">
                <Save className="h-4 w-4" />
                Draft
              </Button>
              <Button
                variant="secondary"
                disabled={pending || !canSubmit}
                name="intent"
                value="save_preview"
                className="min-h-10 px-2"
              >
                <FileText className="h-4 w-4" />
                Preview
              </Button>
              <Button
                variant="secondary"
                disabled={pending || !canSubmit}
                name="intent"
                value="save_mark_sent"
                className="min-h-10 px-2"
              >
                <Send className="h-4 w-4" />
                Sent
              </Button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}

export function QuotationRecordsList({ quotations, query = "", status = "" }: QuotationRecordsListProps) {
  const [statusState, statusAction, statusPending] = useActionState(
    updateQuotationStatusAction,
    initialState
  );

  return (
    <section className="studio-card">
      <div className="studio-card-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="studio-kicker">Records</p>
            <h2 className="text-sm font-semibold">Quotation records</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search drafts and sent quotations without opening the builder.
            </p>
          </div>
          <form className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_160px_auto]" action="/quotations">
            <Input name="q" defaultValue={query} placeholder="Search quotations" />
            <Select name="status" defaultValue={status} aria-label="Status filter">
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
        {statusState.message ? (
          <p className={statusState.ok ? "mt-2 text-sm text-success" : "mt-2 text-sm text-danger"}>
            {statusState.message}
          </p>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="studio-table w-full min-w-[860px] text-left text-sm">
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
          <tbody className="divide-y divide-border">
            {quotations.map((quotation) => (
              <tr key={quotation.id}>
                <td className="px-5 py-3 font-medium">{quotation.quotationNumber ?? "Not assigned"}</td>
                <td className="px-5 py-3 font-medium">{quotation.customerName}</td>
                <td className="px-5 py-3">
                  <StatusPill tone={statusTone(quotation.status)}>{quotation.status}</StatusPill>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{quotation.itemCount}</td>
                <td className="px-5 py-3 text-muted-foreground">{quotation.subtotalAmount}</td>
                <td className="px-5 py-3 font-medium">{quotation.totalAmount}</td>
                <td className="px-5 py-3 text-muted-foreground">{quotation.createdBy ?? "Unknown"}</td>
                <td className="px-5 py-3 text-muted-foreground">{quotation.updatedAt}</td>
                <td className="px-5 py-3">
                  <form action={statusAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="quotationId" value={quotation.id} />
                    <a href={`/api/documents/quotation/${quotation.id}`} className={pdfLinkClass}>
                      <Download className="h-4 w-4" />
                      PDF
                    </a>
                    {quotation.status === "DRAFT" ? (
                      <Button
                        type="submit"
                        name="status"
                        value="SENT"
                        variant="secondary"
                        disabled={statusPending}
                        className="min-h-9 px-2"
                      >
                        <Send className="h-4 w-4" />
                        Sent
                      </Button>
                    ) : null}
                    {quotation.status !== "ACCEPTED" ? (
                      <Button
                        type="submit"
                        name="status"
                        value="ACCEPTED"
                        variant="secondary"
                        disabled={statusPending}
                        className="min-h-9 px-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Accept
                      </Button>
                    ) : null}
                  </form>
                </td>
              </tr>
            ))}
            {quotations.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-sm text-muted-foreground" colSpan={9}>
                  <div className="studio-empty flex items-center gap-3 px-4 py-4">
                    <FileText className="h-5 w-5 text-accent" />
                    <span>No quotations found.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
