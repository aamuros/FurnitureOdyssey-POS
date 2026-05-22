import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireActiveUser } from "@/lib/auth/server";
import type { UserWithPermissions } from "@/lib/auth/permissions";
import { getDashboardOperations } from "@/lib/dashboard/operations";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = (await requireActiveUser()) as UserWithPermissions;
  const params = await searchParams;
  const { attentionItems, kpiCards, todayMetrics, recentActivity } =
    await getDashboardOperations(user);

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

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="studio-card">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <h2 className="text-sm font-semibold">Needs Attention</h2>
          </div>
          {attentionItems.length > 0 ? (
            <div className="space-y-2 border-t border-border p-3">
              {attentionItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="block rounded-md px-3 py-3 transition hover:bg-muted/35"
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

        <div className="space-y-5">
          <section className="studio-card">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <h2 className="text-sm font-semibold">Today</h2>
            </div>
            {todayMetrics.length > 0 ? (
              <div className="space-y-3 border-t border-border px-5 py-4">
                {todayMetrics.map((metric) => (
                  <div key={metric.key} className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{metric.label}</p>
                      {metric.detail ? (
                        <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-foreground">{metric.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
                No activity recorded today.
              </p>
            )}
          </section>

          <section className="studio-card">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <h2 className="text-sm font-semibold">Recent Activity</h2>
            </div>
            {recentActivity.length > 0 ? (
              <div className="space-y-1 border-t border-border p-3">
                {recentActivity.map((activity) => (
                  <Link
                    key={activity.key}
                    href={activity.href}
                    className="block rounded-md px-3 py-2.5 transition hover:bg-muted/35"
                  >
                    <span className="block text-sm font-medium text-foreground">{activity.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {activity.detail} - {activity.timestamp}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
                No recent activity.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
