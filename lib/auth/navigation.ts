import {
  Boxes,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Package,
  PackageCheck,
  ReceiptText,
  Settings,
  Truck,
  UserCog,
  Users,
  WalletCards
} from "lucide-react";
import type { PermissionModule } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import type { Route } from "next";

export type DashboardNavItem = {
  title: string;
  href: Route;
  module: PermissionModule;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    module: "CUSTOMERS",
    icon: LayoutDashboard
  },
  {
    title: "Customers",
    href: "/customers",
    module: "CUSTOMERS",
    icon: Users
  },
  {
    title: "Inquiries",
    href: "/inquiries",
    module: "INQUIRIES",
    icon: ClipboardList
  },
  {
    title: "Products",
    href: "/products",
    module: "PRODUCTS",
    icon: Package
  },
  {
    title: "Quotations",
    href: "/quotations",
    module: "QUOTATIONS",
    icon: ReceiptText
  },
  {
    title: "Orders",
    href: "/orders",
    module: "ORDERS",
    icon: Boxes
  },
  {
    title: "Payments",
    href: "/payments",
    module: "PAYMENTS",
    icon: WalletCards
  },
  {
    title: "Deliveries",
    href: "/deliveries",
    module: "DELIVERIES",
    icon: Truck
  },
  {
    title: "Documents",
    href: "/documents",
    module: "DOCUMENTS",
    icon: FileText
  },
  {
    title: "Sales History",
    href: "/sales-history",
    module: "SALES_HISTORY",
    icon: PackageCheck
  },
  {
    title: "Users",
    href: "/users",
    module: "USERS",
    icon: UserCog,
    adminOnly: true
  },
  {
    title: "Settings",
    href: "/settings",
    module: "SETTINGS",
    icon: Settings,
    adminOnly: true
  }
];
