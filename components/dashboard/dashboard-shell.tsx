import { Armchair, LogOut } from "lucide-react";
import type { PermissionModule } from "@prisma/client";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { dashboardNavItems } from "@/lib/auth/navigation";
import { canViewModule, type UserWithPermissions } from "@/lib/auth/permissions";

type DashboardShellProps = {
  user: UserWithPermissions;
  children: React.ReactNode;
};

export function DashboardShell({ user, children }: DashboardShellProps) {
  const visibleItems = dashboardNavItems.filter((item) => {
    if (item.adminOnly) {
      return user.role === "ADMIN";
    }

    if (item.href === "/dashboard") {
      return true;
    }

    return canViewModule(user, item.module as PermissionModule);
  });

  return (
    <div className="min-h-svh bg-background text-foreground lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-border bg-panel lg:min-h-svh lg:border-b-0 lg:border-r">
        <div className="flex min-h-20 items-center gap-3 border-b border-border px-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-soft-accent text-accent">
            <Armchair className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-semibold leading-5">Furniture Odyssey</p>
            <p className="studio-kicker mt-1">Sales Studio</p>
          </div>
        </div>
        <DashboardNav allowedHrefs={visibleItems.map((item) => item.href)} />
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-16 items-center justify-between border-b border-border bg-panel px-5">
          <div>
            <p className="text-sm font-medium">{user.displayName}</p>
            <p className="text-xs text-muted-foreground">{user.role}</p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </header>
        <main className="px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
