import Link from "next/link";
import { LogOut } from "lucide-react";
import type { PermissionModule } from "@prisma/client";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-svh bg-background text-foreground lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-border bg-panel lg:min-h-svh lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center border-b border-border px-5">
          <div>
            <p className="text-sm font-semibold">Furniture Odyssey</p>
            <p className="text-xs text-muted-foreground">Sales operations</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:block lg:space-y-1 lg:overflow-visible">
          {visibleItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground lg:flex"
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
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
