import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireActiveUser } from "@/lib/auth/server";
import { dashboardNavItems } from "@/lib/auth/navigation";
import { canViewModule, type UserWithPermissions } from "@/lib/auth/permissions";
import { getDashboardOperations } from "@/lib/dashboard/operations";

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
  const { attentionItems, kpiCards } = await getDashboardOperations(user);

  return (
    <>
      <PageHeader title="Dashboard" description="Today's workspace" />
      {params.error === "forbidden" ? (
        <div className="mb-5 flex items-center gap-3 rounded-md border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          <ShieldAlert className="h-4 w-4" />
          <span>You do not have access to that area.</span>
        </div>
      ) : null}
      {kpiCards.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((card) => (
            <div key={card.key} className="studio-card p-4">
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-normal text-foreground">{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
            </div>
          ))}
        </section>
      ) : null}
      <section className="studio-card mt-5">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-sm font-semibold">Needs attention</h2>
        </div>
        {attentionItems.length > 0 ? (
          <div className="border-t border-border">
            {attentionItems.slice(0, 5).map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="block border-b border-border px-5 py-3 transition last:border-b-0 hover:bg-muted/35"
              >
                <span className="block text-sm font-medium text-foreground">{item.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">No pending items.</p>
        )}
      </section>
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold">Quick access</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {availableModules.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="studio-card flex items-center gap-3 p-3 transition hover:border-accent/35 hover:bg-muted/35"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/45 text-muted-foreground">
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
        </div>
      </section>
    </>
  );
}
