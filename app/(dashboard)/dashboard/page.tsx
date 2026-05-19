import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireActiveUser } from "@/lib/auth/server";
import { dashboardNavItems } from "@/lib/auth/navigation";
import { canViewModule, type UserWithPermissions } from "@/lib/auth/permissions";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = (await requireActiveUser()) as UserWithPermissions;
  const params = await searchParams;
  const availableModules = dashboardNavItems.filter((item) => {
    if (item.href === "/dashboard") {
      return false;
    }

    if (item.adminOnly) {
      return user.role === "ADMIN";
    }

    return canViewModule(user, item.module);
  });

  return (
    <>
      <PageHeader
        title="Internal dashboard"
        description="Access foundation for customer records, sales documents, orders, payments, deliveries, and sales history."
      />
      {params.error === "forbidden" ? (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          <ShieldAlert className="h-4 w-4" />
          <span>You do not have access to that area.</span>
        </div>
      ) : null}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="studio-card p-5">
          <p className="studio-kicker">Profile</p>
          <p className="text-sm text-muted-foreground">Account status</p>
          <div className="mt-3">
            <StatusPill tone="success">{user.status}</StatusPill>
          </div>
        </div>
        <div className="studio-card p-5">
          <p className="studio-kicker">Access</p>
          <p className="text-sm text-muted-foreground">Role</p>
          <p className="mt-3 text-xl font-semibold">{user.role}</p>
        </div>
        <div className="studio-card p-5">
          <p className="studio-kicker">Workspace</p>
          <p className="text-sm text-muted-foreground">Visible modules</p>
          <p className="mt-3 text-xl font-semibold">{availableModules.length}</p>
        </div>
      </section>
      <section className="studio-card mt-6">
        <div className="studio-card-header">
          <h2 className="text-sm font-semibold">Available work areas</h2>
        </div>
        <div className="divide-y divide-border">
          {availableModules.map((item) => (
            <div key={item.href} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">Permission-aware route enabled</p>
              </div>
              <StatusPill>Ready</StatusPill>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
