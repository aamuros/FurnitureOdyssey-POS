import { z } from "zod";
import { moduleActions } from "@/lib/auth/permissions";

const permissionInputSchema = z.object({
  module: z.enum([
    "CUSTOMERS",
    "INQUIRIES",
    "PRODUCTS",
    "QUOTATIONS",
    "ORDERS",
    "PAYMENTS",
    "DELIVERIES",
    "DOCUMENTS",
    "SALES_HISTORY",
    "USERS",
    "SETTINGS"
  ]),
  action: z.enum(["VIEW", "CREATE", "UPDATE", "DELETE", "ASSIGN", "EXPORT", "APPROVE"]),
  allowed: z.boolean()
});

function validatePermissionActions(
  value: {
    permissions: Array<z.infer<typeof permissionInputSchema>>;
  },
  context: z.RefinementCtx
) {
  for (const permission of value.permissions) {
    if (!moduleActions[permission.module].includes(permission.action)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${permission.action} is not valid for ${permission.module}.`,
        path: ["permissions"]
      });
    }
  }
}

const userInputSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  displayName: z.string().trim().min(2, "Display name is required."),
  role: z.enum(["ADMIN", "STAFF"]),
  permissions: z.array(permissionInputSchema).default([])
});

export const inviteUserSchema = userInputSchema.superRefine(validatePermissionActions);

export const updateUserSchema = userInputSchema
  .omit({ email: true })
  .extend({
    userId: z.string().uuid(),
    status: z.enum(["PENDING", "ACTIVE", "INACTIVE"])
  })
  .superRefine(validatePermissionActions);

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
