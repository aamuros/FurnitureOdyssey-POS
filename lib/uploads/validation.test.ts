import assert from "node:assert/strict";
import test from "node:test";
import type { UserWithPermissions } from "@/lib/auth/permissions";
import { buildGeneratedDocumentPath, buildProductImagePath } from "@/lib/uploads/paths";
import { getUploadPolicy } from "@/lib/uploads/policy";
import {
  adminPreviewImageUrl,
  canUserUpload,
  pdfSafeImageUrl,
  validateUpload
} from "@/lib/uploads";

test("upload policy defines conservative image and PDF limits", () => {
  assert.deepEqual(getUploadPolicy("product-image").allowedMimeTypes, [
    "image/jpeg",
    "image/png",
    "image/webp"
  ]);
  assert.equal(getUploadPolicy("product-image").maxBytes, 20 * 1024 * 1024);
  assert.deepEqual(getUploadPolicy("generated-document").allowedMimeTypes, ["application/pdf"]);
  assert.equal(getUploadPolicy("generated-document").maxBytes, 10 * 1024 * 1024);
});

test("validates successful product image uploads", () => {
  const result = validateUpload({
    category: "product-image",
    filename: "Dining Table.JPG",
    mimeType: "image/jpeg",
    sizeBytes: 512_000,
    width: 1200,
    height: 900
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.normalizedFilename, "Dining-Table.JPG");
    assert.equal(result.extension, ".jpg");
  }
});

test("rejects dangerous, oversized, and mismatched uploads", () => {
  const result = validateUpload({
    category: "generated-document",
    filename: "../invoice.exe",
    mimeType: "application/x-msdownload",
    sizeBytes: 12 * 1024 * 1024
  });

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.deepEqual(
      result.issues.map((issue) => issue.code),
      ["dangerous-filename", "invalid-mime-type", "invalid-extension", "file-too-large"]
    );
  }
});

test("requires dimensions for image categories", () => {
  const result = validateUpload({
    category: "quotation-item-image",
    filename: "sofa.webp",
    mimeType: "image/webp",
    sizeBytes: 1024
  });

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.issues.some((issue) => issue.code === "missing-image-dimensions"), true);
  }
});

test("builds deterministic upload paths", () => {
  assert.equal(
    buildProductImagePath("product 123", "front view"),
    "products/product-123/images/front-view"
  );
  assert.equal(
    buildGeneratedDocumentPath({
      orderId: "order-1",
      documentType: "FINAL_ORDER_SUMMARY",
      documentNumber: "SUM-2026-000001"
    }),
    "orders/order-1/documents/final-order-summary/sum-2026-000001.pdf"
  );
});

test("maps upload permissions to existing modules and actions", () => {
  const user = {
    role: "STAFF",
    permissions: [
      {
        module: "PRODUCTS",
        action: "UPDATE",
        allowed: true
      }
    ]
  } as UserWithPermissions;

  assert.equal(canUserUpload(user, "product-image"), true);
  assert.equal(canUserUpload(user, "payment-proof"), false);
});

test("builds Cloudinary transformation URLs without touching non-Cloudinary URLs", () => {
  assert.equal(
    pdfSafeImageUrl("https://res.cloudinary.com/demo/image/upload/v1/products/chair.jpg"),
    "https://res.cloudinary.com/demo/image/upload/c_limit,w_900,q_auto,f_auto/v1/products/chair.jpg"
  );
  assert.equal(adminPreviewImageUrl("https://example.com/chair.jpg"), "https://example.com/chair.jpg");
});
