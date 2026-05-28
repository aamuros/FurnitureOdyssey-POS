"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ImagePlus, RotateCcw, Save, X } from "lucide-react";
import { updatePageContentAction } from "@/app/actions/catalogue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type CatalogueContentRow = {
  id: string;
  page: string;
  section: string;
  fieldKey: string;
  fieldValue: string;
  updatedAt: string;
};

type CatalogueContentWorkspaceProps = {
  rows: CatalogueContentRow[];
  canUpdate: boolean;
  canUpload: boolean;
  canReset: boolean;
};

type CataloguePageKey = "home" | "chairs" | "tables" | "collections";

const initialState = {
  ok: false,
  message: "",
  id: undefined as string | undefined,
  fieldValue: undefined as string | undefined
};

const cataloguePages: Array<{
  id: CataloguePageKey;
  label: string;
  sections: string[];
}> = [
  {
    id: "home",
    label: "Home",
    sections: ["hero", "curators_pick", "honest_materials", "featured_story"]
  },
  {
    id: "chairs",
    label: "Chairs",
    sections: ["hero"]
  },
  {
    id: "tables",
    label: "Tables",
    sections: ["hero", "catalog"]
  },
  {
    id: "collections",
    label: "Collections",
    sections: ["hero"]
  }
];

const fieldOrder = [
  "eyebrow",
  "title",
  "italic",
  "description",
  "description2",
  "btn1_label",
  "btn2_label",
  "btn_label",
  "image",
  "image1",
  "image2",
  "quote"
];

const sectionLabels: Record<string, string> = {
  hero: "Hero",
  curators_pick: "Curator's Pick",
  honest_materials: "Honest Materials",
  featured_story: "Featured Story",
  catalog: "Catalog"
};

const fieldLabels: Record<string, string> = {
  eyebrow: "Eyebrow",
  title: "Title",
  italic: "Italic Text",
  description: "Description",
  description2: "Secondary Description",
  btn1_label: "Button 1 Label",
  btn2_label: "Button 2 Label",
  btn_label: "Button Label",
  image: "Image Path / URL",
  image1: "Image 1 Path / URL",
  image2: "Image 2 Path / URL",
  quote: "Quote"
};

export function CatalogueContentWorkspace({
  rows,
  canUpdate,
  canUpload,
  canReset
}: CatalogueContentWorkspaceProps) {
  const [activePage, setActivePage] = useState<CataloguePageKey>("home");
  const groupedRows = useMemo(() => groupRows(rows), [rows]);
  const activePageConfig = cataloguePages.find((page) => page.id === activePage) ?? cataloguePages[0];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-soft-accent/45 px-4 py-3 text-sm leading-6 text-muted-foreground">
        These values are used by the public catalogue website through the <code>page_content</code> table and
        public catalogue views.
      </div>

      <nav
        className="flex flex-wrap gap-2 rounded-lg border border-border bg-panel p-2"
        aria-label="Catalogue pages"
        role="tablist"
      >
        {cataloguePages.map((page) => {
          const isActive = activePage === page.id;

          return (
            <button
              key={page.id}
              type="button"
              onClick={() => setActivePage(page.id)}
              className={cn(
                "min-h-10 flex-1 rounded-md border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-w-32",
                isActive
                  ? "border-border bg-soft-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted/55 hover:text-foreground"
              )}
              role="tab"
              aria-selected={isActive}
            >
              {page.label}
            </button>
          );
        })}
      </nav>

      {!canUpdate ? (
        <div className="rounded-md border border-border bg-panel px-4 py-3 text-sm text-muted-foreground">
          You can view catalogue content, but you do not have permission to update it.
        </div>
      ) : null}

      <section className="studio-card">
        <div className="studio-card-header">
          <p className="studio-kicker">{activePageConfig.label}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-normal">Page Content</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit catalogue copy and static image URLs used by the public catalogue.
          </p>
        </div>
        <div className="grid gap-4 p-4">
          {activePageConfig.sections.map((section) => {
            const sectionRows = groupedRows[activePageConfig.id]?.[section] ?? [];

            return (
              <CatalogueSection
                key={section}
                title={sectionLabel(section)}
                rows={sectionRows}
                canUpdate={canUpdate}
                canUpload={canUpload}
                canReset={canReset}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function CatalogueSection({
  title,
  rows,
  canUpdate,
  canUpload,
  canReset
}: {
  title: string;
  rows: CatalogueContentRow[];
  canUpdate: boolean;
  canUpload: boolean;
  canReset: boolean;
}) {
  return (
    <div className="studio-subpanel overflow-hidden">
      <div className="border-b border-border bg-soft-accent/25 px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {rows.length} {rows.length === 1 ? "field" : "fields"}
        </p>
      </div>
      <div className="grid gap-3 p-4">
        {rows.length ? (
          rows.map((row) => (
            <CatalogueFieldForm
              key={row.id}
              row={row}
              canUpdate={canUpdate}
              canUpload={canUpload}
              canReset={canReset}
            />
          ))
        ) : (
          <div className="studio-empty p-4 text-sm">No seeded content rows exist for this section yet.</div>
        )}
      </div>
    </div>
  );
}

function CatalogueFieldForm({
  row,
  canUpdate,
  canUpload,
  canReset
}: {
  row: CatalogueContentRow;
  canUpdate: boolean;
  canUpload: boolean;
  canReset: boolean;
}) {
  const [state, action, pending] = useActionState(updatePageContentAction, initialState);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [savedValue, setSavedValue] = useState(row.fieldValue);
  const [draftValue, setDraftValue] = useState(row.fieldValue);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState("");
  const isImage = isImageField(row.fieldKey);
  const imagePreviewUrl = selectedPreviewUrl || draftValue.trim();
  const hasSelectedFile = Boolean(selectedPreviewUrl);
  const isDirty = draftValue !== savedValue || hasSelectedFile;
  const canSubmit = hasSelectedFile ? canUpload : canUpdate;
  const useTextarea = isLongField(row);

  useEffect(() => {
    setSavedValue(row.fieldValue);
    setDraftValue(row.fieldValue);
    clearSelectedImage();
  }, [row.id, row.fieldValue]);

  useEffect(() => {
    if (state.ok && state.id === row.id && state.fieldValue !== undefined) {
      setSavedValue(state.fieldValue);
      setDraftValue(state.fieldValue);
      clearSelectedImage();
    }
  }, [row.id, state.fieldValue, state.id, state.ok]);

  useEffect(() => {
    if (!canUpdate) {
      setDraftValue(row.fieldValue);
    }

    if (!canUpload) {
      clearSelectedImage();
    }
  }, [canUpdate, canUpload, row.fieldValue]);

  useEffect(() => {
    return () => {
      if (selectedPreviewUrl) {
        URL.revokeObjectURL(selectedPreviewUrl);
      }
    };
  }, [selectedPreviewUrl]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (selectedPreviewUrl) {
      URL.revokeObjectURL(selectedPreviewUrl);
    }

    if (!file) {
      setSelectedFileName("");
      setSelectedPreviewUrl("");
      return;
    }

    setSelectedFileName(file.name);
    setSelectedPreviewUrl(URL.createObjectURL(file));
  }

  function clearSelectedImage() {
    setSelectedFileName("");

    setSelectedPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return "";
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resetDraft() {
    setDraftValue(savedValue);
    clearSelectedImage();
  }

  return (
    <form action={action} className="rounded-lg border border-border bg-panel/70 p-3">
      <input type="hidden" name="id" value={row.id} />
      <div className="grid gap-3 lg:grid-cols-[minmax(180px,0.34fr)_minmax(260px,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <label htmlFor={`field-${row.id}`} className="text-sm font-semibold">
            {fieldLabel(row.fieldKey)}
          </label>
          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
            {row.page} / {row.section} / {row.fieldKey}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Last updated {formatDate(row.updatedAt)}</p>
        </div>

        {isImage ? (
          <div className="grid gap-3">
            <div className="overflow-hidden rounded-lg border border-border bg-background">
              {imagePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreviewUrl}
                  alt={`${fieldLabel(row.fieldKey)} preview`}
                  className="h-48 w-full object-contain"
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-muted-foreground">
                  <ImagePlus className="h-7 w-7" />
                </div>
              )}
            </div>
            <Input
              id={`field-${row.id}`}
              name="fieldValue"
              value={draftValue}
              onChange={(event) => setDraftValue(event.target.value)}
              disabled={!canUpdate || pending}
              placeholder="/images/example.png or https://..."
            />
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor={`image-file-${row.id}`}
                className={cn(
                  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-soft-accent/70 px-4 text-sm font-semibold text-foreground transition duration-150 hover:bg-soft-accent focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/30",
                  (!canUpload || pending) && "pointer-events-none cursor-not-allowed opacity-60"
                )}
              >
                <ImagePlus className="h-4 w-4" />
                {savedValue ? "Replace image" : "Choose image"}
              </label>
              {selectedFileName ? (
                <span className="min-w-0 truncate text-sm text-muted-foreground">{selectedFileName}</span>
              ) : (
                <span className="text-sm text-muted-foreground">Current: {savedValue || "No image set"}</span>
              )}
              {hasSelectedFile ? (
                <Button type="button" variant="ghost" onClick={clearSelectedImage} disabled={pending}>
                  <X className="h-4 w-4" />
                  Remove selected
                </Button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              id={`image-file-${row.id}`}
              name="imageFile"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleImageChange}
              disabled={!canUpload || pending}
            />
          </div>
        ) : useTextarea ? (
          <Textarea
            id={`field-${row.id}`}
            name="fieldValue"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            disabled={!canUpdate || pending}
            rows={4}
          />
        ) : (
          <Input
            id={`field-${row.id}`}
            name="fieldValue"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            disabled={!canUpdate || pending}
          />
        )}

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button type="submit" disabled={!canSubmit || pending || !isDirty}>
            <Save className="h-4 w-4" />
            {pending ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={resetDraft}
            disabled={!canReset || pending || !isDirty}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {state.message ? (
        <p
          className={cn(
            "mt-3 rounded-md px-3 py-2 text-sm",
            state.ok
              ? "border border-success/25 bg-success/10 text-success"
              : "border border-danger/25 bg-danger/10 text-danger"
          )}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function groupRows(rows: CatalogueContentRow[]) {
  const grouped: Record<string, Record<string, CatalogueContentRow[]>> = {};

  for (const row of rows) {
    grouped[row.page] ??= {};
    grouped[row.page][row.section] ??= [];
    grouped[row.page][row.section].push(row);
  }

  for (const sections of Object.values(grouped)) {
    for (const sectionRows of Object.values(sections)) {
      sectionRows.sort((left, right) => fieldSortIndex(left.fieldKey) - fieldSortIndex(right.fieldKey));
    }
  }

  return grouped;
}

function fieldSortIndex(fieldKey: string) {
  const index = fieldOrder.indexOf(fieldKey);
  return index === -1 ? fieldOrder.length : index;
}

function fieldLabel(fieldKey: string) {
  return fieldLabels[fieldKey] ?? humanize(fieldKey);
}

function sectionLabel(section: string) {
  return sectionLabels[section] ?? humanize(section);
}

function humanize(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function isLongField(row: CatalogueContentRow) {
  return row.fieldKey.startsWith("description") || row.fieldValue.length > 120;
}

function isImageField(fieldKey: string) {
  return fieldKey === "image" || fieldKey.startsWith("image");
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
