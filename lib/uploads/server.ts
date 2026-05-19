import { requirePermission } from "@/lib/auth/server";
import { buildUploadFolder } from "@/lib/uploads/paths";
import { getUploadPolicy } from "@/lib/uploads/policy";
import { getUploadPermissionRequirement } from "@/lib/uploads/validation";
import { normalizeUploadFilename, validateUpload } from "@/lib/uploads/validation";
import type { UploadCategory, UploadedFileMetadata, UploadPathInput } from "@/lib/uploads/types";

type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
};

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary environment variables are not configured.");
  }

  return {
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  };
}

function sniffMimeType(buffer: Buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF") {
    return "application/pdf";
  }

  return "";
}

async function uploadBufferToCloudinary(
  buffer: Buffer,
  input: {
    publicId: string;
    resourceType: "image" | "raw" | "auto";
  }
) {
  const { v2: cloudinary } = await import("cloudinary");

  cloudinary.config(getCloudinaryConfig());

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: input.publicId,
        resource_type: input.resourceType,
        overwrite: false,
        use_filename: false,
        unique_filename: false
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed."));
          return;
        }

        resolve(result as CloudinaryUploadResult);
      }
    );

    stream.end(buffer);
  });
}

export async function requireUploadPermission(category: UploadCategory) {
  const permission = getUploadPermissionRequirement(category);

  return requirePermission(permission.module, permission.action);
}

export async function uploadFileToCloudinary(input: {
  category: UploadCategory;
  file: File;
  path: Omit<UploadPathInput, "category" | "originalFilename">;
}): Promise<UploadedFileMetadata> {
  await requireUploadPermission(input.category);

  const policy = getUploadPolicy(input.category);
  const originalFilename = input.file.name || "upload";
  const normalizedFilename = normalizeUploadFilename(originalFilename);
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const detectedMimeType = sniffMimeType(buffer);

  const validation = validateUpload({
    category: input.category,
    filename: originalFilename,
    mimeType: detectedMimeType || input.file.type,
    sizeBytes: buffer.byteLength,
    width: policy.requiresImageDimensions ? 1 : undefined,
    height: policy.requiresImageDimensions ? 1 : undefined
  });

  if (!validation.ok) {
    throw new Error(validation.issues[0]?.message ?? "Upload file is not valid.");
  }

  if (!detectedMimeType || detectedMimeType !== validation.mimeType) {
    throw new Error("File contents do not match an allowed upload type.");
  }

  const publicId = buildUploadFolder({
    ...input.path,
    category: input.category,
    originalFilename: normalizedFilename
  });

  const result = await uploadBufferToCloudinary(buffer, {
    publicId,
    resourceType: policy.allowedMimeTypes.every((mimeType) => mimeType.startsWith("image/"))
      ? "image"
      : "auto"
  });

  const width = typeof result.width === "number" ? result.width : null;
  const height = typeof result.height === "number" ? result.height : null;

  if (policy.requiresImageDimensions && (!width || !height || width <= 0 || height <= 0)) {
    throw new Error("Uploaded image is missing valid dimensions.");
  }

  return {
    cloudinaryPublicId: result.public_id,
    secureUrl: result.secure_url,
    resourceType: result.resource_type,
    format: result.format ?? null,
    width,
    height,
    bytes: typeof result.bytes === "number" ? result.bytes : buffer.byteLength,
    originalFilename: normalizedFilename
  };
}
