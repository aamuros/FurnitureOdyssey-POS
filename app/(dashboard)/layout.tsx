import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireActiveUser } from "@/lib/auth/server";
import type { UserWithPermissions } from "@/lib/auth/permissions";

export default async function InternalLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = (await requireActiveUser()) as UserWithPermissions;

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
