# Plan: Increase Next.js Server Action Body Size Limit & Client-Side Image Validation/Compression

## Context

Product image uploads crash because of **two separate limits operating at different layers**:

### The crash: Next.js Server Action body size limit (1 MB — the actual problem)

- **Default: 1 MB** — enforced by Next.js at the framework level, **before server action code runs**
- When the total `FormData` payload (all form fields + image file binary) exceeds 1 MB, Next.js rejects the HTTP request with a 413 or throws a runtime exception
- The server action (`createProductAction`, etc.) **never executes** — the crash happens at the framework level
- The existing `try/catch` blocks inside the server actions cannot catch this because the action never starts
- **This is why a 1.5 MB image crashes the page** even though the upload policy allows 5 MB

### The upload policy: application-level validation (5 MB — never reached for 1–5 MB files)

- `UPLOAD_MAX_IMAGE_BYTES = 5 * 1024 * 1024` in `lib/uploads/policy.ts:8`
- Runs **inside** `uploadFileToCloudinary` → `validateUpload()` — server-side code
- A 2 MB image would pass this check, but it never gets the chance because the 1 MB body limit already rejected the request

### What the user wants

1. Raise the Server Action body limit from 1 MB → 20 MB (fixes the crash)
2. Raise the upload policy from 5 MB → 20 MB (allows the now-receivable files to pass server validation)
3. Client-side validation with friendly error messages for files > 20 MB
4. Auto-compression of large images using `browser-image-compression`
5. Graceful server-side error handling (already partially in place)
6. No changes to existing workflows, Cloudinary integration, DB schema, or API routes

## Current Architecture (key files)

| File | Role |
|---|---|
| `next.config.ts` | Next.js config; currently no `serverActions` body size config |
| `lib/uploads/policy.ts` | `UPLOAD_MAX_IMAGE_BYTES = 5 * 1024 * 1024` (5 MB) — used by all image upload categories |
| `lib/uploads/server.ts` | Server-side `uploadFileToCloudinary` — validates against policy, uploads to Cloudinary |
| `lib/uploads/validation.ts` | `validateUpload()` — checks mime type, extension, size against policy |
| `app/actions/products.ts` | Server actions: `createProductAction`, `updateProductAction`, `uploadProductImageAction` — all have try-catch that return `{ ok: false, message }` on error |
| `components/dashboard/product-workspace.tsx` | Client component with `ProductForm` — handles file input change via `handleImageInputChange` → `updateImageFile`; no current file-size validation; no toast library (uses inline `ProductNotice`) |

## Decisions

- **Upload policy limit**: Increase `UPLOAD_MAX_IMAGE_BYTES` from 5 MB to 20 MB. This aligns the server-side validation with the new Next.js body limit. Other upload categories that use `UPLOAD_MAX_PDF_BYTES` (10 MB) are unaffected.
- **Compression threshold**: Compress images client-side if > 10 MB. Files ≤ 10 MB upload as-is (no silent quality alteration). Files between 10–20 MB get compressed to ~4 MB automatically.
- **Hard rejection threshold**: 20 MB. Files > 20 MB are rejected before compression with a friendly modal — they cannot fit within the body limit even after compression.
- **UI pattern**: Use the existing `AdminModal` component for the "Image Too Large" dialog (matches existing UI style). No new toast library needed.
- **No existing toast/sonner**: The codebase uses `ProductNotice` (inline alert banner) for success/error messages. We will use `AdminModal` for the blocking file-too-large dialog since it needs user acknowledgement before proceeding.

## Implementation Steps

### Step 1 — Install `browser-image-compression`

```
npm install browser-image-compression
```

Add to `dependencies` in `package.json`.

### Step 2 — Update `next.config.ts`

Add top-level `serverActions` config with `bodySizeLimit: '20mb'`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverActions: {
    bodySizeLimit: "20mb",
  },
};

export default nextConfig;
```

Next.js 15.3.4 supports this at the top level (not under `experimental`).

### Step 3 — Update upload policy (`lib/uploads/policy.ts`)

Change `UPLOAD_MAX_IMAGE_BYTES` from `5 * 1024 * 1024` to `20 * 1024 * 1024`.

```ts
export const UPLOAD_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
```

This affects: `product-image`, `quotation-item-image`, `order-item-image`, `catalogue-static-image`. These are all internal image uploads where staff may upload smartphone photos.

### Step 4 — Create client-side compression utility (`lib/uploads/client-compression.ts`)

New file — `"use client"` directive. Uses `browser-image-compression` to:

- Accept a `File` — skip compression if ≤ 10 MB
- Compress using `browser-image-compression` with `maxSizeMB: 4`, `maxWidthOrHeight: 2400`, `useWebWorker: true`
- Return the compressed `File` (or original if already small enough or compression fails)

```ts
"use client";

import imageCompression from "browser-image-compression";

const COMPRESSION_THRESHOLD_BYTES = 10 * 1024 * 1024;
const TARGET_SIZE_MB = 4;
const MAX_DIMENSION = 2400;

export async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.size <= COMPRESSION_THRESHOLD_BYTES) {
    return file;
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: TARGET_SIZE_MB,
      maxWidthOrHeight: MAX_DIMENSION,
      useWebWorker: true,
      initialQuality: 0.8,
    });

    const compressedFile = new File([compressed], file.name, {
      type: compressed.type || file.type,
      lastModified: Date.now(),
    });

    return compressedFile.size < file.size ? compressedFile : file;
  } catch {
    return file;
  }
}
```

### Step 5 — Update `components/dashboard/product-workspace.tsx`

#### 5a — Add upload size limit constant

At module level:

```ts
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
```

#### 5b — Add image upload error state

In `ProductForm`, add state for the upload error modal:

```ts
const [imageUploadError, setImageUploadError] = useState<{ fileName: string; fileSizeMB: string } | null>(null);
```

#### 5c — Modify `handleImageInputChange` to validate and compress

Replace the current simple file assignment with an async flow:

1. Read the selected file
2. **Hard reject** if file > 20 MB — show error modal, do not accept the file
3. If ≤ 20 MB, attempt compression via `compressImageIfNeeded` (only triggers for files > 10 MB)
4. Use the (possibly compressed) file for the image holder

```ts
async function handleImageInputChange(
  event: ChangeEvent<HTMLInputElement>,
  imageClientId: string,
  scope: "product" | "variant"
) {
  const file = event.target.files?.[0] ?? null;
  event.target.value = "";

  if (!file) {
    updateImageFile(imageClientId, null, scope);
    return;
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    setImageUploadError({
      fileName: file.name,
      fileSizeMB: (file.size / 1024 / 1024).toFixed(1),
    });
    return;
  }

  const processedFile = await compressImageIfNeeded(file);
  updateImageFile(imageClientId, processedFile, scope);
}
```

Note: `event.target.value = ""` resets the input so the same file can be re-selected.

#### 5d — Update the `<input type="file">` onChange handler

The `onChange` in `renderImageInputChange` currently calls `handleImageInputChange` synchronously. Since it's now async, wrap it:

```ts
onChange={(event) => {
  void handleImageInputChange(event, image.clientId, scope);
}}
```

#### 5e — Add the "Image Too Large" error modal

Render the modal conditionally when `imageUploadError` is non-null. Use the existing `AdminModal` pattern:

```tsx
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
        The selected image <span className="font-medium text-foreground">{imageUploadError.fileName}</span> ({imageUploadError.fileSizeMB} MB) exceeds the maximum upload size of 20 MB.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Please choose a smaller image and try again.
      </p>
    </div>
    <div className="flex justify-end border-t border-border px-5 py-4">
      <Button
        type="button"
        onClick={() => setImageUploadError(null)}
      >
        OK
      </Button>
    </div>
  </AdminModal>
) : null}
```

This modal must be rendered inside `ProductForm` (or wherever the imageUploadError state lives).

#### 5f — Show compression feedback (optional, minimal)

After compression, the image file name line already shows `image.fileName`. We can enhance it slightly to show the compressed file size. Update `renderImageHolder` to show file size:

```ts
<p className="min-h-5 truncate text-xs text-muted-foreground">
  {image.file
    ? `${image.fileName} (${(image.file.size / 1024 / 1024).toFixed(1)} MB)`
    : image.fileName || image.altText || image.secureUrl || "No image selected"}
</p>
```

### Step 6 — Server-side graceful handling

Already in place. The existing `createProductAction` and `updateProductAction` have try-catch blocks that:

- Catch errors from `uploadManifestImages` / `uploadFileToCloudinary`
- Return `{ ok: true, message: "Product saved: ... Image upload was skipped: ..." }` — product is saved, image error is reported
- The `uploadProductImageAction` catches errors and returns `{ ok: false, message: error.message }`

If the Next.js body limit is exceeded (21 MB+ request that bypasses client validation), Next.js 15 will return a 413 error. We can't easily catch this in the server action itself since the action never executes. The client-side validation in Step 5c prevents this from happening in normal usage.

No additional server-side changes needed beyond the `next.config.ts` body size limit increase.

### Step 7 — Verification

Run:
```bash
npm run typecheck
npm run lint
npm run build
```

Manual test matrix:
- 5 MB image → succeeds (no compression, under 10 MB threshold)
- 10 MB image → succeeds (no compression, exactly at threshold)
- 15 MB image → compressed to ~4 MB → succeeds
- 20 MB image → compressed to ~4 MB → succeeds
- 21 MB image → rejected by client validation with "Image Too Large" modal

## Files Changed

| File | Change |
|---|---|
| `next.config.ts` | Add `serverActions: { bodySizeLimit: "20mb" }` |
| `lib/uploads/policy.ts` | `UPLOAD_MAX_IMAGE_BYTES` from 5 MB → 20 MB |
| `lib/uploads/client-compression.ts` | **New file** — client-side image compression utility |
| `components/dashboard/product-workspace.tsx` | File size validation, auto-compression, error modal, file size display |
| `package.json` | Add `browser-image-compression` dependency |

## Risks & Mitigations

- **`browser-image-compression` bundle size**: ~18 KB gzipped. Acceptable for a dashboard app.
- **Web Worker**: `browser-image-compression` uses a web worker by default. If it fails, it falls back to main thread — our catch block returns the original file.
- **Cloudinary free tier limit**: 10 MB per upload on free plan. Since compression targets 4 MB, this is not a problem. If a user uploads a 19 MB file that compresses to 6 MB, still fine. The 20 MB hard limit is for the Next.js request body, not per-file Cloudinary.
- **No changes to other upload categories**: `quotation-item-image`, `order-item-image`, `catalogue-static-image` also use `UPLOAD_MAX_IMAGE_BYTES` and will benefit from the increase. This is intentional — all internal image uploads should accept smartphone photos.
