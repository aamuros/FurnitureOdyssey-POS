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
    "CATALOGUE",
    "USERS",
    "SETTINGS"
  ]),
  action: z.enum(["VIEW", "CREATE", "UPDATE", "DELETE", "ASSIGN", "EXPORT", "APPROVE", "UPLOAD", "RESET"]),
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
  canLinkGoogleCalendar: z
    .preprocess((value) => value === true || value === "true" || value === "on", z.boolean())
    .default(false),
  permissions: z.array(permissionInputSchema).default([])
});

export const createUserSchema = userInputSchema
  .extend({
    password: z.string().min(8, "Temporary password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm the temporary password.")
  })
  .superRefine((value, context) => {
    validatePermissionActions(value, context);

    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Temporary password and confirmation must match.",
        path: ["confirmPassword"]
      });
    }
  });

export const updateUserSchema = userInputSchema
  .omit({ email: true })
  .extend({
    userId: z.string().uuid(),
    status: z.enum(["PENDING", "ACTIVE", "INACTIVE"])
  })
  .superRefine(validatePermissionActions);

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
