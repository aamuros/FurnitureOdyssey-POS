# Plan: Fix Product Image Upload Not Persisting to Database

## Context

After the upload size limit changes, product images are accepted by the UI (preview shows, form submits without error) but **no `ProductImage` rows are created in the database** and images don't display after save.

## Root Cause

The bug is in `components/dashboard/product-workspace.tsx:1067` inside `handleImageInputChange`:

```ts
async function handleImageInputChange(event, imageClientId, scope) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";   // ← BUG: clears the <input type="file"> DOM element
    // ...
    const processedFile = await compressImageIfNeeded(file);
    updateImageFile(imageClientId, processedFile, scope);  // stores in React state only
}
```

**The problem**: `event.target.value = ""` clears the `<input type="file">` DOM element immediately. The file is then stored in React state (`image.file` via `updateImageFile`), but the native `<form>` submission reads from the actual DOM `<input type="file" name={`imageFile_${image.clientId}`}>` element — which is now empty.

When the server action runs at `app/actions/products.ts:202-204`:
```ts
const file = formData.get(`imageFile_${image.clientId}`);
if (file instanceof File && file.size > 0) { ... }
```

`file.size` is 0 because the input was cleared, so the upload is **silently skipped**. The product is saved to the DB but no `ProductImage` row is created.

**Why it affects ALL files (not just compressed ones)**: The `event.target.value = ""` runs unconditionally for every file selection, including files ≤ 10 MB that don't need compression.

## Fix

Replace `event.target.value = ""` with a `DataTransfer`-based approach that programmatically updates the `<input type="file">` element's files after processing. This ensures the native form submission includes the correct file.

### Change in `components/dashboard/product-workspace.tsx`

Replace the current `handleImageInputChange` (lines 1061–1084):

```ts
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
```

Key changes:
1. **Remove `event.target.value = ""`** — no longer clear the input unconditionally
2. **Use `event.currentTarget`** instead of `event.target` — more reliable reference to the input element
3. **After compression, use `DataTransfer`** to update the input's files — only when the file actually changed (compressed). For files ≤ 10 MB, the input already has the original file.
4. **Only clear the input for rejected files** (> 20 MB) — so the user can select a different file

### Why this works

| Scenario | Input DOM element | Form submission | Result |
|---|---|---|---|
| ≤ 10 MB (no compression) | Still has original file | File included in FormData | Uploads correctly |
| 10–20 MB (compressed) | Updated via DataTransfer with compressed file | Compressed file included in FormData | Uploads correctly |
| > 20 MB (rejected) | Cleared | No file in FormData | Error modal shown, no submit |

## Verification

After the fix:
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test`

Manual test:
1. Create a new product with a 5 MB image → should create a `ProductImage` row and display the image
2. Edit a product, replace image with a 15 MB image → should compress and create a new `ProductImage` row
3. Try to select a 25 MB image → should show "Image Too Large" modal, no form submission
