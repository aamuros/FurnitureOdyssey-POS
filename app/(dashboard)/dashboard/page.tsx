import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireActiveUser } from "@/lib/auth/server";
import { dashboardNavItems } from "@/lib/auth/navigation";
import { canViewModule, type UserWithPermissions } from "@/lib/auth/permissions";

const moduleDescriptions: Record<string, string> = {
  "Customer Directory": "Manage buyer records",
  Products: "Manage catalog and pricing",
  Quotations: "Create and track quotes",
  Orders: "Track active orders",
  Payments: "Review payment status",
  Deliveries: "Schedule and confirm deliveries",
  Documents: "Access generated files",
  "Sales History": "Review completed sales",
  Users: "Manage staff access",
  Settings: "Configure workspace"
};

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
      <PageHeader title="Dashboard" description="Today's workspace" />
      {params.error === "forbidden" ? (
        <div className="mb-5 flex items-center gap-3 rounded-md border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          <ShieldAlert className="h-4 w-4" />
          <span>You do not have access to that area.</span>
        </div>
      ) : null}
      <section className="studio-card p-5">
        <h2 className="text-sm font-semibold">Needs attention</h2>
        <p className="mt-2 text-sm text-muted-foreground">No pending items.</p>
      </section>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {availableModules.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="studio-card flex items-center gap-4 p-4 transition hover:border-accent/35 hover:bg-muted/35"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/45 text-muted-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {moduleDescriptions[item.title]}
                </span>
              </span>
            </Link>
          );
        })}
      </section>
    </>
  );
}
