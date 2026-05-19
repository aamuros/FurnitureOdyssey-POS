import { hasPermission, type UserWithPermissions } from "@/lib/auth/permissions";
import { getUploadPolicy, isUploadCategory } from "@/lib/uploads/policy";
import type {
  UploadCategory,
  UploadPermissionRequirement,
  UploadValidationInput,
  UploadValidationIssue,
  UploadValidationResult
} from "@/lib/uploads/types";

const executableExtensions = new Set([
  ".apk",
  ".app",
  ".bat",
  ".bin",
  ".cmd",
  ".com",
  ".dmg",
  ".dll",
  ".exe",
  ".jar",
  ".js",
  ".msi",
  ".php",
  ".ps1",
  ".py",
  ".rb",
  ".sh",
  ".vbs",
  ".wsf"
]);

const archiveExtensions = new Set([".7z", ".bz2", ".gz", ".rar", ".tar", ".tgz", ".zip"]);

function extensionFromFilename(filename: string) {
  const normalized = filename.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === normalized.length - 1) {
    return "";
  }

  return normalized.slice(dotIndex);
}

export function normalizeUploadFilename(filename: string) {
  const baseName = filename
    .trim()
    .replace(/[/\\]/g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);

  return baseName || "upload";
}

export function isDangerousFilename(filename: string) {
  const normalized = filename.trim();
  const lower = normalized.toLowerCase();
  const extension = extensionFromFilename(lower);

  return (
    normalized.length === 0 ||
    normalized.includes("\0") ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized === "." ||
    normalized === ".." ||
    lower.startsWith(".") ||
    lower.includes("..") ||
    executableExtensions.has(extension) ||
    archiveExtensions.has(extension)
  );
}

export function validateUpload(input: UploadValidationInput): UploadValidationResult {
  const issues: UploadValidationIssue[] = [];

  if (!isUploadCategory(input.category)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-category",
          message: "Unsupported upload category."
        }
      ]
    };
  }

  const policy = getUploadPolicy(input.category);
  const normalizedFilename = normalizeUploadFilename(input.filename);
  const extension = extensionFromFilename(normalizedFilename);
  const mimeType = input.mimeType.trim().toLowerCase();

  if (isDangerousFilename(input.filename)) {
    issues.push({
      code: "dangerous-filename",
      message: "Filename is not allowed."
    });
  }

  if (!policy.allowedMimeTypes.some((allowedMimeType) => allowedMimeType === mimeType)) {
    issues.push({
      code: "invalid-mime-type",
      message: `File type ${mimeType || "unknown"} is not allowed for ${input.category}.`
    });
  }

  if (!policy.allowedExtensions.some((allowedExtension) => allowedExtension === extension)) {
    issues.push({
      code: "invalid-extension",
      message: `File extension ${extension || "unknown"} is not allowed for ${input.category}.`
    });
  }

  if (input.sizeBytes > policy.maxBytes) {
    issues.push({
      code: "file-too-large",
      message: `File exceeds the ${Math.round(policy.maxBytes / 1024 / 1024)} MB limit.`
    });
  }

  if (
    policy.requiresImageDimensions &&
    (!input.width || input.width <= 0 || !input.height || input.height <= 0)
  ) {
    issues.push({
      code: "missing-image-dimensions",
      message: "Image uploads must include positive width and height metadata."
    });
  }

  if (issues.length) {
    return {
      ok: false,
      issues
    };
  }

  return {
    ok: true,
    category: input.category,
    normalizedFilename,
    extension,
    mimeType,
    sizeBytes: input.sizeBytes
  };
}

export function getUploadPermissionRequirement(
  category: UploadCategory
): UploadPermissionRequirement {
  return getUploadPolicy(category).permission;
}

export function canUserUpload(user: UserWithPermissions, category: UploadCategory) {
  const permission = getUploadPermissionRequirement(category);

  return hasPermission(user, permission.module, permission.action);
}
