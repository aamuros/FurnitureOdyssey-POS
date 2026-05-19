import { requirePermission } from "@/lib/auth/server";
import { getUploadPermissionRequirement } from "@/lib/uploads/validation";
import type { UploadCategory } from "@/lib/uploads/types";

export async function requireUploadPermission(category: UploadCategory) {
  const permission = getUploadPermissionRequirement(category);

  return requirePermission(permission.module, permission.action);
}
