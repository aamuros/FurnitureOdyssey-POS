"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ImagePlus,
  MoreHorizontal,
  PackageOpen,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X
} from "lucide-react";
import {
  createProductAction,
  deleteProductAction,
  updateProductAction,
  updateProductStatusAction
} from "@/app/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";

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
  primaryImage: {
    secureUrl: string;
    altText: string | null;
  } | null;
  updatedAt: string;
};

type ProductWorkspaceProps = {
  products: ProductRow[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canViewProductCost: boolean;
  hasActiveFilters: boolean;
  categories: string[];
};

type ActionState = {
  ok: boolean;
  message: string;
};

type ProductFormProps = {
  mode: "create" | "edit";
  product?: ProductRow;
  state: ActionState;
  pending: boolean;
  action: (formData: FormData) => void;
  onCancel: () => void;
  categories: string[];
  canUploadImage: boolean;
  canViewProductCost: boolean;
};

const fieldClassName = "flex min-h-[78px] flex-col gap-2 text-sm font-medium";
const essentialCategories = [
  "Sofa",
  "Chair",
  "Dining",
  "Bed",
  "Table",
  "Storage",
  "Office",
  "Outdoor",
  "Decor"
];

const initialState = {
  ok: false,
  message: ""
};

function uniqueCategories(categories: string[], currentCategory?: string | null) {
  return Array.from(
    new Set(
      [...essentialCategories, ...categories, currentCategory ?? ""]
        .map((category) => category.trim())
        .filter(Boolean)
    )
  );
}

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

function ProductForm({
  mode,
  product,
  state,
  pending,
  action,
  onCancel,
  categories,
  canUploadImage,
  canViewProductCost
}: ProductFormProps) {
  const isEdit = mode === "edit";
  const categoryOptions = uniqueCategories(categories, product?.category);

  return (
    <section className="border-y border-border bg-muted/20">
      <div className="px-5 pb-3 pt-5">
        <p className="studio-kicker">{isEdit ? "Edit Product" : "Furniture Catalog"}</p>
        <h2 className="text-base font-semibold">
          {isEdit ? `Edit product: ${product?.name ?? "Product"}` : "New product"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep the catalog details simple. Pricing can still be adjusted later in quotations.
        </p>
      </div>
      <form key={product?.id ?? "new"} action={action}>
        {isEdit && product ? <input type="hidden" name="productId" value={product.id} /> : null}

        <div className="space-y-4 px-5 pb-5 pt-2">
          <div className="grid gap-4 md:grid-cols-[1.1fr_0.7fr]">
            <label className={fieldClassName}>
              Name
              <Input name="name" required defaultValue={product?.name ?? ""} placeholder="Product name" />
            </label>
            <label className={fieldClassName}>
              Code
              <Input name="code" defaultValue={product?.code ?? ""} placeholder="Optional code" />
              <span className="block text-xs font-normal leading-4 text-muted-foreground">
                Optional. Use this only when a supplier or internal code helps.
              </span>
            </label>
          </div>

          <div className={canViewProductCost ? "grid gap-4 md:grid-cols-4" : "grid gap-4 md:grid-cols-3"}>
            <label className={fieldClassName}>
              Category
              <Select name="category" defaultValue={product?.category ?? ""}>
                <option value="">Choose category</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </label>
            <label className={fieldClassName}>
              Unit price
              <Input
                name="referencePrice"
                type="number"
                min="0"
                step="0.01"
                defaultValue={product?.referencePrice ?? ""}
              />
              <span className="block text-xs font-normal leading-4 text-muted-foreground">
                Optional. This can still be changed in a quotation.
              </span>
            </label>
            {canViewProductCost ? (
              <label className={fieldClassName}>
                Product cost
                <Input
                  name="referenceCost"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={product?.referenceCost ?? ""}
                />
                <span className="block text-xs font-normal leading-4 text-muted-foreground">
                  Used as the default unit cost snapshot.
                </span>
              </label>
            ) : null}
            <label className={fieldClassName}>
              Status
              <Select name="status" defaultValue={product?.status ?? "ACTIVE"}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
              <span className="block text-xs font-normal leading-4 text-muted-foreground">
                Inactive products are hidden from normal quotation selection.
              </span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Description
              <Textarea name="description" defaultValue={product?.description ?? ""} className="h-32 resize-y" />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Specifications
              <Textarea name="specifications" defaultValue={product?.specifications ?? ""} className="h-32 resize-y" />
            </label>
          </div>

          {!isEdit && canUploadImage ? (
            <div className="rounded-lg border border-border bg-panel/70 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/55">
                    <ImagePlus className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Product photo</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optional. Add one main photo for the catalog thumbnail.
                    </p>
                  </div>
                </div>
                <Input
                  name="imageFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="max-w-sm bg-background"
                />
              </div>
            </div>
          ) : null}

          {state.message && !state.ok ? (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{state.message}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-panel/70 px-5 py-4">
          <Button disabled={pending}>
            <Save className="h-4 w-4" />
            {isEdit ? "Update product" : "Save product"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}

function ProductEmptyState({
  canCreate,
  hasActiveFilters,
  onCreate
}: {
  canCreate: boolean;
  hasActiveFilters: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="studio-empty m-5 flex flex-col items-start gap-3 px-5 py-6 text-sm">
      <PackageOpen className="h-5 w-5 text-accent" />
      <div>
        <p className="font-medium text-foreground">
          {hasActiveFilters ? "No products match your filters." : "No products yet."}
        </p>
        {!hasActiveFilters ? (
          <p className="mt-1 text-muted-foreground">
            Create reusable product references for quotations and orders.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {hasActiveFilters ? (
          <Link href="/products" className="text-sm font-medium text-accent transition hover:text-accent/80">
            Reset filters
          </Link>
        ) : null}
        {canCreate ? (
          <Button type="button" variant="secondary" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            New product
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ProductNotice({
  message,
  tone,
  onDismiss
}: {
  message: string;
  tone: "success" | "danger";
  onDismiss: () => void;
}) {
  const isDanger = tone === "danger";

  return (
    <div
      className={
        isDanger
          ? "mx-5 mb-5 flex items-start gap-3 rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger"
          : "mx-5 mb-5 flex items-start gap-3 rounded-md border border-success/20 bg-success/10 px-3 py-2 text-sm text-success"
      }
      role="status"
    >
      {isDanger ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <p className="min-w-0 flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md p-1 transition hover:bg-background/50"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProductRowActions({
  product,
  canUpdate,
  canDelete,
  statusAction,
  statusPending,
  deleteAction,
  deletePending,
  onEdit
}: {
  product: ProductRow;
  canUpdate: boolean;
  canDelete: boolean;
  statusAction: (formData: FormData) => void;
  statusPending: boolean;
  deleteAction: (formData: FormData) => void;
  deletePending: boolean;
  onEdit: (product: ProductRow) => void;
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
  const isBusy = statusPending || deletePending || isSubmitting;
  const canShowMenu = canUpdate || canDelete;
  const nextStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const statusLabel = product.status === "ACTIVE" ? "Deactivate" : "Activate";

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
    if (isBusy) {
      return;
    }

    if (isOpen) {
      closeMenu();
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const menuWidth = 192;
    const estimatedHeight = canDelete ? 156 : 112;
    const hasRoomBelow = rect.bottom + estimatedHeight + 12 < window.innerHeight;
    setMenuPosition({
      left: Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rect.right - menuWidth)),
      top: hasRoomBelow ? rect.bottom + 8 : rect.top - 8,
      placement: hasRoomBelow ? "below" : "above"
    });
  }

  function submitStatusUpdate() {
    if (
      product.status === "ACTIVE" &&
      !window.confirm(`Deactivate ${product.name}? It will be hidden from normal quotation selection.`)
    ) {
      return;
    }

    const formData = new FormData();
    formData.set("productId", product.id);
    formData.set("status", nextStatus);

    closeMenu();
    startActionTransition(() => {
      statusAction(formData);
    });
  }

  function submitDelete() {
    if (
      !window.confirm(
        `Delete ${product.name}? Only unused products can be deleted. Products already used in quotations or orders should be deactivated instead.`
      )
    ) {
      return;
    }

    const formData = new FormData();
    formData.set("productId", product.id);

    closeMenu();
    startActionTransition(() => {
      deleteAction(formData);
    });
  }

  if (!canShowMenu) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="contents">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`${product.name} actions`}
        disabled={isBusy}
        onClick={toggleMenu}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
        <span className="sr-only">Product actions</span>
      </button>
      {isOpen ? (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[80] grid min-w-48 gap-1 rounded-lg border border-border bg-panel p-2 text-left shadow-xl"
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            transform: menuPosition.placement === "above" ? "translateY(-100%)" : undefined
          }}
        >
          {canUpdate ? (
            <Button
              type="button"
              variant="ghost"
              role="menuitem"
              className="min-h-9 justify-start rounded-md px-3"
              onClick={() => {
                closeMenu();
                onEdit(product);
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          ) : null}
          {canUpdate ? (
            <Button
              type="button"
              variant="ghost"
              disabled={isBusy}
              role="menuitem"
              className="min-h-9 justify-start rounded-md px-3"
              onClick={(event) => {
                event.preventDefault();
                submitStatusUpdate();
              }}
            >
              {product.status === "ACTIVE" ? <Ban className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
              {statusLabel}
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              disabled={isBusy}
              role="menuitem"
              className={
                canUpdate
                  ? "mt-1 min-h-9 justify-start rounded-md border-t border-border px-3 pt-2 text-danger hover:bg-danger/10"
                  : "min-h-9 justify-start rounded-md px-3 text-danger hover:bg-danger/10"
              }
              onClick={(event) => {
                event.preventDefault();
                submitDelete();
              }}
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

function ProductTable({
  products,
  canUpdate,
  canDelete,
  canViewProductCost,
  selectedProductId,
  statusAction,
  statusPending,
  deleteAction,
  deletePending,
  onEdit
}: {
  products: ProductRow[];
  canUpdate: boolean;
  canDelete: boolean;
  canViewProductCost: boolean;
  selectedProductId: string;
  statusAction: (formData: FormData) => void;
  statusPending: boolean;
  deleteAction: (formData: FormData) => void;
  deletePending: boolean;
  onEdit: (product: ProductRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="studio-table w-full min-w-[880px] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[76px]" />
          <col className={canViewProductCost ? "w-[26%]" : "w-[30%]"} />
          <col className="w-[14%]" />
          <col className="w-[124px]" />
          {canViewProductCost ? <col className="w-[124px]" /> : null}
          <col className="w-[104px]" />
          <col className="w-[112px]" />
          {canUpdate || canDelete ? <col className="w-[88px]" /> : null}
        </colgroup>
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Image</th>
            <th className="px-4 py-3 font-medium">Product</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 text-right font-medium">Unit price</th>
            {canViewProductCost ? <th className="px-4 py-3 text-right font-medium">Product cost</th> : null}
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Updated</th>
            {canUpdate || canDelete ? <th className="px-4 py-3 text-right font-medium">Action</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {products.map((product) => {
            return (
              <tr key={product.id} className={selectedProductId === product.id ? "bg-soft-accent/35" : undefined}>
                <td className="px-4 py-4 align-middle">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/55">
                    {product.primaryImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.primaryImage.secureUrl}
                        alt={product.primaryImage.altText ?? product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <PackageOpen className="h-4 w-4 text-muted-foreground/80" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 align-middle">
                  <p className="font-semibold text-foreground">{product.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{product.code ?? "No code"}</p>
                </td>
                <td className="px-4 py-4 align-middle text-muted-foreground">{product.category ?? "Uncategorized"}</td>
                <td className="px-4 py-4 text-right align-middle tabular-nums text-muted-foreground">
                  {formatMoney(product.referencePrice, product.currency)}
                </td>
                {canViewProductCost ? (
                  <td className="px-4 py-4 text-right align-middle tabular-nums text-muted-foreground">
                    {formatMoney(product.referenceCost, product.currency)}
                  </td>
                ) : null}
                <td className="px-4 py-4 align-middle">
                  <StatusPill tone={statusTone(product.status)}>{product.status}</StatusPill>
                </td>
                <td className="px-4 py-4 align-middle text-muted-foreground">{product.updatedAt}</td>
                {canUpdate || canDelete ? (
                  <td className="whitespace-nowrap px-4 py-4 text-right align-middle">
                    <ProductRowActions
                      product={product}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      statusAction={statusAction}
                      statusPending={statusPending}
                      deleteAction={deleteAction}
                      deletePending={deletePending}
                      onEdit={onEdit}
                    />
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProductWorkspace({
  products,
  canCreate,
  canUpdate,
  canDelete,
  canViewProductCost,
  hasActiveFilters,
  categories
}: ProductWorkspaceProps) {
  const [createState, createAction, createPending] = useActionState(createProductAction, initialState);
  const [updateState, updateAction, updatePending] = useActionState(updateProductAction, initialState);
  const [statusState, statusAction, statusPending] = useActionState(updateProductStatusAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteProductAction, initialState);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");

  useEffect(() => {
    setSelectedProductId((current) =>
      current && products.some((product) => product.id === current) ? current : ""
    );
  }, [products]);

  useEffect(() => {
    if (createState.ok && createState.message) {
      setNotice(createState.message);
      setNoticeTone("success");
      setShowCreateForm(false);
      setSelectedProductId("");
    }
  }, [createState.ok, createState.message]);

  useEffect(() => {
    if (updateState.ok && updateState.message) {
      setNotice(updateState.message);
      setNoticeTone("success");
      setShowCreateForm(false);
      setSelectedProductId("");
    }
  }, [updateState.ok, updateState.message]);

  useEffect(() => {
    if (statusState.message) {
      setNotice(statusState.message);
      setNoticeTone(statusState.ok ? "success" : "danger");
      setSelectedProductId("");
      setShowCreateForm(false);
    }
  }, [statusState.message, statusState.ok]);

  useEffect(() => {
    if (deleteState.message) {
      setNotice(deleteState.message);
      setNoticeTone(deleteState.ok ? "success" : "danger");
      setSelectedProductId("");
      setShowCreateForm(false);
    }
  }, [deleteState.message, deleteState.ok]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  function openCreateForm() {
    setNotice("");
    setSelectedProductId("");
    setShowCreateForm(true);
  }

  function openEditForm(product: ProductRow) {
    setNotice("");
    setShowCreateForm(false);
    setSelectedProductId(product.id);
  }

  function closeForm() {
    setShowCreateForm(false);
    setSelectedProductId("");
  }

  return (
    <div className="space-y-6">
      <section className="studio-card">
        <div className="studio-card-header flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="studio-kicker">Furniture Catalog</p>
            <h2 className="text-sm font-semibold">Product list</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Find products, adjust basic details, or deactivate items no longer offered.
            </p>
          </div>
          {canCreate ? (
            <Button type="button" variant="secondary" onClick={openCreateForm}>
              <Plus className="h-4 w-4" />
              New product
            </Button>
          ) : null}
        </div>

        {notice ? (
          <ProductNotice message={notice} tone={noticeTone} onDismiss={() => setNotice("")} />
        ) : null}

        {canCreate && showCreateForm ? (
          <ProductForm
            mode="create"
            state={createState}
            pending={createPending}
            action={createAction}
            onCancel={closeForm}
            categories={categories}
            canUploadImage={canUpdate}
            canViewProductCost={canViewProductCost}
          />
        ) : null}

        {canUpdate && selectedProduct ? (
          <ProductForm
            mode="edit"
            product={selectedProduct}
            state={updateState}
            pending={updatePending}
            action={updateAction}
            onCancel={closeForm}
            categories={categories}
            canUploadImage={false}
            canViewProductCost={canViewProductCost}
          />
        ) : null}

        {products.length ? (
          <ProductTable
            products={products}
            canUpdate={canUpdate}
            canDelete={canDelete}
            canViewProductCost={canViewProductCost}
            selectedProductId={selectedProductId}
            statusAction={statusAction}
            statusPending={statusPending}
            deleteAction={deleteAction}
            deletePending={deletePending}
            onEdit={openEditForm}
          />
        ) : (
          <ProductEmptyState
            canCreate={canCreate}
            hasActiveFilters={hasActiveFilters}
            onCreate={openCreateForm}
          />
        )}
      </section>
    </div>
  );
}
