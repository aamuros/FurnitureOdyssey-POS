import type { PermissionAction, PermissionModule, UserProfile } from "@prisma/client";

export type ModuleKey =
  | "CUSTOMERS"
  | "INQUIRIES"
  | "QUOTATIONS"
  | "ORDERS"
  | "PAYMENTS"
  | "DELIVERIES"
  | "DOCUMENTS"
  | "SALES_HISTORY"
  | "USERS"
  | "SETTINGS";

export type ActionKey =
  | "VIEW"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "ASSIGN"
  | "EXPORT"
  | "APPROVE";

export const permissionModules: Record<ModuleKey, string> = {
  CUSTOMERS: "Customers",
  INQUIRIES: "Inquiries",
  QUOTATIONS: "Quotations",
  ORDERS: "Orders",
  PAYMENTS: "Payments",
  DELIVERIES: "Deliveries",
  DOCUMENTS: "Documents",
  SALES_HISTORY: "Sales History",
  USERS: "Users",
  SETTINGS: "Settings"
};

export const moduleActions: Record<ModuleKey, ActionKey[]> = {
  CUSTOMERS: ["VIEW", "CREATE", "UPDATE"],
  INQUIRIES: ["VIEW", "CREATE", "UPDATE", "ASSIGN"],
  QUOTATIONS: ["VIEW", "CREATE", "UPDATE", "EXPORT", "APPROVE"],
  ORDERS: ["VIEW", "CREATE", "UPDATE"],
  PAYMENTS: ["VIEW", "CREATE", "UPDATE"],
  DELIVERIES: ["VIEW", "CREATE", "UPDATE"],
  DOCUMENTS: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
  SALES_HISTORY: ["VIEW"],
  USERS: ["VIEW", "CREATE", "UPDATE", "DELETE"],
  SETTINGS: ["VIEW", "UPDATE"]
};

export const staffDefaultPermissions: Partial<Record<ModuleKey, ActionKey[]>> = {
  CUSTOMERS: ["VIEW", "CREATE", "UPDATE"],
  INQUIRIES: ["VIEW", "CREATE", "UPDATE", "ASSIGN"],
  QUOTATIONS: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
  ORDERS: ["VIEW", "CREATE", "UPDATE"],
  PAYMENTS: ["VIEW", "CREATE", "UPDATE"],
  DELIVERIES: ["VIEW", "CREATE", "UPDATE"],
  DOCUMENTS: ["VIEW", "CREATE", "UPDATE", "EXPORT"]
};

export type UserWithPermissions = UserProfile & {
  permissions: Array<{
    module: PermissionModule;
    action: PermissionAction;
    allowed: boolean;
  }>;
};

export function isAdmin(user: Pick<UserProfile, "role">) {
  return user.role === "ADMIN";
}

export function hasPermission(
  user: UserWithPermissions,
  module: PermissionModule,
  action: PermissionAction
) {
  if (isAdmin(user)) {
    return true;
  }

  return user.permissions.some(
    (permission) =>
      permission.module === module &&
      permission.action === action &&
      permission.allowed
  );
}

export function canViewModule(user: UserWithPermissions, module: PermissionModule) {
  return hasPermission(user, module, "VIEW");
}
