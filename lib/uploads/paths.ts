import { safeFilename } from "@/lib/pdf/formatters";
import { getUploadPolicy } from "@/lib/uploads/policy";
import type { UploadCategory, UploadPathInput } from "@/lib/uploads/types";

const requiredFields: Record<UploadCategory, Array<keyof UploadPathInput>> = {
  "product-image": ["productId"],
  "quotation-item-image": ["quotationId", "quotationItemId"],
  "order-item-image": ["orderId", "orderItemId"],
  "customer-attachment": ["customerId"],
  "payment-proof": ["paymentId"],
  "delivery-proof": ["deliveryId"],
  "generated-document": ["orderId", "documentType"],
  "catalogue-static-image": ["pageContentId", "cataloguePage", "catalogueSection", "catalogueFieldKey"]
};

function stableFileId(input: UploadPathInput) {
  if (input.fileId) {
    return safeFilename(input.fileId);
  }

  const timestamp = (input.now ?? new Date()).toISOString().replace(/\D/g, "").slice(0, 14);
  const filename = input.originalFilename ? `-${safeFilename(input.originalFilename)}` : "";

  return `${timestamp}${filename}`;
}

function requireValue(input: UploadPathInput, key: keyof UploadPathInput) {
  const value = input[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Upload path for ${input.category} requires ${String(key)}.`);
  }

  return safeFilename(value);
}

export function buildUploadFolder(input: UploadPathInput) {
  const policy = getUploadPolicy(input.category);
  const missing = requiredFields[input.category].filter((field) => !input[field]);

  if (missing.length) {
    throw new Error(`Upload path for ${input.category} is missing ${missing.join(", ")}.`);
  }

  const fileId = stableFileId(input);
  const documentNumberOrFileId = safeFilename(input.documentNumber ?? fileId);

  return policy.folderTemplate
    .replace("{productId}", input.productId ? safeFilename(input.productId) : "")
    .replace("{quotationId}", input.quotationId ? safeFilename(input.quotationId) : "")
    .replace("{quotationItemId}", input.quotationItemId ? safeFilename(input.quotationItemId) : "")
    .replace("{orderId}", input.orderId ? safeFilename(input.orderId) : "")
    .replace("{orderItemId}", input.orderItemId ? safeFilename(input.orderItemId) : "")
    .replace("{customerId}", input.customerId ? safeFilename(input.customerId) : "")
    .replace("{paymentId}", input.paymentId ? safeFilename(input.paymentId) : "")
    .replace("{deliveryId}", input.deliveryId ? safeFilename(input.deliveryId) : "")
    .replace("{documentType}", input.documentType ? safeFilename(input.documentType.toLowerCase()) : "")
    .replace("{pageContentId}", input.pageContentId ? safeFilename(input.pageContentId) : "")
    .replace("{cataloguePage}", input.cataloguePage ? safeFilename(input.cataloguePage) : "")
    .replace("{catalogueSection}", input.catalogueSection ? safeFilename(input.catalogueSection) : "")
    .replace("{catalogueFieldKey}", input.catalogueFieldKey ? safeFilename(input.catalogueFieldKey) : "")
    .replace("{documentNumberOrFileId}", documentNumberOrFileId)
    .replace("{fileId}", fileId);
}

export function buildProductImagePath(productId: string, fileId?: string) {
  return buildUploadFolder({ category: "product-image", productId, fileId });
}

export function buildQuotationItemImagePath(
  quotationId: string,
  quotationItemId: string,
  fileId?: string
) {
  return buildUploadFolder({
    category: "quotation-item-image",
    quotationId,
    quotationItemId,
    fileId
  });
}

export function buildOrderItemImagePath(orderId: string, orderItemId: string, fileId?: string) {
  return buildUploadFolder({ category: "order-item-image", orderId, orderItemId, fileId });
}

export function buildGeneratedDocumentPath(input: {
  orderId: string;
  documentType: string;
  documentNumber?: string | null;
  fileId?: string;
}) {
  return buildUploadFolder({
    category: "generated-document",
    orderId: input.orderId,
    documentType: input.documentType,
    documentNumber: input.documentNumber,
    fileId: input.fileId
  });
}

export function assertUploadPathRequirements(input: UploadPathInput) {
  for (const field of requiredFields[input.category]) {
    requireValue(input, field);
  }
}
