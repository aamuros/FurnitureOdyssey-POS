import type {
  ImageTransformationRule,
  ImageTransformationVariant,
  UploadCategory,
  UploadCategoryPolicy
} from "@/lib/uploads/types";

export const UPLOAD_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const UPLOAD_MAX_PDF_BYTES = 10 * 1024 * 1024;

export const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"] as const;
export const pdfMimeTypes = ["application/pdf"] as const;
export const pdfExtensions = [".pdf"] as const;
export const proofMimeTypes = [...imageMimeTypes, ...pdfMimeTypes] as const;
export const proofExtensions = [...imageExtensions, ...pdfExtensions] as const;

export const uploadPolicies = {
  "product-image": {
    category: "product-image",
    allowedMimeTypes: imageMimeTypes,
    allowedExtensions: imageExtensions,
    maxBytes: UPLOAD_MAX_IMAGE_BYTES,
    provider: "cloudinary",
    folderTemplate: "products/{productId}/images/{fileId}",
    requiresImageDimensions: true,
    applyImageNormalization: true,
    replacementAllowed: true,
    deletionPolicy: "hard-delete-allowed",
    permission: { module: "PRODUCTS", action: "UPDATE" },
    notes: "Mutable catalog media. Product images can be replaced without changing historical quotation/order snapshots."
  },
  "quotation-item-image": {
    category: "quotation-item-image",
    allowedMimeTypes: imageMimeTypes,
    allowedExtensions: imageExtensions,
    maxBytes: UPLOAD_MAX_IMAGE_BYTES,
    provider: "cloudinary",
    folderTemplate: "quotations/{quotationId}/items/{quotationItemId}/images/{fileId}",
    requiresImageDimensions: true,
    applyImageNormalization: true,
    replacementAllowed: true,
    deletionPolicy: "preserve-history",
    permission: { module: "QUOTATIONS", action: "UPDATE" },
    notes: "Quotation snapshot media should remain available for sent/accepted quotation history and PDFs."
  },
  "order-item-image": {
    category: "order-item-image",
    allowedMimeTypes: imageMimeTypes,
    allowedExtensions: imageExtensions,
    maxBytes: UPLOAD_MAX_IMAGE_BYTES,
    provider: "cloudinary",
    folderTemplate: "orders/{orderId}/items/{orderItemId}/images/{fileId}",
    requiresImageDimensions: true,
    applyImageNormalization: true,
    replacementAllowed: false,
    deletionPolicy: "preserve-history",
    permission: { module: "ORDERS", action: "UPDATE" },
    notes: "Order item images are operational snapshots and should not silently disappear from invoices, receipts, or history PDFs."
  },
  "customer-attachment": {
    category: "customer-attachment",
    allowedMimeTypes: proofMimeTypes,
    allowedExtensions: proofExtensions,
    maxBytes: UPLOAD_MAX_PDF_BYTES,
    provider: "cloudinary",
    folderTemplate: "customers/{customerId}/attachments/{fileId}",
    requiresImageDimensions: false,
    applyImageNormalization: true,
    replacementAllowed: true,
    deletionPolicy: "metadata-only",
    permission: { module: "CUSTOMERS", action: "UPDATE" },
    notes: "Reserved for future internal customer attachments. Not exposed as customer-portal upload behavior."
  },
  "payment-proof": {
    category: "payment-proof",
    allowedMimeTypes: proofMimeTypes,
    allowedExtensions: proofExtensions,
    maxBytes: UPLOAD_MAX_PDF_BYTES,
    provider: "cloudinary",
    folderTemplate: "payments/{paymentId}/proof/{fileId}",
    requiresImageDimensions: false,
    applyImageNormalization: true,
    replacementAllowed: true,
    deletionPolicy: "preserve-history",
    permission: { module: "PAYMENTS", action: "UPDATE" },
    notes: "Payment proof may be image or PDF evidence and should remain auditable once tied to a recorded payment."
  },
  "delivery-proof": {
    category: "delivery-proof",
    allowedMimeTypes: proofMimeTypes,
    allowedExtensions: proofExtensions,
    maxBytes: UPLOAD_MAX_PDF_BYTES,
    provider: "cloudinary",
    folderTemplate: "deliveries/{deliveryId}/proof/{fileId}",
    requiresImageDimensions: false,
    applyImageNormalization: true,
    replacementAllowed: true,
    deletionPolicy: "preserve-history",
    permission: { module: "DELIVERIES", action: "UPDATE" },
    notes: "Delivery proof may be image or PDF evidence and should remain auditable after delivery completion."
  },
  "generated-document": {
    category: "generated-document",
    allowedMimeTypes: pdfMimeTypes,
    allowedExtensions: pdfExtensions,
    maxBytes: UPLOAD_MAX_PDF_BYTES,
    provider: "cloudinary",
    folderTemplate: "orders/{orderId}/documents/{documentType}/{documentNumberOrFileId}.pdf",
    requiresImageDimensions: false,
    applyImageNormalization: false,
    replacementAllowed: false,
    deletionPolicy: "preserve-history",
    permission: { module: "DOCUMENTS", action: "EXPORT" },
    pdfStorageMode: "generate-on-demand",
    notes: "Operational PDFs are generated on demand by default. Store a PDF only when an explicit finalized/exported artifact is needed."
  },
  "catalogue-static-image": {
    category: "catalogue-static-image",
    allowedMimeTypes: imageMimeTypes,
    allowedExtensions: imageExtensions,
    maxBytes: UPLOAD_MAX_IMAGE_BYTES,
    provider: "cloudinary",
    folderTemplate: "catalogue/page-content/{cataloguePage}/{catalogueSection}/{catalogueFieldKey}/{fileId}",
    requiresImageDimensions: true,
    applyImageNormalization: true,
    replacementAllowed: true,
    deletionPolicy: "hard-delete-allowed",
    permission: { module: "SETTINGS", action: "UPDATE" },
    notes: "Mutable public catalogue static imagery managed from the internal catalogue content screen."
  }
} as const satisfies Record<UploadCategory, UploadCategoryPolicy>;

export const imageTransformationRules = {
  "product-thumbnail": {
    width: 320,
    height: 320,
    crop: "fill",
    format: "webp",
    quality: "auto"
  },
  "product-detail": {
    width: 1600,
    crop: "limit",
    format: "webp",
    quality: "auto"
  },
  "pdf-safe": {
    width: 900,
    crop: "limit",
    format: "auto",
    quality: "auto"
  },
  "admin-preview": {
    width: 640,
    crop: "limit",
    format: "webp",
    quality: "auto"
  }
} as const satisfies Record<ImageTransformationVariant, ImageTransformationRule>;

export function isUploadCategory(value: string): value is UploadCategory {
  return Object.hasOwn(uploadPolicies, value);
}

export function getUploadPolicy(category: UploadCategory) {
  return uploadPolicies[category];
}
