"use client";

import { useActionState, useMemo, useState } from "react";
import { ImagePlus, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { createProductAction, updateProductAction } from "@/app/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";

type ProductImageDraft = {
  id?: string;
  cloudinaryPublicId: string;
  secureUrl: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
};

type ProductRow = {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  description: string | null;
  specifications: string | null;
  referencePrice: number | null;
  referenceCost: number | null;
  currency: string;
  status: "ACTIVE" | "INACTIVE";
  isWebsiteVisible: boolean;
  websiteSortOrder: number;
  internalNotes: string | null;
  primaryImage: {
    secureUrl: string;
    altText: string | null;
  } | null;
  images: ProductImageDraft[];
  updatedAt: string;
};

type ProductWorkspaceProps = {
  products: ProductRow[];
  canCreate: boolean;
  canUpdate: boolean;
};

const initialState = {
  ok: false,
  message: ""
};

const emptyImage: ProductImageDraft = {
  cloudinaryPublicId: "",
  secureUrl: "",
  altText: "",
  sortOrder: 0,
  isPrimary: true
};

function statusTone(status: ProductRow["status"]) {
  return status === "ACTIVE" ? "success" : "neutral";
}

function formatMoney(value: number | null, currency: string) {
  if (value === null) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency
  }).format(value);
}

function imagePayload(images: ProductImageDraft[]) {
  return images
    .filter((image) => image.cloudinaryPublicId.trim() || image.secureUrl.trim())
    .map((image, index) => ({
      ...image,
      sortOrder: Number.isFinite(image.sortOrder) ? image.sortOrder : index,
      isPrimary: image.isPrimary
    }));
}

function ProductImageFields({
  images,
  setImages
}: {
  images: ProductImageDraft[];
  setImages: React.Dispatch<React.SetStateAction<ProductImageDraft[]>>;
}) {
  function updateImage(index: number, field: keyof ProductImageDraft, value: string | boolean | number) {
    setImages((current) =>
      current.map((image, imageIndex) => {
        if (imageIndex !== index) {
          return field === "isPrimary" && value === true
            ? { ...image, isPrimary: false }
            : image;
        }

        return {
          ...image,
          [field]: value
        };
      })
    );
  }

  function addImage() {
    setImages((current) => [
      ...current,
      {
        ...emptyImage,
        sortOrder: current.length,
        isPrimary: current.length === 0
      }
    ]);
  }

  function removeImage(index: number) {
    setImages((current) => {
      const next = current.filter((_, imageIndex) => imageIndex !== index);

      if (next.length && !next.some((image) => image.isPrimary)) {
        return next.map((image, imageIndex) => ({
          ...image,
          isPrimary: imageIndex === 0
        }));
      }

      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Product images</h3>
        <Button type="button" variant="secondary" onClick={addImage} className="min-h-9 px-3">
          <ImagePlus className="h-4 w-4" />
          Add image
        </Button>
      </div>
      {images.map((image, index) => (
        <div key={image.id ?? index} className="grid gap-3 rounded-md border border-border p-3 lg:grid-cols-[96px_1fr]">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
            {image.secureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.secureUrl}
                alt={image.altText || "Product preview"}
                className="h-full w-full object-cover"
              />
            ) : (
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={image.cloudinaryPublicId}
              onChange={(event) => updateImage(index, "cloudinaryPublicId", event.target.value)}
              placeholder="Cloudinary public ID"
              aria-label="Cloudinary public ID"
            />
            <Input
              value={image.secureUrl}
              onChange={(event) => updateImage(index, "secureUrl", event.target.value)}
              placeholder="Secure URL"
              aria-label="Secure image URL"
            />
            <Input
              value={image.altText}
              onChange={(event) => updateImage(index, "altText", event.target.value)}
              placeholder="Alt text"
              aria-label="Alt text"
            />
            <Input
              type="number"
              min="0"
              value={image.sortOrder}
              onChange={(event) => updateImage(index, "sortOrder", Number(event.target.value))}
              aria-label="Image sort order"
            />
            <div className="flex items-center gap-3 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={image.isPrimary}
                  onChange={(event) => updateImage(index, "isPrimary", event.target.checked)}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
                Primary
              </label>
              <Button type="button" variant="ghost" onClick={() => removeImage(index)} className="min-h-9 px-2">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
      {images.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          Add Cloudinary image metadata when a product photo is available.
        </p>
      ) : null}
    </div>
  );
}

export function ProductWorkspace({ products, canCreate, canUpdate }: ProductWorkspaceProps) {
  const [createState, createAction, createPending] = useActionState(createProductAction, initialState);
  const [updateState, updateAction, updatePending] = useActionState(updateProductAction, initialState);
  const [createImages, setCreateImages] = useState<ProductImageDraft[]>([]);
  const [editImages, setEditImages] = useState<ProductImageDraft[]>(() => products[0]?.images ?? []);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  function selectProduct(product: ProductRow) {
    setSelectedProductId(product.id);
    setEditImages(product.images);
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        {canCreate ? (
          <section className="rounded-lg border border-border bg-panel">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">New product</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create catalog records for quotation and order selection.
              </p>
            </div>
            <form action={createAction} className="space-y-4 p-5">
              <input type="hidden" name="images" value={JSON.stringify(imagePayload(createImages))} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  Code
                  <Input name="code" placeholder="Optional unique code" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Name
                  <Input name="name" required placeholder="Product name" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Category
                  <Input name="category" placeholder="Sofa, dining, bed frame" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Currency
                  <Input name="currency" defaultValue="PHP" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Reference price
                  <Input name="referencePrice" type="number" min="0" step="0.01" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Reference cost
                  <Input name="referenceCost" type="number" min="0" step="0.01" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Status
                  <Select name="status" defaultValue="ACTIVE">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </Select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Website sort order
                  <Input name="websiteSortOrder" type="number" min="0" defaultValue="0" />
                </label>
              </div>
              <label className="block space-y-2 text-sm font-medium">
                Description
                <Textarea name="description" />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Specifications
                <Textarea name="specifications" />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Internal notes
                <Textarea name="internalNotes" />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input name="isWebsiteVisible" type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" />
                Visible on future customer website
              </label>
              <ProductImageFields images={createImages} setImages={setCreateImages} />
              {createState.message ? (
                <p className={createState.ok ? "text-sm text-emerald-700" : "text-sm text-danger"}>
                  {createState.message}
                </p>
              ) : null}
              <Button disabled={createPending}>
                <Save className="h-4 w-4" />
                Save product
              </Button>
            </form>
          </section>
        ) : null}

        {canUpdate && selectedProduct ? (
          <section className="rounded-lg border border-border bg-panel">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Edit product</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a row from the product list to update catalog details.
              </p>
            </div>
            <form key={selectedProduct.id} action={updateAction} className="space-y-4 p-5">
              <input type="hidden" name="productId" value={selectedProduct.id} />
              <input type="hidden" name="images" value={JSON.stringify(imagePayload(editImages))} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  Code
                  <Input name="code" defaultValue={selectedProduct.code ?? ""} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Name
                  <Input name="name" required defaultValue={selectedProduct.name} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Category
                  <Input name="category" defaultValue={selectedProduct.category ?? ""} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Currency
                  <Input name="currency" defaultValue={selectedProduct.currency} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Reference price
                  <Input name="referencePrice" type="number" min="0" step="0.01" defaultValue={selectedProduct.referencePrice ?? ""} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Reference cost
                  <Input name="referenceCost" type="number" min="0" step="0.01" defaultValue={selectedProduct.referenceCost ?? ""} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Status
                  <Select name="status" defaultValue={selectedProduct.status}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </Select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Website sort order
                  <Input name="websiteSortOrder" type="number" min="0" defaultValue={selectedProduct.websiteSortOrder} />
                </label>
              </div>
              <label className="block space-y-2 text-sm font-medium">
                Description
                <Textarea name="description" defaultValue={selectedProduct.description ?? ""} />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Specifications
                <Textarea name="specifications" defaultValue={selectedProduct.specifications ?? ""} />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Internal notes
                <Textarea name="internalNotes" defaultValue={selectedProduct.internalNotes ?? ""} />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  name="isWebsiteVisible"
                  type="checkbox"
                  defaultChecked={selectedProduct.isWebsiteVisible}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
                Visible on future customer website
              </label>
              <ProductImageFields images={editImages} setImages={setEditImages} />
              {updateState.message ? (
                <p className={updateState.ok ? "text-sm text-emerald-700" : "text-sm text-danger"}>
                  {updateState.message}
                </p>
              ) : null}
              <Button disabled={updatePending}>
                <Save className="h-4 w-4" />
                Update product
              </Button>
            </form>
          </section>
        ) : null}
      </div>

      <section className="rounded-lg border border-border bg-panel">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Product catalog</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search and filter from the page controls above this list.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Image</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Reference price</th>
                <th className="px-5 py-3 font-medium">Reference cost</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Website</th>
                <th className="px-5 py-3 font-medium">Updated</th>
                {canUpdate ? <th className="px-5 py-3 font-medium">Action</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => (
                <tr key={product.id} className={selectedProductId === product.id ? "bg-muted/50" : undefined}>
                  <td className="px-5 py-3">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                      {product.primaryImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.primaryImage.secureUrl}
                          alt={product.primaryImage.altText ?? product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.code ?? "No code"}</p>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{product.category ?? "Uncategorized"}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {formatMoney(product.referencePrice, product.currency)}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {formatMoney(product.referenceCost, product.currency)}
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill tone={statusTone(product.status)}>{product.status}</StatusPill>
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill tone={product.isWebsiteVisible ? "success" : "neutral"}>
                      {product.isWebsiteVisible ? "VISIBLE" : "HIDDEN"}
                    </StatusPill>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{product.updatedAt}</td>
                  {canUpdate ? (
                    <td className="px-5 py-3">
                      <Button type="button" variant="secondary" onClick={() => selectProduct(product)} className="min-h-9 px-3">
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {products.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-sm text-muted-foreground" colSpan={canUpdate ? 9 : 8}>
                    No products match the current filters.
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
