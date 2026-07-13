"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronDown,
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
  createTagAction,
  createProductAction,
  deleteTagAction,
  deleteProductAction,
  updateTagAction,
  updateProductAction,
  updateProductStatusAction,
  updateProductWebsiteVisibilityAction
} from "@/app/actions/products";
import { AdminModal } from "@/components/dashboard/admin-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import { compressImageIfNeeded } from "@/lib/uploads/client-compression";
import { usePersistentPageState } from "@/lib/use-persistent-page-state";

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
  websitePages: string[];
  websitePageSortOrders: Record<string, number>;
  primaryImage: {
    id: string;
    secureUrl: string;
    altText: string | null;
    colorVariantId: string | null;
    sortOrder: number;
    isPrimary: boolean;
  } | null;
  images: ProductImageRow[];
  colorVariants: ProductColorVariantRow[];
  tags: ProductTagRow[];
  updatedAt: string;
};

type TagRow = {
  id: string;
  name: string;
  productCount?: number;
};

type ProductTagRow = {
  id: string;
  name: string;
};

type ProductImageRow = {
  id: string;
  colorVariantId: string | null;
  secureUrl: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

type ProductColorVariantRow = {
  id: string;
  name: string;
  hex: string | null;
  sortOrder: number;
  isActive: boolean;
};

type ImageHolderDraft = {
  clientId: string;
  id?: string;
  colorVariantClientId?: string | null;
  secureUrl?: string;
  altText?: string | null;
  sortOrder: number;
  isPrimary: boolean;
  file?: File;
  previewUrl?: string;
  fileName?: string;
  remove?: boolean;
};

type ColorVariantDraft = {
  clientId: string;
  id?: string;
  name: string;
  hex: string;
  sortOrder: number;
  isActive: boolean;
  remove?: boolean;
};

type ProductFormSectionKey = "basic" | "catalogue" | "description" | "images" | "variants";

type ProductWorkspaceProps = {
  products: ProductRow[];
  tags: TagRow[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canViewProductCost: boolean;
  hasActiveFilters: boolean;
  persistenceUserKey?: string | null;
};

type ActionState = {
  ok: boolean;
  message: string;
  tagId?: string;
  tagName?: string;
};

type ProductFormProps = {
  mode: "create" | "edit";
  product?: ProductRow;
  draft: ProductFormDraft;
  onDraftChange: (patch: Partial<ProductFormDraft>) => void;
  state: ActionState;
  pending: boolean;
  action: (formData: FormData) => void;
  onCancel: () => void;
  canUploadImage: boolean;
  canViewProductCost: boolean;
  tags: TagRow[];
  canCreateTag: boolean;
  canUpdateTag: boolean;
  canDeleteTag: boolean;
};

type ProductFormDraft = {
  name: string;
  code: string;
  category: string;
  referencePrice: string;
  referenceCost: string;
  status: ProductRow["status"];
  isWebsiteVisible: boolean;
  websiteSortOrder: string;
  websitePages: string[];
  websitePageSortOrders: Record<string, string>;
  tagIds: string[];
  description: string;
  specifications: string;
};

type ProductWorkspaceDraft = {
  selectedProductId: string;
  showCreateForm: boolean;
  createDraft: ProductFormDraft;
  editDrafts: Record<string, ProductFormDraft>;
};

type QuickSavingField = "status" | "website";
type QuickSavingState = Partial<Record<QuickSavingField, string>>;

const fieldClassName = "flex min-h-[78px] flex-col gap-2 text-sm font-medium";
const productCategoryOptions = ["Chair", "Table", "Others"] as const;
const websitePageOptions = [
  { label: "Home", value: "home" },
  { label: "Chairs", value: "chairs" },
  { label: "Tables", value: "tables" },
  { label: "Collections", value: "collections" }
] as const;
type WebsitePageValue = (typeof websitePageOptions)[number]["value"];

const initialState: ActionState = {
  ok: false,
  message: ""
};

const blankProductDraft: ProductFormDraft = {
  name: "",
  code: "",
  category: "Others",
  referencePrice: "",
  referenceCost: "",
  status: "ACTIVE",
  isWebsiteVisible: false,
  websiteSortOrder: "0",
  websitePages: [],
  websitePageSortOrders: {},
  tagIds: [],
  description: "",
  specifications: ""
};

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function normalizeProductCategory(category?: string | null) {
  const normalized = String(category ?? "").trim().toLowerCase();

  if (normalized === "chair" || normalized === "chairs" || normalized === "stool" || normalized === "stools") {
    return "Chair";
  }

  if (normalized === "table" || normalized === "tables") {
    return "Table";
  }

  return "Others";
}

function normalizeWebsitePages(pages?: string[] | null) {
  const allowedPages = new Set<string>(websitePageOptions.map((page) => page.value));

  return Array.from(new Set((pages ?? []).filter((page) => allowedPages.has(page))));
}

function normalizeWebsitePageSortOrders(sortOrders?: Record<string, number | string> | null) {
  return Object.fromEntries(
    websitePageOptions.map((page) => {
      const rawValue = sortOrders?.[page.value];
      const value = Number(rawValue ?? 0);

      return [page.value, Number.isFinite(value) ? String(Math.max(0, Math.trunc(value))) : "0"];
    })
  ) as Record<WebsitePageValue, string>;
}

function normalizeTagIds(tagIds?: string[] | null, tags?: TagRow[]) {
  const uniqueTagIds = Array.from(new Set((tagIds ?? []).filter(Boolean)));

  if (!tags) {
    return uniqueTagIds;
  }

  const selected = new Set(uniqueTagIds);
  return tags.map((tag) => tag.id).filter((tagId) => selected.has(tagId));
}

function productToDraft(product: ProductRow): ProductFormDraft {
  return {
    name: product.name,
    code: product.code ?? "",
    category: normalizeProductCategory(product.category),
    referencePrice: product.referencePrice === null ? "" : String(product.referencePrice),
    referenceCost: product.referenceCost === null ? "" : String(product.referenceCost),
    status: product.status,
    isWebsiteVisible: product.isWebsiteVisible,
    websiteSortOrder: String(product.websiteSortOrder),
    websitePages: normalizeWebsitePages(product.websitePages),
    websitePageSortOrders: normalizeWebsitePageSortOrders(product.websitePageSortOrders),
    tagIds: normalizeTagIds(product.tags.map((tag) => tag.id)),
    description: product.description ?? "",
    specifications: product.specifications ?? ""
  };
}

function normalizedProductDraftForDirtyCheck(draft: ProductFormDraft) {
  const websitePages = normalizeWebsitePages(draft.websitePages);

  return {
    name: draft.name,
    code: draft.code,
    category: normalizeProductCategory(draft.category),
    referencePrice: draft.referencePrice,
    referenceCost: draft.referenceCost,
    status: draft.status,
    isWebsiteVisible: draft.isWebsiteVisible,
    websiteSortOrder: draft.websiteSortOrder,
    websitePages,
    websitePageSortOrders: Object.fromEntries(
      websitePages.map((page) => [page, draft.websitePageSortOrders[page] ?? "0"])
    ),
    tagIds: normalizeTagIds(draft.tagIds),
    description: draft.description,
    specifications: draft.specifications
  };
}

function productDraftsMatch(first: ProductFormDraft, second: ProductFormDraft) {
  return (
    JSON.stringify(normalizedProductDraftForDirtyCheck(first)) ===
    JSON.stringify(normalizedProductDraftForDirtyCheck(second))
  );
}

function makeClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function imagesForProduct(product?: ProductRow): ImageHolderDraft[] {
  const images =
    product?.images
      .filter((image) => image.colorVariantId === null)
      .map((image, index) => ({
        clientId: image.id,
        id: image.id,
        colorVariantClientId: null,
        secureUrl: image.secureUrl,
        altText: image.altText,
        sortOrder: image.sortOrder ?? index,
        isPrimary: image.isPrimary
      })) ?? [];

  return images.length
    ? images
    : [
        {
          clientId: makeClientId("image"),
          colorVariantClientId: null,
          sortOrder: 0,
          isPrimary: true
        }
      ];
}

function colorVariantsForProduct(product?: ProductRow): ColorVariantDraft[] {
  return (
    product?.colorVariants.map((variant, index) => ({
      clientId: variant.id,
      id: variant.id,
      name: variant.name,
      hex: variant.hex ?? "#111111",
      sortOrder: variant.sortOrder ?? index,
      isActive: variant.isActive
    })) ?? []
  );
}

function defaultProductFormCollapsedSections(product?: ProductRow): Record<ProductFormSectionKey, boolean> {
  return {
    basic: false,
    catalogue: false,
    description: false,
    images: false,
    variants: colorVariantsForProduct(product).length === 0
  };
}

function imagesForColorVariants(product?: ProductRow): ImageHolderDraft[] {
  return (
    product?.images
      .filter((image) => image.colorVariantId !== null)
      .map((image, index) => ({
        clientId: image.id,
        id: image.id,
        colorVariantClientId: image.colorVariantId,
        secureUrl: image.secureUrl,
        altText: image.altText,
        sortOrder: image.sortOrder ?? index,
        isPrimary: false
      })) ?? []
  );
}

function sortOrderSummary(product: ProductRow) {
  const pages = normalizeWebsitePages(product.websitePages);

  if (pages.length === 0) {
    return "-";
  }

  return pages
    .map((page) => {
      const label = websitePageOptions.find((option) => option.value === page)?.label ?? page;
      const value = product.websitePageSortOrders?.[page] ?? 0;

      return `${label} ${value}`;
    })
    .join(", ");
}

function websitePageSummary(product: ProductRow) {
  const pages = normalizeWebsitePages(product.websitePages);

  if (pages.length === 0) {
    return "-";
  }

  return pages
    .map((page) => websitePageOptions.find((option) => option.value === page)?.label ?? page)
    .join(", ");
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

function ProductTagManager({
  tags,
  selectedTagIds,
  onSelectedTagIdsChange,
  canCreateTag,
  canUpdateTag,
  canDeleteTag
}: {
  tags: TagRow[];
  selectedTagIds: string[];
  onSelectedTagIdsChange: (tagIds: string[]) => void;
  canCreateTag: boolean;
  canUpdateTag: boolean;
  canDeleteTag: boolean;
}) {
  const router = useRouter();
  const [newTagName, setNewTagName] = useState("");
  const [isManagingTags, setIsManagingTags] = useState(false);
  const [tagNameDrafts, setTagNameDrafts] = useState<Record<string, string>>({});
  const [tagIdsMarkedForDelete, setTagIdsMarkedForDelete] = useState<string[]>([]);
  const [tagManageError, setTagManageError] = useState("");
  const [tagManageNotice, setTagManageNotice] = useState("");
  const [originalSelectedTagIds, setOriginalSelectedTagIds] = useState<string[]>([]);
  const [tagActionPending, setTagActionPending] = useState(false);
  const [, startTagTransition] = useTransition();
  const selectedTagSet = new Set(selectedTagIds);
  const canManageTags = canUpdateTag || canDeleteTag;
  const deletedTagIdSet = new Set(tagIdsMarkedForDelete);
  const visibleTags = tags.filter((tag) => !deletedTagIdSet.has(tag.id));

  function toggleTag(tagId: string) {
    if (isManagingTags) {
      return;
    }

    const nextSelected = new Set(selectedTagIds);

    if (nextSelected.has(tagId)) {
      nextSelected.delete(tagId);
    } else {
      nextSelected.add(tagId);
    }

    onSelectedTagIdsChange(normalizeTagIds(Array.from(nextSelected), tags));
  }

  function submitCreateTag() {
    setTagManageError("");
    setTagManageNotice("");

    if (!newTagName.trim()) {
      setTagManageError("Tag name is required.");
      return;
    }

    const formData = new FormData();
    formData.set("name", newTagName);
    startTagTransition(() => {
      setTagActionPending(true);
      void createTagAction(initialState, formData).then((result) => {
        setTagActionPending(false);

        if (!result.ok) {
          setTagManageError(result.message);
          return;
        }

        if (result.tagId) {
          onSelectedTagIdsChange(normalizeTagIds([...selectedTagIds, result.tagId]));
        }

        setNewTagName("");
        setTagManageNotice(result.message);
        router.refresh();
      });
    });
  }

  function enterManageMode() {
    setIsManagingTags(true);
    setTagNameDrafts(Object.fromEntries(tags.map((tag) => [tag.id, tag.name])));
    setTagIdsMarkedForDelete([]);
    setOriginalSelectedTagIds(selectedTagIds);
    setTagManageError("");
    setTagManageNotice("");
  }

  function discardManageChanges() {
    setIsManagingTags(false);
    setTagNameDrafts(Object.fromEntries(tags.map((tag) => [tag.id, tag.name])));
    setTagIdsMarkedForDelete([]);
    onSelectedTagIdsChange(originalSelectedTagIds);
    setOriginalSelectedTagIds([]);
    setTagManageError("");
    setTagManageNotice("");
  }

  function markTagForDelete(tag: TagRow) {
    const productCount = tag.productCount ?? 0;
    const confirmed = window.confirm(
      productCount > 0
        ? `Delete tag "${tag.name}"? It is assigned to ${productCount} product(s) and will be removed from those products.`
        : `Delete tag "${tag.name}"? This will remove it from all assigned products.`
    );

    if (!confirmed) {
      return;
    }

    setTagIdsMarkedForDelete((current) => Array.from(new Set([...current, tag.id])));
    onSelectedTagIdsChange(selectedTagIds.filter((tagId) => tagId !== tag.id));
    setTagManageError("");
    setTagManageNotice("");
  }

  function validateTagManageChanges() {
    const remainingTags = tags.filter((tag) => !deletedTagIdSet.has(tag.id));
    const trimmedNames = remainingTags.map((tag) => (tagNameDrafts[tag.id] ?? tag.name).trim());

    if (trimmedNames.some((name) => !name)) {
      return "Tag name is required.";
    }

    if (new Set(trimmedNames.map((name) => name.toLowerCase())).size !== trimmedNames.length) {
      return "Tag names must be unique.";
    }

    return "";
  }

  function saveManageChanges() {
    setTagManageError("");
    setTagManageNotice("");

    const validationMessage = validateTagManageChanges();

    if (validationMessage) {
      setTagManageError(validationMessage);
      return;
    }

    const renameOperations = tags
      .filter((tag) => !deletedTagIdSet.has(tag.id))
      .map((tag) => ({
        tag,
        name: (tagNameDrafts[tag.id] ?? tag.name).trim()
      }))
      .filter((operation) => operation.name !== operation.tag.name);
    const deleteOperations = tags.filter((tag) => deletedTagIdSet.has(tag.id));

    if (renameOperations.length === 0 && deleteOperations.length === 0) {
      setTagManageError("No tag changes to save.");
      return;
    }

    if (
      deleteOperations.length > 0 &&
      !window.confirm(
        `Save changes and delete ${deleteOperations.length} tag(s)? Deleted tags will be removed from assigned products.`
      )
    ) {
      return;
    }

    startTagTransition(() => {
      setTagActionPending(true);
      void (async () => {
        for (const operation of renameOperations) {
          const formData = new FormData();
          formData.set("tagId", operation.tag.id);
          formData.set("name", operation.name);
          const result = await updateTagAction(initialState, formData);

          if (!result.ok) {
            setTagManageError(result.message);
            setTagActionPending(false);
            return;
          }
        }

        for (const tag of deleteOperations) {
          const formData = new FormData();
          formData.set("tagId", tag.id);
          const result = await deleteTagAction(initialState, formData);

          if (!result.ok) {
            setTagManageError(result.message);
            setTagActionPending(false);
            return;
          }
        }

        setIsManagingTags(false);
        setTagNameDrafts({});
        setTagIdsMarkedForDelete([]);
        setOriginalSelectedTagIds([]);
        setTagManageNotice("Tag changes saved.");
        setTagActionPending(false);
        router.refresh();
      })();
    });
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2 text-sm font-medium">
      <legend>Product tags</legend>
      <p className="text-xs font-normal leading-5 text-muted-foreground">
        Select catalogue chips for filtering and collection browsing.
      </p>
      {visibleTags.length ? (
        <div className="flex flex-wrap gap-2">
          {visibleTags.map((tag) => {
            const isSelected = selectedTagSet.has(tag.id);

            return isManagingTags ? (
              <div
                key={tag.id}
                className="relative inline-flex min-h-10 max-w-full items-center rounded-lg border border-border bg-soft-accent/70 px-3 py-2 pr-7"
              >
                <input
                  value={tagNameDrafts[tag.id] ?? tag.name}
                  onChange={(event) =>
                    setTagNameDrafts((current) => ({
                      ...current,
                      [tag.id]: event.target.value
                    }))
                  }
                  disabled={!canUpdateTag || tagActionPending}
                  className="min-w-16 max-w-40 bg-transparent text-sm font-semibold text-foreground outline-none"
                  aria-label={`Rename ${tag.name}`}
                />
                {canDeleteTag ? (
                  <button
                    type="button"
                    onClick={() => markTagForDelete(tag)}
                    disabled={tagActionPending}
                    className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-danger/30 bg-danger text-white shadow-sm transition hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Delete ${tag.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            ) : (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={
                  isSelected
                    ? "inline-flex min-h-10 items-center justify-center rounded-lg border border-primary/30 bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                    : "inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-soft-accent/70 px-3 text-sm font-semibold text-foreground transition hover:bg-soft-accent"
                }
                aria-pressed={isSelected}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-background/70 px-3 py-2 text-xs font-normal text-muted-foreground">
          {tags.length ? "All tags are marked for deletion." : "No tags yet. Add one below."}
        </p>
      )}

      {canCreateTag && !isManagingTags ? (
        <div className="mt-2 flex gap-2">
          <Input
            value={newTagName}
            onChange={(event) => {
              setNewTagName(event.target.value);
              setTagManageError("");
              setTagManageNotice("");
            }}
            placeholder="New tag"
            className="min-h-10"
          />
          <Button type="button" variant="secondary" onClick={submitCreateTag} disabled={tagActionPending}>
            <Plus className="h-4 w-4" />
            Add tag
          </Button>
        </div>
      ) : null}

      {canManageTags ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {isManagingTags ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={discardManageChanges}
                disabled={tagActionPending}
                className="min-h-9 px-3 text-xs"
              >
                Discard
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={saveManageChanges}
                disabled={tagActionPending}
                className="min-h-9 px-3 text-xs"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={enterManageMode}
              className="min-h-9 px-3 text-xs"
            >
              <Pencil className="h-3.5 w-3.5" />
              Manage tags
            </Button>
          )}
        </div>
      ) : null}
      {tagManageError ? <p className="text-xs font-normal text-danger">{tagManageError}</p> : null}
      {tagManageNotice ? <p className="text-xs font-normal text-success">{tagManageNotice}</p> : null}
    </fieldset>
  );
}

function ProductForm({
  mode,
  product,
  draft,
  onDraftChange,
  state,
  pending,
  action,
  onCancel,
  canUploadImage,
  canViewProductCost,
  tags,
  canCreateTag,
  canUpdateTag,
  canDeleteTag
}: ProductFormProps) {
  const isEdit = mode === "edit";
  const [productImages, setProductImages] = useState<ImageHolderDraft[]>(() => imagesForProduct(product));
  const [colorVariants, setColorVariants] = useState<ColorVariantDraft[]>(() => colorVariantsForProduct(product));
  const [variantImages, setVariantImages] = useState<ImageHolderDraft[]>(() => imagesForColorVariants(product));
  const previewUrlsRef = useRef<Set<string>>(new Set());
  const selectedWebsitePages = normalizeWebsitePages(draft.websitePages);
  const selectedWebsitePageSet = new Set(selectedWebsitePages);
  const selectedTagIds = normalizeTagIds(draft.tagIds, tags);
  const pageSortOrders = normalizeWebsitePageSortOrders(draft.websitePageSortOrders);
  const activeProductImages = productImages.filter((image) => !image.remove);
  const activeVariantImages = variantImages.filter((image) => !image.remove);
  const activeColorVariants = colorVariants.filter((variant) => !variant.remove);
  const [collapsedSections, setCollapsedSections] =
    useState<Record<ProductFormSectionKey, boolean>>(() => defaultProductFormCollapsedSections(product));
  const [imageUploadError, setImageUploadError] = useState<{ fileName: string; fileSizeMB: string } | null>(null);
  const imageManifest = [
    ...productImages.map((image, index) => ({
      clientId: image.clientId,
      id: image.id,
      colorVariantClientId: null,
      cloudinaryPublicId: undefined,
      secureUrl: image.secureUrl,
      altText: image.altText ?? draft.name,
      sortOrder: index,
      isPrimary: image.isPrimary,
      remove: Boolean(image.remove)
    })),
    ...variantImages.map((image, index) => ({
      clientId: image.clientId,
      id: image.id,
      colorVariantClientId: image.colorVariantClientId,
      cloudinaryPublicId: undefined,
      secureUrl: image.secureUrl,
      altText: image.altText ?? draft.name,
      sortOrder: index,
      isPrimary: false,
      remove: Boolean(image.remove)
    }))
  ];
  const colorVariantManifest = colorVariants.map((variant, index) => ({
    clientId: variant.clientId,
    id: variant.id,
    name: variant.name,
    hex: variant.hex,
    sortOrder: index,
    isActive: variant.isActive,
    remove: Boolean(variant.remove)
  }));

  useEffect(() => {
    setProductImages(imagesForProduct(product));
    setColorVariants(colorVariantsForProduct(product));
    setVariantImages(imagesForColorVariants(product));
    setCollapsedSections(defaultProductFormCollapsedSections(product));
  }, [product, mode]);

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;

    return () => {
      previewUrls.forEach((previewUrl) => {
        URL.revokeObjectURL(previewUrl);
      });
      previewUrls.clear();
    };
  }, []);

  function revokePreviewUrl(previewUrl?: string) {
    if (!previewUrl) {
      return;
    }

    URL.revokeObjectURL(previewUrl);
    previewUrlsRef.current.delete(previewUrl);
  }

  function createPreviewUrl(file: File) {
    const previewUrl = URL.createObjectURL(file);
    previewUrlsRef.current.add(previewUrl);
    return previewUrl;
  }

  function imageHasContent(image: ImageHolderDraft) {
    return Boolean(image.secureUrl || image.previewUrl || image.file);
  }

  function ensureProductPrimaryImage(images: ImageHolderDraft[]) {
    const visibleImages = images.filter((image) => !image.remove && imageHasContent(image));

    if (visibleImages.length === 0) {
      return images.map((image) => ({
        ...image,
        isPrimary: false
      }));
    }

    if (visibleImages.some((image) => image.isPrimary)) {
      return images;
    }

    return images.map((image) => ({
      ...image,
      isPrimary: image.clientId === visibleImages[0].clientId
    }));
  }

  function toggleWebsitePage(page: WebsitePageValue) {
    if (!draft.isWebsiteVisible) {
      return;
    }

    const selectedPages = new Set(selectedWebsitePages);

    if (selectedPages.has(page)) {
      selectedPages.delete(page);
    } else {
      selectedPages.add(page);
    }

    const nextWebsitePages = websitePageOptions
      .map((option) => option.value)
      .filter((value) => selectedPages.has(value));
    const nextSortOrders = {
      ...pageSortOrders,
      [page]: pageSortOrders[page] ?? "0"
    };

    onDraftChange({
      websitePages: nextWebsitePages,
      websitePageSortOrders: nextSortOrders
    });
  }

  function updatePageSortOrder(page: WebsitePageValue, value: string) {
    onDraftChange({
      websitePageSortOrders: {
        ...pageSortOrders,
        [page]: value
      }
    });
  }

  function updateImageFile(
    imageClientId: string,
    file: File | null,
    scope: "product" | "variant"
  ) {
    const updater = (images: ImageHolderDraft[]) =>
      images.map((image) => {
        if (image.clientId !== imageClientId) {
          return image;
        }

        if (image.previewUrl) {
          revokePreviewUrl(image.previewUrl);
        }

        if (!file) {
          return {
            ...image,
            file: undefined,
            fileName: undefined,
            previewUrl: undefined
          };
        }

        const previewUrl = createPreviewUrl(file);

        return {
          ...image,
          file,
          fileName: file.name,
          previewUrl,
          remove: false
        };
      });

    if (scope === "product") {
      setProductImages((current) => ensureProductPrimaryImage(updater(current)));
    } else {
      setVariantImages(updater);
    }
  }

  function removeImageHolder(
    event: ReactMouseEvent<HTMLButtonElement>,
    imageClientId: string,
    scope: "product" | "variant"
  ) {
    event.preventDefault();
    event.stopPropagation();

    const updater = (images: ImageHolderDraft[]) => {
      const nextImages = images.flatMap((image) => {
        if (image.clientId !== imageClientId) {
          return [image];
        }

        revokePreviewUrl(image.previewUrl);

        if (!image.id) {
          return [];
        }

        return [
          {
            ...image,
            file: undefined,
            fileName: undefined,
            previewUrl: undefined,
            remove: true,
            isPrimary: false
          }
        ];
      });

      if (scope === "product") {
        return ensureProductPrimaryImage(nextImages);
      }

      return nextImages;
    };

    if (scope === "product") {
      setProductImages(updater);
    } else {
      setVariantImages(updater);
    }
  }

  function addProductImageHolder() {
    setProductImages((current) => [
      ...current,
      {
        clientId: makeClientId("image"),
        colorVariantClientId: null,
        sortOrder: current.length,
        isPrimary: false
      }
    ]);
  }

  function addVariantImageHolder(variantClientId: string) {
    setVariantImages((current) => [
      ...current,
      {
        clientId: makeClientId("variant-image"),
        colorVariantClientId: variantClientId,
        sortOrder: current.filter((image) => image.colorVariantClientId === variantClientId).length,
        isPrimary: false
      }
    ]);
  }

  function setPrimaryImage(imageClientId: string) {
    setProductImages((current) =>
      current.map((image) => ({
        ...image,
        isPrimary: image.clientId === imageClientId
      }))
    );
  }

  function addColorVariant() {
    const clientId = makeClientId("variant");
    setColorVariants((current) => [
      ...current,
      {
        clientId,
        name: "",
        hex: "#111111",
        sortOrder: current.length,
        isActive: true
      }
    ]);
    addVariantImageHolder(clientId);
  }

  function updateColorVariant(clientId: string, patch: Partial<ColorVariantDraft>) {
    setColorVariants((current) =>
      current.map((variant) => (variant.clientId === clientId ? { ...variant, ...patch } : variant))
    );
  }

  function removeColorVariant(clientId: string) {
    setColorVariants((current) =>
      current.map((variant) =>
        variant.clientId === clientId ? { ...variant, remove: true } : variant
      )
    );
    setVariantImages((current) =>
      current.map((image) =>
        image.colorVariantClientId === clientId ? { ...image, remove: true } : image
      )
    );
  }

  async function handleImageInputChange(
    event: ChangeEvent<HTMLInputElement>,
    imageClientId: string,
    scope: "product" | "variant"
  ) {
    const file = event.target.files?.[0] ?? null;
    const inputElement = event.currentTarget;

    if (!file) {
      updateImageFile(imageClientId, null, scope);
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      inputElement.value = "";
      setImageUploadError({
        fileName: file.name,
        fileSizeMB: (file.size / 1024 / 1024).toFixed(1),
      });
      return;
    }

    const processedFile = await compressImageIfNeeded(file);

    if (processedFile !== file) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(processedFile);
      inputElement.files = dataTransfer.files;
    }

    updateImageFile(imageClientId, processedFile, scope);
  }

  function renderImageHolder(image: ImageHolderDraft, scope: "product" | "variant") {
    const inputId = `${image.clientId}-file`;
    const imageUrl = image.previewUrl || image.secureUrl || "";
    const hasImage = Boolean(imageUrl || image.file);

    return (
      <div
        key={image.clientId}
        className="relative flex min-h-[220px] flex-col gap-3 rounded-lg border border-border bg-background/70 p-3"
      >
        <button
          type="button"
          onClick={(event) => removeImageHolder(event, image.clientId, scope)}
          className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-panel/95 text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label="Remove image holder"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-border bg-muted/50">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={image.altText ?? draft.name ?? "Product image"}
              className="h-full w-full object-contain"
            />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={inputId}
            className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-soft-accent/70 px-3 text-sm font-semibold text-foreground transition hover:bg-soft-accent focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/30"
          >
            <ImagePlus className="h-4 w-4" />
            {hasImage ? "Replace photo" : "Add photo"}
          </label>
          {scope === "product" && hasImage ? (
            <button
              type="button"
              onClick={() => setPrimaryImage(image.clientId)}
              className={
                image.isPrimary
                  ? "min-h-9 rounded-md border border-primary/30 bg-primary px-3 text-sm font-semibold text-primary-foreground"
                  : "min-h-9 rounded-md border border-border bg-panel px-3 text-sm font-semibold text-foreground transition hover:bg-muted"
              }
            >
              {image.isPrimary ? "Primary" : "Set primary"}
            </button>
          ) : null}
        </div>
        <p className="min-h-5 truncate text-xs text-muted-foreground">
          {image.file
            ? `${image.fileName} (${(image.file.size / 1024 / 1024).toFixed(1)} MB)`
            : image.fileName || image.altText || image.secureUrl || "No image selected"}
        </p>
        <input
          id={inputId}
          name={`imageFile_${image.clientId}`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            void handleImageInputChange(event, image.clientId, scope);
          }}
        />
      </div>
    );
  }

  function toggleSection(section: ProductFormSectionKey) {
    setCollapsedSections((current) => ({
      ...current,
      [section]: !current[section]
    }));
  }

  function renderCollapsibleSection({
    section,
    title,
    helper,
    action,
    children
  }: {
    section: ProductFormSectionKey;
    title: string;
    helper?: string;
    action?: ReactNode;
    children: ReactNode;
  }) {
    const isCollapsed = collapsedSections[section];

    return (
      <section className="rounded-lg border border-border bg-panel/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            {helper ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {action}
            <Button
              type="button"
              variant="ghost"
              onClick={() => toggleSection(section)}
              className="h-9 w-9 p-0"
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${title}`}
              aria-expanded={!isCollapsed}
            >
              <ChevronDown
                className={
                  isCollapsed
                    ? "h-4 w-4 transition-transform"
                    : "h-4 w-4 rotate-180 transition-transform"
                }
              />
            </Button>
          </div>
        </div>
        {isCollapsed ? null : <div className="mt-4">{children}</div>}
      </section>
    );
  }

  return (
    <section>
      <div className="px-5 pb-3 pt-5">
        <p className="mt-1 text-sm text-muted-foreground">
          Keep the catalog details simple. Pricing can still be adjusted later in quotations.
        </p>
      </div>
      <form key={product?.id ?? "new"} action={action}>
        {isEdit && product ? <input type="hidden" name="productId" value={product.id} /> : null}
        <input type="hidden" name="imageManifest" value={JSON.stringify(imageManifest)} />
        <input type="hidden" name="colorVariantManifest" value={JSON.stringify(colorVariantManifest)} />
        {selectedTagIds.map((tagId) => (
          <input key={tagId} type="hidden" name="tagIds" value={tagId} />
        ))}

        <div className="space-y-4 px-5 pb-5 pt-2">
          {renderCollapsibleSection({
            section: "basic",
            title: "Basic details",
            children: (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1.1fr_0.7fr]">
                  <label className={fieldClassName}>
                    Name
                    <Input
                      name="name"
                      required
                      value={draft.name}
                      onChange={(event) => onDraftChange({ name: event.target.value })}
                      placeholder="Product name"
                    />
                  </label>
                  <label className={fieldClassName}>
                    Code
                    <Input
                      name="code"
                      value={draft.code}
                      onChange={(event) => onDraftChange({ code: event.target.value })}
                      placeholder="Optional code"
                    />
                    <span className="block text-xs font-normal leading-4 text-muted-foreground">
                      Optional. Use this only when a supplier or internal code helps.
                    </span>
                  </label>
                </div>

                <div className={canViewProductCost ? "grid gap-4 md:grid-cols-4" : "grid gap-4 md:grid-cols-3"}>
                  <label className={fieldClassName}>
                    Category
                    <Select
                      name="category"
                      value={normalizeProductCategory(draft.category)}
                      onChange={(event) => onDraftChange({ category: event.target.value })}
                    >
                      {productCategoryOptions.map((category) => (
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
                      value={draft.referencePrice}
                      onChange={(event) => onDraftChange({ referencePrice: event.target.value })}
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
                        value={draft.referenceCost}
                        onChange={(event) => onDraftChange({ referenceCost: event.target.value })}
                      />
                      <span className="block text-xs font-normal leading-4 text-muted-foreground">
                        Used as the default unit cost snapshot.
                      </span>
                    </label>
                  ) : null}
                  <label className={fieldClassName}>
                    Status
                    <Select
                      name="status"
                      value={draft.status}
                      onChange={(event) =>
                        onDraftChange({ status: event.target.value as ProductFormDraft["status"] })
                      }
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </Select>
                    <span className="block text-xs font-normal leading-4 text-muted-foreground">
                      Inactive products are hidden from normal quotation selection.
                    </span>
                  </label>
                </div>
              </div>
            )
          })}

          {renderCollapsibleSection({
            section: "catalogue",
            title: "Catalogue visibility",
            helper: "Controls whether and where this product appears on the public catalogue website.",
            children: (
              <>
                <input
                  type="hidden"
                  name="websitePagesMode"
                  value={draft.isWebsiteVisible ? "enabled" : "locked"}
                />
                {!draft.isWebsiteVisible
                  ? selectedWebsitePages.map((page) => (
                      <span key={page}>
                        <input type="hidden" name="websitePages" value={page} />
                        <input
                          type="hidden"
                          name={`websitePageSortOrder_${page}`}
                          value={pageSortOrders[page as WebsitePageValue] ?? "0"}
                        />
                      </span>
                    ))
                  : null}
                <div className="mt-4 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)] xl:items-start">
                  <fieldset className="flex flex-col gap-2 text-sm font-medium">
                    <legend>Website visible</legend>
                    <p className="text-xs font-normal leading-5 text-muted-foreground">
                      Publish this product on the catalogue.
                    </p>
                    <div className="inline-flex min-h-10 w-fit overflow-hidden rounded-lg border border-border bg-panel p-1">
                      {[
                        { label: "Yes", value: true },
                        { label: "No", value: false }
                      ].map((option) => (
                        <label
                          key={option.label}
                          className={
                            draft.isWebsiteVisible === option.value
                              ? "cursor-pointer rounded-md bg-soft-accent px-3 py-2 text-sm font-semibold text-foreground"
                              : "cursor-pointer rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                          }
                        >
                          <input
                            type="radio"
                            name="isWebsiteVisible"
                            value={option.value ? "on" : "off"}
                            checked={draft.isWebsiteVisible === option.value}
                            onChange={() => onDraftChange({ isWebsiteVisible: option.value })}
                            className="sr-only"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="xl:row-span-2">
                    <ProductTagManager
                      tags={tags}
                      selectedTagIds={selectedTagIds}
                      onSelectedTagIdsChange={(tagIds) => onDraftChange({ tagIds })}
                      canCreateTag={canCreateTag}
                      canUpdateTag={canUpdateTag}
                      canDeleteTag={canDeleteTag}
                    />
                  </div>

                  <fieldset className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                    <legend>Web pages visibility</legend>
                    <p className="text-xs font-normal leading-5 text-muted-foreground">
                      Choose where this product can appear on the public catalogue.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {websitePageOptions.map((page) => {
                        const isSelected = selectedWebsitePages.includes(page.value);
                        const isDisabled = !draft.isWebsiteVisible;

                        return (
                          <label
                            key={page.value}
                            className={
                              isDisabled
                                ? "inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-lg border border-border bg-muted/45 px-3 text-sm font-semibold text-muted-foreground opacity-70"
                                : isSelected
                                  ? "inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-primary/30 bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                                  : "inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-border bg-soft-accent/70 px-3 text-sm font-semibold text-foreground transition hover:bg-soft-accent"
                            }
                            aria-disabled={isDisabled}
                          >
                            <input
                              type="checkbox"
                              name="websitePages"
                              value={page.value}
                              checked={isSelected}
                              disabled={isDisabled}
                              onChange={() => toggleWebsitePage(page.value)}
                              className="sr-only"
                            />
                            {page.label}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>
                <input type="hidden" name="websiteSortOrder" value={draft.websiteSortOrder} />
                {selectedWebsitePages.length > 0 ? (
                  <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
                    {websitePageOptions
                      .filter((page) => selectedWebsitePageSet.has(page.value))
                      .map((page) => (
                        <label key={page.value} className="flex flex-col gap-2 text-sm font-medium">
                          {page.label} sort order
                          <Input
                            name={`websitePageSortOrder_${page.value}`}
                            type="number"
                            min="0"
                            step="1"
                            disabled={!draft.isWebsiteVisible}
                            value={pageSortOrders[page.value] ?? "0"}
                            onChange={(event) => updatePageSortOrder(page.value, event.target.value)}
                          />
                        </label>
                      ))}
                  </div>
                ) : null}
              </>
            )
          })}

          {renderCollapsibleSection({
            section: "description",
            title: "Description and specifications",
            children: (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Description
                  <Textarea
                    name="description"
                    value={draft.description}
                    onChange={(event) => onDraftChange({ description: event.target.value })}
                    className="h-32 resize-y"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Specifications
                  <Textarea
                    name="specifications"
                    value={draft.specifications}
                    onChange={(event) => onDraftChange({ specifications: event.target.value })}
                    className="h-32 resize-y"
                  />
                </label>
              </div>
            )
          })}

          {canUploadImage ? (
            renderCollapsibleSection({
              section: "images",
              title: "Product images",
              helper:
                "Add general product photos. The primary image is used for the product list and catalogue thumbnail.",
              action: (
                <Button type="button" variant="secondary" onClick={addProductImageHolder}>
                  <Plus className="h-4 w-4" />
                  Add image holder
                </Button>
              ),
              children: (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activeProductImages.map((image) => renderImageHolder(image, "product"))}
                </div>
              )
            })
          ) : null}

          {canUploadImage ? (
            renderCollapsibleSection({
              section: "variants",
              title: "Color variations",
              helper: "Optional colors can have their own image galleries.",
              action: (
                <Button type="button" variant="secondary" onClick={addColorVariant}>
                  <Plus className="h-4 w-4" />
                  Add color variation
                </Button>
              ),
              children: activeColorVariants.length ? (
                <div className="space-y-4">
                  {activeColorVariants.map((variant) => {
                    const images = activeVariantImages.filter(
                      (image) => image.colorVariantClientId === variant.clientId
                    );

                    return (
                      <section
                        key={variant.clientId}
                        className="rounded-lg border border-border bg-background/70 p-4"
                      >
                        <div className="grid gap-3 md:grid-cols-[1fr_160px_auto_auto] md:items-end">
                          <label className="flex flex-col gap-2 text-sm font-medium">
                            Color name
                            <Input
                              value={variant.name}
                              onChange={(event) =>
                                updateColorVariant(variant.clientId, { name: event.target.value })
                              }
                              placeholder="Red, Black, Walnut"
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm font-medium">
                            Color
                            <div className="flex items-center gap-2">
                              <Input
                                type="color"
                                value={variant.hex || "#111111"}
                                onChange={(event) =>
                                  updateColorVariant(variant.clientId, { hex: event.target.value })
                                }
                                className="h-10 w-14 p-1"
                              />
                              <Input
                                value={variant.hex}
                                onChange={(event) =>
                                  updateColorVariant(variant.clientId, { hex: event.target.value })
                                }
                                placeholder="#111111"
                              />
                            </div>
                          </label>
                          <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
                            <input
                              type="checkbox"
                              checked={variant.isActive}
                              onChange={(event) =>
                                updateColorVariant(variant.clientId, { isActive: event.target.checked })
                              }
                            />
                            Active
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeColorVariant(variant.clientId)}
                            className="text-danger hover:bg-danger/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-medium">Images</p>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => addVariantImageHolder(variant.clientId)}
                          >
                            <Plus className="h-4 w-4" />
                            Add image holder
                          </Button>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {images.map((image) => renderImageHolder(image, "variant"))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 rounded-md border border-dashed border-border bg-background/60 px-3 py-4 text-sm text-muted-foreground">
                  No color variations.
                </p>
              ),
            })
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

      {imageUploadError ? (
        <AdminModal
          onBackdropMouseDown={() => setImageUploadError(null)}
          labelledBy="image-upload-error-title"
          className="items-center justify-center px-4 py-6"
          panelClassName="flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-xl"
        >
          <div className="p-5">
            <h2 id="image-upload-error-title" className="text-base font-semibold">
              Image Too Large
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The selected image{" "}
              <span className="font-medium text-foreground">{imageUploadError.fileName}</span> (
              {imageUploadError.fileSizeMB} MB) exceeds the maximum upload size of 20 MB.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Please choose a smaller image and try again.
            </p>
          </div>
          <div className="flex justify-end border-t border-border px-5 py-4">
            <Button type="button" onClick={() => setImageUploadError(null)}>
              OK
            </Button>
          </div>
        </AdminModal>
      ) : null}
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
          <Button type="button" onClick={onCreate}>
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
          ? "mx-5 mb-5 mt-5 flex items-start gap-3 rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger"
          : "mx-5 mb-5 mt-5 flex items-start gap-3 rounded-md border border-success/20 bg-success/10 px-3 py-2 text-sm text-success"
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

function ProductFormModal({
  title,
  children,
  onClose
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const firstField = contentRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([type="file"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      firstField?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <AdminModal
      onBackdropMouseDown={onClose}
      labelledBy="product-form-modal-title"
      className="items-start justify-center bg-foreground/35 px-4 py-6 sm:py-10"
      panelClassName="flex max-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-xl sm:max-h-[calc(100vh-5rem)]"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-panel px-5 py-4">
        <div>
          <p className="studio-kicker">Furniture Catalog</p>
          <h2 id="product-form-modal-title" className="text-base font-semibold">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label="Close product form"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </AdminModal>
  );
}

function QuickStatusPill({
  product,
  canUpdate,
  pending,
  onChange
}: {
  product: ProductRow;
  canUpdate: boolean;
  pending: boolean;
  onChange: (product: ProductRow, nextStatus: ProductRow["status"]) => void;
}) {
  const nextStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  if (!canUpdate) {
    return <StatusPill tone={statusTone(product.status)}>{product.status}</StatusPill>;
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        onChange(product, nextStatus);
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className="inline-flex rounded-full transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label={`${product.status === "ACTIVE" ? "Deactivate" : "Activate"} ${product.name}`}
    >
      <StatusPill tone={statusTone(product.status)}>{pending ? "Saving..." : product.status}</StatusPill>
    </button>
  );
}

function QuickWebsitePill({
  product,
  canUpdate,
  pending,
  onToggle
}: {
  product: ProductRow;
  canUpdate: boolean;
  pending: boolean;
  onToggle: (product: ProductRow) => void;
}) {
  if (!canUpdate) {
    return (
      <StatusPill tone={product.isWebsiteVisible ? "success" : "neutral"}>
        {product.isWebsiteVisible ? "Visible" : "Hidden"}
      </StatusPill>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(product);
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className="inline-flex rounded-full transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label={`${product.isWebsiteVisible ? "Hide" : "Show"} ${product.name} on the website`}
    >
      <StatusPill tone={product.isWebsiteVisible ? "success" : "neutral"}>
        {pending ? "Saving..." : product.isWebsiteVisible ? "Visible" : "Hidden"}
      </StatusPill>
    </button>
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
        onClick={(event) => {
          event.stopPropagation();
          toggleMenu();
        }}
        onKeyDown={(event) => event.stopPropagation()}
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
          onClick={(event) => event.stopPropagation()}
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
  quickSaving,
  statusAction,
  deleteAction,
  deletePending,
  onEdit,
  onView,
  onStatusChange,
  onWebsiteToggle
}: {
  products: ProductRow[];
  canUpdate: boolean;
  canDelete: boolean;
  canViewProductCost: boolean;
  selectedProductId: string;
  quickSaving: QuickSavingState;
  statusAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  deletePending: boolean;
  onEdit: (product: ProductRow) => void;
  onView: (product: ProductRow) => void;
  onStatusChange: (product: ProductRow, nextStatus: ProductRow["status"]) => void;
  onWebsiteToggle: (product: ProductRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="studio-table w-full min-w-[1120px] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[76px]" />
          <col className={canViewProductCost ? "w-[22%]" : "w-[26%]"} />
          <col className="w-[12%]" />
          <col className="w-[124px]" />
          {canViewProductCost ? <col className="w-[124px]" /> : null}
          <col className="w-[104px]" />
          <col className="w-[120px]" />
          <col className="w-[180px]" />
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
            <th className="px-4 py-3 font-medium">Website</th>
            <th className="px-4 py-3 font-medium">Sort Order</th>
            <th className="px-4 py-3 font-medium">Updated</th>
            {canUpdate || canDelete ? <th className="px-4 py-3 text-right font-medium">Action</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {products.map((product) => {
            return (
              <tr
                key={product.id}
                role="button"
                tabIndex={0}
                onClick={() => onView(product)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onView(product);
                  }
                }}
                className={
                  selectedProductId === product.id
                    ? "cursor-pointer bg-soft-accent/35 transition hover:bg-soft-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    : "cursor-pointer transition hover:bg-soft-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                }
              >
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
                  <QuickStatusPill
                    product={product}
                    canUpdate={canUpdate}
                    pending={quickSaving.status === product.id}
                    onChange={onStatusChange}
                  />
                </td>
                <td className="px-4 py-4 align-middle">
                  <QuickWebsitePill
                    product={product}
                    canUpdate={canUpdate}
                    pending={quickSaving.website === product.id}
                    onToggle={onWebsiteToggle}
                  />
                </td>
                <td className="px-4 py-4 align-middle">
                  <p className="line-clamp-2 text-xs text-muted-foreground">{sortOrderSummary(product)}</p>
                </td>
                <td className="px-4 py-4 align-middle text-muted-foreground">{product.updatedAt}</td>
                {canUpdate || canDelete ? (
                  <td className="whitespace-nowrap px-4 py-4 text-right align-middle" onClick={(event) => event.stopPropagation()}>
                    <ProductRowActions
                      product={product}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      statusAction={statusAction}
                      statusPending={quickSaving.status === product.id}
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

function ProductViewModal({
  product,
  canUpdate,
  canDelete,
  canViewProductCost,
  statusPending,
  deletePending,
  onClose,
  onEdit,
  onStatusChange,
  onDelete
}: {
  product: ProductRow;
  canUpdate: boolean;
  canDelete: boolean;
  canViewProductCost: boolean;
  statusPending: boolean;
  deletePending: boolean;
  onClose: () => void;
  onEdit: (product: ProductRow) => void;
  onStatusChange: (product: ProductRow, nextStatus: ProductRow["status"]) => void;
  onDelete: (product: ProductRow) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const nextStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const statusActionLabel = product.status === "ACTIVE" ? "Deactivate" : "Activate";
  const detailRows = [
    ["Code", product.code ?? "No code"],
    ["Category", product.category ?? "Uncategorized"],
    ["Unit price", formatMoney(product.referencePrice, product.currency)],
    ...(canViewProductCost ? [["Product cost", formatMoney(product.referenceCost, product.currency)]] : []),
    ["Website", product.isWebsiteVisible ? "Visible" : "Hidden"],
    ["Website pages", websitePageSummary(product)],
    ["Sort order", sortOrderSummary(product)],
    ["Last updated", product.updatedAt]
  ];
  const generalImages = product.images.filter((image) => image.colorVariantId === null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <AdminModal
      onBackdropMouseDown={onClose}
      labelledBy="product-view-modal-title"
      className="items-center justify-center px-4 py-6"
      panelClassName="flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-xl sm:max-h-[calc(100vh-5rem)]"
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-panel px-5 py-4">
        <div>
          <p className="studio-kicker">View Product</p>
          <h2 id="product-view-modal-title" className="text-base font-semibold">
            {product.name}
          </h2>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label="Close product details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <div className="space-y-3">
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/55">
              {product.primaryImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.primaryImage.secureUrl}
                  alt={product.primaryImage.altText ?? product.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <PackageOpen className="h-8 w-8 text-muted-foreground/80" />
              )}
            </div>
            {generalImages.length > 1 ? (
              <div className="grid grid-cols-3 gap-2">
                {generalImages.map((image) => (
                  <div
                    key={image.id}
                    className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-border bg-muted/50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.secureUrl}
                      alt={image.altText ?? product.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={statusTone(product.status)}>{product.status}</StatusPill>
              <StatusPill tone={product.isWebsiteVisible ? "success" : "neutral"}>
                {product.isWebsiteVisible ? "Visible" : "Hidden"}
              </StatusPill>
              {product.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex min-h-7 max-w-full items-center rounded-full border border-border bg-soft-accent/70 px-2.5 text-xs font-medium text-muted-foreground"
                >
                  <span className="min-w-0 truncate">{tag.name}</span>
                </span>
              ))}
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {detailRows.map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border bg-background/70 p-3">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-border bg-background/70 p-4">
            <h3 className="text-sm font-semibold">Description</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {product.description || "No description."}
            </p>
          </section>
          <section className="rounded-lg border border-border bg-background/70 p-4">
            <h3 className="text-sm font-semibold">Specifications</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {product.specifications || "No specifications."}
            </p>
          </section>
        </div>
        {product.colorVariants.length ? (
          <section className="mt-5 rounded-lg border border-border bg-background/70 p-4">
            <h3 className="text-sm font-semibold">Color variations</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {product.colorVariants.map((variant) => {
                const images = product.images.filter((image) => image.colorVariantId === variant.id);

                return (
                  <div key={variant.id} className="flex min-w-0 flex-col rounded-lg border border-border bg-panel/70 p-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-5 w-5 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: variant.hex ?? "#f3f4f6" }}
                        aria-hidden="true"
                      />
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">{variant.name}</p>
                      <StatusPill tone={variant.isActive ? "success" : "neutral"}>
                        {variant.isActive ? "Active" : "Inactive"}
                      </StatusPill>
                    </div>
                    {images.length ? (
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {images.map((image) => (
                          <div
                            key={image.id}
                            className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-border bg-muted/50"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={image.secureUrl}
                              alt={image.altText ?? `${product.name} ${variant.name}`}
                              className="h-full w-full object-contain"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 flex aspect-[4/1] min-h-14 items-center justify-center rounded-md border border-dashed border-border bg-muted/35">
                        <ImagePlus className="h-5 w-5 text-muted-foreground/80" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border bg-panel/70 px-5 py-4">
        {canUpdate ? (
          <Button type="button" onClick={() => onEdit(product)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : null}
        {canUpdate ? (
          <Button
            type="button"
            variant="secondary"
            disabled={statusPending}
            onClick={() => onStatusChange(product, nextStatus)}
          >
            {product.status === "ACTIVE" ? <Ban className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
            {statusPending ? "Saving..." : statusActionLabel}
          </Button>
        ) : null}
        {canDelete ? (
          <Button
            type="button"
            variant="ghost"
            disabled={deletePending}
            onClick={() => onDelete(product)}
            className="text-danger hover:bg-danger/10"
          >
            <Trash2 className="h-4 w-4" />
            {deletePending ? "Deleting..." : "Delete"}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onClose} className="ml-auto">
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>
    </AdminModal>
  );
}

export function ProductWorkspace({
  products,
  tags,
  canCreate,
  canUpdate,
  canDelete,
  canViewProductCost,
  hasActiveFilters,
  persistenceUserKey
}: ProductWorkspaceProps) {
  const router = useRouter();
  const initialWorkspaceDraft: ProductWorkspaceDraft = {
    selectedProductId: "",
    showCreateForm: false,
    createDraft: blankProductDraft,
    editDrafts: {}
  };
  const [workspaceDraft, setWorkspaceDraft, workspacePersistence] =
    usePersistentPageState<ProductWorkspaceDraft>({
      scope: "products",
      userKey: persistenceUserKey,
      version: 4,
      initialState: initialWorkspaceDraft
    });
  const hasAppliedWorkspaceDraft = useRef(false);
  const [createState, createAction, createPending] = useActionState(createProductAction, initialState);
  const [updateState, updateAction, updatePending] = useActionState(updateProductAction, initialState);
  const [statusState, statusAction, statusPending] = useActionState(updateProductStatusAction, initialState);
  const [websiteState, websiteAction] = useActionState(
    updateProductWebsiteVisibilityAction,
    initialState
  );
  const [deleteState, deleteAction, deletePending] = useActionState(deleteProductAction, initialState);
  const [, startQuickTransition] = useTransition();
  const [quickSaving, setQuickSaving] = useState<QuickSavingState>({});
  const [selectedProductId, setSelectedProductId] = useState("");
  const [viewedProductId, setViewedProductId] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");

  useEffect(() => {
    if (!workspacePersistence.restored || hasAppliedWorkspaceDraft.current) {
      return;
    }

    hasAppliedWorkspaceDraft.current = true;
    setShowCreateForm(Boolean(workspaceDraft.showCreateForm));
    setSelectedProductId(
      workspaceDraft.selectedProductId &&
        products.some((product) => product.id === workspaceDraft.selectedProductId)
        ? workspaceDraft.selectedProductId
        : ""
    );
  }, [
    products,
    workspaceDraft.selectedProductId,
    workspaceDraft.showCreateForm,
    workspacePersistence.restored
  ]);

  useEffect(() => {
    if (!workspacePersistence.restored || !hasAppliedWorkspaceDraft.current) {
      return;
    }

    setWorkspaceDraft((current) => ({
      ...current,
      selectedProductId,
      showCreateForm
    }));
  }, [
    selectedProductId,
    setWorkspaceDraft,
    showCreateForm,
    workspacePersistence.restored
  ]);

  useEffect(() => {
    setSelectedProductId((current) =>
      current && products.some((product) => product.id === current) ? current : ""
    );
    setViewedProductId((current) =>
      current && products.some((product) => product.id === current) ? current : ""
    );
  }, [products]);

  useEffect(() => {
    if (createState.ok && createState.message) {
      setNotice(createState.message);
      setNoticeTone("success");
      setShowCreateForm(false);
      setSelectedProductId("");
      router.refresh();
      setWorkspaceDraft((current) => ({
        ...current,
        showCreateForm: false,
        selectedProductId: "",
        createDraft: blankProductDraft
      }));
    }
  }, [createState.ok, createState.message, router, setWorkspaceDraft]);

  useEffect(() => {
    if (updateState.ok && updateState.message) {
      setNotice(updateState.message);
      setNoticeTone("success");
      setShowCreateForm(false);
      setSelectedProductId("");
      router.refresh();
      setWorkspaceDraft((current) => ({
        ...current,
        showCreateForm: false,
        selectedProductId: "",
        editDrafts: {}
      }));
    }
  }, [router, setWorkspaceDraft, updateState.ok, updateState.message]);

  useEffect(() => {
    if (statusState.message) {
      setNotice(statusState.message);
      setNoticeTone(statusState.ok ? "success" : "danger");
      setQuickSaving((current) => ({
        ...current,
        status: undefined
      }));
      router.refresh();
      setShowCreateForm(false);
    }
  }, [router, statusState]);

  useEffect(() => {
    if (websiteState.message) {
      setNotice(websiteState.message);
      setNoticeTone(websiteState.ok ? "success" : "danger");
      setQuickSaving((current) => ({
        ...current,
        website: undefined
      }));
      router.refresh();
      setShowCreateForm(false);
    }
  }, [router, websiteState]);

  useEffect(() => {
    if (deleteState.message) {
      setNotice(deleteState.message);
      setNoticeTone(deleteState.ok ? "success" : "danger");
      setSelectedProductId("");
      if (deleteState.ok) {
        setViewedProductId("");
      }
      router.refresh();
      setShowCreateForm(false);
    }
  }, [deleteState.message, deleteState.ok, router]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );
  const viewedProduct = useMemo(
    () => products.find((product) => product.id === viewedProductId) ?? null,
    [products, viewedProductId]
  );

  function openCreateForm() {
    setNotice("");
    setSelectedProductId("");
    setViewedProductId("");
    setShowCreateForm(true);
    setWorkspaceDraft((current) => ({
      ...current,
      selectedProductId: "",
      showCreateForm: true,
      createDraft: blankProductDraft
    }));
  }

  function openEditForm(product: ProductRow) {
    setNotice("");
    setViewedProductId("");
    setShowCreateForm(false);
    setSelectedProductId(product.id);
    setWorkspaceDraft((current) => ({
      ...current,
      showCreateForm: false,
      selectedProductId: product.id,
      editDrafts: {
        ...current.editDrafts,
        [product.id]: current.editDrafts[product.id] ?? productToDraft(product)
      }
    }));
  }

  function closeForm() {
    const closedProductId = selectedProductId;
    setShowCreateForm(false);
    setSelectedProductId("");
    setWorkspaceDraft((current) => {
      const nextEditDrafts = { ...current.editDrafts };

      if (closedProductId) {
        delete nextEditDrafts[closedProductId];
      }

      return {
        ...current,
        selectedProductId: "",
        showCreateForm: false,
        createDraft: blankProductDraft,
        editDrafts: nextEditDrafts
      };
    });
  }

  function openViewModal(product: ProductRow) {
    setNotice("");
    setShowCreateForm(false);
    setSelectedProductId("");
    setViewedProductId(product.id);
  }

  function closeViewModal() {
    setViewedProductId("");
  }

  function submitStatusUpdate(product: ProductRow, nextStatus: ProductRow["status"]) {
    if (
      nextStatus === "INACTIVE" &&
      !window.confirm(`Deactivate ${product.name}? It will be hidden from normal quotation selection.`)
    ) {
      return;
    }

    const formData = new FormData();
    formData.set("productId", product.id);
    formData.set("status", nextStatus);
    setQuickSaving((current) => ({
      ...current,
      status: product.id
    }));
    startQuickTransition(() => {
      statusAction(formData);
    });
  }

  function toggleWebsiteVisibility(product: ProductRow) {
    const formData = new FormData();
    formData.set("productId", product.id);
    formData.set("isWebsiteVisible", product.isWebsiteVisible ? "off" : "on");
    setQuickSaving((current) => ({
      ...current,
      website: product.id
    }));
    startQuickTransition(() => {
      websiteAction(formData);
    });
  }

  function submitDelete(product: ProductRow) {
    if (
      !window.confirm(
        `Delete ${product.name}? Only unused products can be deleted. Products already used in quotations or orders should be deactivated instead.`
      )
    ) {
      return;
    }

    const formData = new FormData();
    formData.set("productId", product.id);
    startQuickTransition(() => {
      deleteAction(formData);
    });
  }

  function updateCreateDraft(patch: Partial<ProductFormDraft>) {
    setWorkspaceDraft((current) => ({
      ...current,
      createDraft: {
        ...current.createDraft,
        ...patch
      }
    }));
  }

  function updateEditDraft(productId: string, patch: Partial<ProductFormDraft>) {
    const fallbackProduct = products.find((product) => product.id === productId);

    setWorkspaceDraft((current) => ({
      ...current,
      editDrafts: {
        ...current.editDrafts,
        [productId]: {
          ...(current.editDrafts[productId] ??
            (fallbackProduct ? productToDraft(fallbackProduct) : blankProductDraft)),
          ...patch
        }
      }
    }));
  }

  const createDraft = {
    ...blankProductDraft,
    ...(workspaceDraft.createDraft ?? {})
  };
  const selectedProductDraft = selectedProduct
    ? {
        ...productToDraft(selectedProduct),
        ...(workspaceDraft.editDrafts[selectedProduct.id] ?? {})
      }
    : blankProductDraft;
  const selectedProductInitialDraft = selectedProduct ? productToDraft(selectedProduct) : blankProductDraft;
  const createHasUnsavedChanges = !productDraftsMatch(createDraft, blankProductDraft);
  const selectedProductHasUnsavedChanges =
    selectedProduct !== null && !productDraftsMatch(selectedProductDraft, selectedProductInitialDraft);

  function requestCloseForm(hasUnsavedChanges: boolean) {
    if (
      hasUnsavedChanges &&
      !window.confirm("You have unsaved changes. Are you sure you want to leave?")
    ) {
      return;
    }

    closeForm();
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
            <Button type="button" onClick={openCreateForm}>
              <Plus className="h-4 w-4" />
              New product
            </Button>
          ) : null}
        </div>

        {notice ? (
          <ProductNotice message={notice} tone={noticeTone} onDismiss={() => setNotice("")} />
        ) : null}

        {products.length ? (
          <ProductTable
            products={products}
            canUpdate={canUpdate}
            canDelete={canDelete}
            canViewProductCost={canViewProductCost}
            selectedProductId={selectedProductId}
            quickSaving={quickSaving}
            statusAction={statusAction}
            deleteAction={deleteAction}
            deletePending={deletePending}
            onEdit={openEditForm}
            onView={openViewModal}
            onStatusChange={submitStatusUpdate}
            onWebsiteToggle={toggleWebsiteVisibility}
          />
        ) : (
          <ProductEmptyState
            canCreate={canCreate}
            hasActiveFilters={hasActiveFilters}
            onCreate={openCreateForm}
          />
        )}
      </section>

      {viewedProduct ? (
        <ProductViewModal
          product={viewedProduct}
          canUpdate={canUpdate}
          canDelete={canDelete}
          canViewProductCost={canViewProductCost}
          statusPending={quickSaving.status === viewedProduct.id || statusPending}
          deletePending={deletePending}
          onClose={closeViewModal}
          onEdit={openEditForm}
          onStatusChange={submitStatusUpdate}
          onDelete={submitDelete}
        />
      ) : null}

      {canCreate && showCreateForm ? (
        <ProductFormModal title="New product" onClose={() => requestCloseForm(createHasUnsavedChanges)}>
          <ProductForm
            mode="create"
            draft={createDraft}
            onDraftChange={updateCreateDraft}
            state={createState}
            pending={createPending}
            action={createAction}
            onCancel={() => requestCloseForm(createHasUnsavedChanges)}
            canUploadImage={canUpdate}
            canViewProductCost={canViewProductCost}
            tags={tags}
            canCreateTag={canCreate || canUpdate}
            canUpdateTag={canUpdate}
            canDeleteTag={canDelete}
          />
        </ProductFormModal>
      ) : null}

      {canUpdate && selectedProduct ? (
        <ProductFormModal
          title="Edit product"
          onClose={() => requestCloseForm(selectedProductHasUnsavedChanges)}
        >
          <ProductForm
            mode="edit"
            product={selectedProduct}
            draft={selectedProductDraft}
            onDraftChange={(patch) => updateEditDraft(selectedProduct.id, patch)}
            state={updateState}
            pending={updatePending}
            action={updateAction}
            onCancel={() => requestCloseForm(selectedProductHasUnsavedChanges)}
            canUploadImage={canUpdate}
            canViewProductCost={canViewProductCost}
            tags={tags}
            canCreateTag={canCreate || canUpdate}
            canUpdateTag={canUpdate}
            canDeleteTag={canDelete}
          />
        </ProductFormModal>
      ) : null}
    </div>
  );
}
