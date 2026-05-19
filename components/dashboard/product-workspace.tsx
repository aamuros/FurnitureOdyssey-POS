"use client";

import { useActionState, useMemo, useState } from "react";
import { ImagePlus, PackageOpen, Pencil, Plus, Save, Star, Trash2, Upload } from "lucide-react";
import {
  createProductAction,
  removeProductImageAction,
  setPrimaryProductImageAction,
  updateProductAction,
  uploadProductImageAction
} from "@/app/actions/products";
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

function ProductImageManager({
  productId,
  productName,
  images
}: {
  productId: string;
  productName: string;
  images: ProductImageDraft[];
}) {
  async function uploadImage(formData: FormData) {
    await uploadProductImageAction(formData);
  }

  async function setPrimaryImage(formData: FormData) {
    await setPrimaryProductImageAction(formData);
  }

  async function removeImage(formData: FormData) {
    await removeProductImageAction(formData);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Product images</h3>
      </div>
      <form action={uploadImage} className="studio-subpanel grid gap-3 p-3 sm:grid-cols-[1fr_1fr_96px_auto]">
        <input type="hidden" name="productId" value={productId} />
        <label className="space-y-2 text-sm font-medium">
          Image file
          <Input name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Alt text
          <Input name="altText" placeholder={productName} />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Sort
          <Input name="sortOrder" type="number" min="0" defaultValue={images.length} />
        </label>
        <div className="flex items-end gap-3">
          <label className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
            <input name="isPrimary" type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" />
            Primary
          </label>
          <Button type="submit" variant="secondary" className="min-h-10 px-3">
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </div>
      </form>
      {images.map((image, index) => (
        <div key={image.id ?? index} className="studio-subpanel grid gap-3 p-3 lg:grid-cols-[96px_1fr]">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/55">
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
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">{image.altText || productName}</p>
              <p className="break-all text-xs text-muted-foreground">{image.cloudinaryPublicId}</p>
              <p className="text-xs text-muted-foreground">Sort {image.sortOrder}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form action={setPrimaryImage}>
                <input type="hidden" name="productId" value={productId} />
                <input type="hidden" name="imageId" value={image.id ?? ""} />
                <Button type="submit" variant={image.isPrimary ? "secondary" : "ghost"} className="min-h-9 px-3" disabled={image.isPrimary}>
                  <Star className="h-4 w-4" />
                  {image.isPrimary ? "Primary" : "Set primary"}
                </Button>
              </form>
              <form action={removeImage}>
                <input type="hidden" name="productId" value={productId} />
                <input type="hidden" name="imageId" value={image.id ?? ""} />
                <Button type="submit" variant="ghost" className="min-h-9 px-2">
                <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </form>
            </div>
          </div>
        </div>
      ))}
      {images.length === 0 ? (
        <p className="studio-empty px-3 py-4 text-sm">
          Upload product photos after saving the product record.
        </p>
      ) : null}
    </div>
  );
}

export function ProductWorkspace({ products, canCreate, canUpdate }: ProductWorkspaceProps) {
  const [createState, createAction, createPending] = useActionState(createProductAction, initialState);
  const [updateState, updateAction, updatePending] = useActionState(updateProductAction, initialState);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  function selectProduct(product: ProductRow) {
    setSelectedProductId(product.id);
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        {canCreate ? (
          <section className="studio-card">
            <div className="studio-card-header">
              <p className="studio-kicker">Catalog Piece</p>
              <h2 className="text-sm font-semibold">New product</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create catalog records for quotation and order selection.
              </p>
            </div>
            <form action={createAction} className="space-y-4 p-5">
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
              {createState.message ? (
                <p className={createState.ok ? "text-sm text-success" : "text-sm text-danger"}>
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
          <section className="studio-card">
            <div className="studio-card-header">
              <p className="studio-kicker">Catalog Details</p>
              <h2 className="text-sm font-semibold">Edit product</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a row from the product list to update catalog details.
              </p>
            </div>
            <form key={selectedProduct.id} action={updateAction} className="space-y-4 p-5">
              <input type="hidden" name="productId" value={selectedProduct.id} />
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
              {updateState.message ? (
                <p className={updateState.ok ? "text-sm text-success" : "text-sm text-danger"}>
                  {updateState.message}
                </p>
              ) : null}
              <Button disabled={updatePending}>
                <Save className="h-4 w-4" />
                Update product
              </Button>
            </form>
            <div className="border-t border-border p-5">
              <ProductImageManager
                productId={selectedProduct.id}
                productName={selectedProduct.name}
                images={selectedProduct.images}
              />
            </div>
          </section>
        ) : null}
      </div>

      <section className="studio-card">
        <div className="studio-card-header">
          <p className="studio-kicker">Furniture Catalog</p>
          <h2 className="text-sm font-semibold">Product catalog</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search and filter from the page controls above this list.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="studio-table w-full min-w-[1060px] text-left text-sm">
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
                <tr key={product.id} className={selectedProductId === product.id ? "bg-soft-accent/45" : undefined}>
                  <td className="px-5 py-3">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/55">
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
                  <td className="px-5 py-8 text-sm text-muted-foreground" colSpan={canUpdate ? 9 : 8}>
                    <div className="studio-empty flex items-center gap-3 px-4 py-4">
                      <PackageOpen className="h-5 w-5 text-accent" />
                      <span>No products match the current filters.</span>
                    </div>
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
