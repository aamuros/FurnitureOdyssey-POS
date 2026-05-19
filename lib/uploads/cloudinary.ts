import { imageTransformationRules } from "@/lib/uploads/policy";
import type { ImageTransformationVariant } from "@/lib/uploads/types";

function transformationString(variant: ImageTransformationVariant) {
  const rule = imageTransformationRules[variant];
  const parts = [`c_${rule.crop}`, `w_${rule.width}`, `q_${rule.quality}`, `f_${rule.format}`];

  if ("height" in rule && rule.height) {
    parts.splice(2, 0, `h_${rule.height}`);
  }

  return parts.join(",");
}

export function buildCloudinaryTransformedUrl(
  secureUrl: string,
  variant: ImageTransformationVariant
) {
  if (!secureUrl.includes("/upload/")) {
    return secureUrl;
  }

  return secureUrl.replace("/upload/", `/upload/${transformationString(variant)}/`);
}

export function productThumbnailUrl(secureUrl: string) {
  return buildCloudinaryTransformedUrl(secureUrl, "product-thumbnail");
}

export function productDetailImageUrl(secureUrl: string) {
  return buildCloudinaryTransformedUrl(secureUrl, "product-detail");
}

export function pdfSafeImageUrl(secureUrl: string) {
  return buildCloudinaryTransformedUrl(secureUrl, "pdf-safe");
}

export function adminPreviewImageUrl(secureUrl: string) {
  return buildCloudinaryTransformedUrl(secureUrl, "admin-preview");
}
