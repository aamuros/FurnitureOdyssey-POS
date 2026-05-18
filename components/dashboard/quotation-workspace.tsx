"use client";

import { useActionState, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  ImagePlus,
  PackageSearch,
  Plus,
  Save,
  Send,
  Trash2
} from "lucide-react";
import { createQuotationAction, updateQuotationStatusAction } from "@/app/actions/quotations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";

type CustomerOption = {
  id: string;
  displayName: string;
  companyName: string | null;
  primaryContact: string | null;
};

type InquiryOption = {
  id: string;
  customerId: string;
  subject: string;
  requestedItems: string | null;
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
  customerName: string;
  status: string;
  itemCount: number;
  subtotalAmount: string;
  totalAmount: string;
  createdBy: string | null;
  updatedAt: string;
};

type QuotationWorkspaceProps = {
  customers: CustomerOption[];
  inquiries: InquiryOption[];
  products: ProductOption[];
  quotations: QuotationRow[];
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
  discountType: "" | "FIXED_AMOUNT" | "PERCENTAGE";
  discountValue: number;
  customerNotes: string;
  internalNotes: string;
  images: ItemImageDraft[];
};

const initialState = {
  ok: false,
  message: ""
};

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(value);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function itemDiscount(item: ItemDraft) {
  const subtotal = item.quantity * item.unitPrice;

  if (!item.discountType || item.discountValue <= 0) {
    return 0;
  }

  if (item.discountType === "PERCENTAGE") {
    return roundMoney(subtotal * (item.discountValue / 100));
  }

  return roundMoney(item.discountValue);
}

function lineTotal(item: ItemDraft) {
  return roundMoney(Math.max(item.quantity * item.unitPrice - itemDiscount(item), 0));
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

function productLabel(product: ProductOption) {
  return [product.code, product.name, product.category].filter(Boolean).join(" - ");
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

const pdfLinkClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-panel px-2 text-sm font-medium text-foreground transition hover:bg-muted";

export function QuotationWorkspace({
  customers,
  inquiries,
  products,
  quotations
}: QuotationWorkspaceProps) {
  const [state, action, pending] = useActionState(createQuotationAction, initialState);
  const [statusState, statusAction, statusPending] = useActionState(
    updateQuotationStatusAction,
    initialState
  );
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [items, setItems] = useState<ItemDraft[]>([createCustomItem(0)]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quotationDiscountType, setQuotationDiscountType] = useState<
    "" | "FIXED_AMOUNT" | "PERCENTAGE"
  >("");
  const [quotationDiscountValue, setQuotationDiscountValue] = useState(0);

  const customerInquiries = inquiries.filter((inquiry) => inquiry.customerId === customerId);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  const totals = useMemo(() => {
    const subtotalAmount = roundMoney(
      items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    );
    const itemDiscountTotal = roundMoney(items.reduce((sum, item) => sum + itemDiscount(item), 0));
    const postItemDiscountTotal = roundMoney(items.reduce((sum, item) => sum + lineTotal(item), 0));
    const quotationDiscountAmount =
      quotationDiscountType === "PERCENTAGE"
        ? roundMoney(postItemDiscountTotal * (quotationDiscountValue / 100))
        : quotationDiscountType === "FIXED_AMOUNT"
          ? roundMoney(quotationDiscountValue)
          : 0;

    return {
      subtotalAmount,
      itemDiscountTotal,
      quotationDiscountAmount,
      totalAmount: roundMoney(Math.max(postItemDiscountTotal - quotationDiscountAmount, 0))
    };
  }, [items, quotationDiscountType, quotationDiscountValue]);

  function addCustomItem() {
    setItems((current) => [...current, createCustomItem(current.length)]);
  }

  function addCatalogItem() {
    const product = products.find((candidate) => candidate.id === selectedProductId);

    if (!product) {
      return;
    }

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
        images: primaryImage
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
    setItems((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length ? next : [createCustomItem(0)];
    });
  }

  function updateImage(index: number, patch: Partial<ItemImageDraft>) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const currentImage = item.images[0] ?? {
          cloudinaryPublicId: "",
          secureUrl: "",
          resourceType: "image",
          sortOrder: 0,
          isPrimary: true
        };

        return {
          ...item,
          images: [{ ...currentImage, ...patch }]
        };
      })
    );
  }

  return (
    <div className="space-y-6">
      <form action={action} className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <input type="hidden" name="items" value={JSON.stringify(toActionItems(items))} />
        <section className="rounded-lg border border-border bg-panel">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Quotation draft</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Prepare negotiated line items before PDF generation is added.
            </p>
          </div>
          <div className="space-y-5 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                Customer
                <Select
                  name="customerId"
                  required
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                >
                  <option value="" disabled>
                    Choose a customer
                  </option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.displayName}
                      {customer.companyName ? ` - ${customer.companyName}` : ""}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                Related inquiry
                <Select name="inquiryId" defaultValue="">
                  <option value="">No inquiry link</option>
                  {customerInquiries.map((inquiry) => (
                    <option key={inquiry.id} value={inquiry.id}>
                      {inquiry.subject}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            {selectedCustomer ? (
              <div className="rounded-md border border-border bg-background px-4 py-3 text-sm">
                <p className="font-medium">{selectedCustomer.displayName}</p>
                <p className="text-muted-foreground">
                  {selectedCustomer.primaryContact ?? "No primary contact saved"}
                </p>
              </div>
            ) : null}

            <div className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-[1fr_auto_auto]">
              <Select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                aria-label="Catalog product"
              >
                <option value="">Choose active catalog item</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {productLabel(product)}
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

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="rounded-lg border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusPill>{item.itemType === "CATALOG_PRODUCT" ? "Catalog" : "Custom"}</StatusPill>
                      <p className="text-sm font-semibold">Item {index + 1}</p>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => removeItem(index)} className="min-h-9 px-2">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4 p-4 lg:grid-cols-2">
                    <label className="space-y-2 text-sm font-medium">
                      Item name
                      <Input
                        value={item.itemName}
                        onChange={(event) => updateItem(index, { itemName: event.target.value })}
                        placeholder="Furniture item or custom work"
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      Product code
                      <Input
                        value={item.snapshotProductCode ?? ""}
                        onChange={(event) =>
                          updateItem(index, { snapshotProductCode: event.target.value })
                        }
                        placeholder="Optional"
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium lg:col-span-2">
                      Description
                      <Textarea
                        value={item.description}
                        onChange={(event) => updateItem(index, { description: event.target.value })}
                        placeholder="Customer-facing item details"
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium lg:col-span-2">
                      Specifications
                      <Textarea
                        value={item.specifications}
                        onChange={(event) =>
                          updateItem(index, { specifications: event.target.value })
                        }
                        placeholder="Dimensions, material, color, lead time, or inclusions"
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      Quantity
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, { quantity: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      Manual unit price
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateItem(index, { unitPrice: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      Item discount
                      <Select
                        value={item.discountType}
                        onChange={(event) =>
                          updateItem(index, {
                            discountType: event.target.value as ItemDraft["discountType"],
                            discountValue: event.target.value ? item.discountValue : 0
                          })
                        }
                      >
                        <option value="">No discount</option>
                        <option value="FIXED_AMOUNT">Fixed amount</option>
                        <option value="PERCENTAGE">Percentage</option>
                      </Select>
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      Discount value
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.discountValue}
                        disabled={!item.discountType}
                        onChange={(event) =>
                          updateItem(index, { discountValue: Number(event.target.value) })
                        }
                      />
                    </label>
                    <div className="rounded-md bg-background p-3 text-sm">
                      <p className="text-muted-foreground">Line subtotal</p>
                      <p className="font-semibold">{money(item.quantity * item.unitPrice)}</p>
                    </div>
                    <div className="rounded-md bg-background p-3 text-sm">
                      <p className="text-muted-foreground">Line total</p>
                      <p className="font-semibold">{money(lineTotal(item))}</p>
                    </div>
                    <label className="space-y-2 text-sm font-medium lg:col-span-2">
                      Customer notes
                      <Textarea
                        value={item.customerNotes}
                        onChange={(event) =>
                          updateItem(index, { customerNotes: event.target.value })
                        }
                        placeholder="Notes that can be used in a future quotation PDF"
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium lg:col-span-2">
                      Internal notes
                      <Textarea
                        value={item.internalNotes}
                        onChange={(event) =>
                          updateItem(index, { internalNotes: event.target.value })
                        }
                        placeholder="Staff-only context"
                      />
                    </label>
                    <div className="space-y-3 lg:col-span-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <ImagePlus className="h-4 w-4" />
                        Item image metadata
                      </div>
                      {item.images[0]?.secureUrl ? (
                        <div
                          role="img"
                          aria-label={item.images[0].altText ?? item.itemName}
                          className="h-24 w-32 rounded-md border border-border bg-cover bg-center"
                          style={{
                            backgroundImage: `url("${item.images[0].secureUrl}")`
                          }}
                        />
                      ) : null}
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input
                          value={item.images[0]?.secureUrl ?? ""}
                          onChange={(event) => updateImage(index, { secureUrl: event.target.value })}
                          placeholder="Cloudinary secure URL"
                          aria-label="Cloudinary secure URL"
                        />
                        <Input
                          value={item.images[0]?.cloudinaryPublicId ?? ""}
                          onChange={(event) =>
                            updateImage(index, { cloudinaryPublicId: event.target.value })
                          }
                          placeholder="Cloudinary public ID"
                          aria-label="Cloudinary public ID"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                Customer-facing quotation notes
                <Textarea name="customerNotes" placeholder="Terms, delivery notes, or quotation context" />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Internal notes
                <Textarea name="internalNotes" placeholder="Negotiation context or staff-only reminders" />
              </label>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-panel">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Totals</h2>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{money(totals.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Item discounts</span>
                <span className="font-medium">{money(totals.itemDiscountTotal)}</span>
              </div>
              <label className="block space-y-2 font-medium">
                Quotation discount
                <Select
                  name="quotationDiscountType"
                  value={quotationDiscountType}
                  onChange={(event) =>
                    setQuotationDiscountType(event.target.value as typeof quotationDiscountType)
                  }
                >
                  <option value="">No discount</option>
                  <option value="FIXED_AMOUNT">Fixed amount</option>
                  <option value="PERCENTAGE">Percentage</option>
                </Select>
              </label>
              <Input
                name="quotationDiscountValue"
                type="number"
                min="0"
                step="0.01"
                value={quotationDiscountValue}
                disabled={!quotationDiscountType}
                onChange={(event) => setQuotationDiscountValue(Number(event.target.value))}
                aria-label="Quotation discount value"
              />
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Quotation discount</span>
                <span className="font-medium">{money(totals.quotationDiscountAmount)}</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-3 text-base">
                <span className="font-semibold">Total</span>
                <span className="font-semibold">{money(totals.totalAmount)}</span>
              </div>
              {state.message ? (
                <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-danger"}>
                  {state.message}
                </p>
              ) : null}
              <Button disabled={pending || customers.length === 0 || items.length === 0} className="w-full">
                <Save className="h-4 w-4" />
                Save draft
              </Button>
            </div>
          </section>
        </aside>
      </form>

      <section className="rounded-lg border border-border bg-panel">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Quotation records</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Draft records preserve item snapshots for future PDF output. Mark approved quotations
            accepted before conversion to orders.
          </p>
          {statusState.message ? (
            <p className={statusState.ok ? "mt-2 text-sm text-emerald-700" : "mt-2 text-sm text-danger"}>
              {statusState.message}
            </p>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
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
                  <td className="px-5 py-3 font-medium">{quotation.customerName}</td>
                  <td className="px-5 py-3">
                    <StatusPill tone={statusTone(quotation.status)}>{quotation.status}</StatusPill>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{quotation.itemCount}</td>
                  <td className="px-5 py-3 text-muted-foreground">{quotation.subtotalAmount}</td>
                  <td className="px-5 py-3 font-medium">{quotation.totalAmount}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {quotation.createdBy ?? "Unknown"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{quotation.updatedAt}</td>
                  <td className="px-5 py-3">
                    <form action={statusAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="quotationId" value={quotation.id} />
                      <a
                        href={`/api/documents/quotation/${quotation.id}`}
                        className={pdfLinkClass}
                      >
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
                  <td className="px-5 py-6 text-sm text-muted-foreground" colSpan={8}>
                    No quotations saved yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
