import type { PermissionAction, PermissionModule } from "@prisma/client";

export type UploadCategory =
  | "product-image"
  | "quotation-item-image"
  | "order-item-image"
  | "customer-attachment"
  | "payment-proof"
  | "delivery-proof"
  | "generated-document"
  | "catalogue-static-image";

export type UploadStorageProvider = "cloudinary";

export type DeletionPolicy = "hard-delete-allowed" | "metadata-only" | "preserve-history";

export type PdfStorageMode = "generate-on-demand" | "store-when-finalized";

export type UploadPermissionRequirement = {
  module: PermissionModule;
  action: PermissionAction;
};

export type ImageTransformationVariant =
  | "product-thumbnail"
  | "product-detail"
  | "pdf-safe"
  | "admin-preview";

export type ImageTransformationRule = {
  width: number;
  height?: number;
  crop: "fill" | "limit" | "fit";
  format: "webp" | "auto";
  quality: "auto" | number;
};

export type UploadCategoryPolicy = {
  category: UploadCategory;
  allowedMimeTypes: readonly string[];
  allowedExtensions: readonly string[];
  maxBytes: number;
  provider: UploadStorageProvider;
  folderTemplate: string;
  requiresImageDimensions: boolean;
  applyImageNormalization: boolean;
  replacementAllowed: boolean;
  deletionPolicy: DeletionPolicy;
  permission: UploadPermissionRequirement;
  pdfStorageMode?: PdfStorageMode;
  notes: string;
};

export type UploadPathInput = {
  category: UploadCategory;
  productId?: string;
  quotationId?: string;
  quotationItemId?: string;
  orderId?: string;
  orderItemId?: string;
  customerId?: string;
  paymentId?: string;
  deliveryId?: string;
  documentType?: string;
  documentNumber?: string | null;
  pageContentId?: string;
  cataloguePage?: string;
  catalogueSection?: string;
  catalogueFieldKey?: string;
  fileId?: string;
  originalFilename?: string;
  now?: Date;
};

export type UploadValidationInput = {
  category: UploadCategory;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
};

export type UploadValidationIssueCode =
  | "invalid-category"
  | "invalid-mime-type"
  | "invalid-extension"
  | "file-too-large"
  | "missing-image-dimensions"
  | "dangerous-filename";

export type UploadValidationIssue = {
  code: UploadValidationIssueCode;
  message: string;
};

export type UploadValidationResult =
  | {
      ok: true;
      category: UploadCategory;
      normalizedFilename: string;
      extension: string;
      mimeType: string;
      sizeBytes: number;
    }
  | {
      ok: false;
      issues: UploadValidationIssue[];
    };

export type UploadedFileMetadata = {
  cloudinaryPublicId: string;
  secureUrl: string;
  resourceType: string;
  format: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  originalFilename: string;
};
