"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { DynamicSearchInput } from "@/components/dashboard/dynamic-search-input";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { readableLabel } from "@/lib/orders/status-labels";
import { cn } from "@/lib/utils";

type OrderView = "all" | "needsAction" | "unfinished" | "hasBalance" | "scheduledDelivery";

type OrderFiltersProps = {
  query: string;
  selectedView: OrderView;
  orderStatus: string;
  paymentStatus: string;
  deliveryStatus: string;
  assignedStaffId: string;
  from: string;
  to: string;
  hasBalance: string;
  hasScheduledDelivery: string;
  canViewPayments: boolean;
  canViewDeliveries: boolean;
  hasActiveFilters: boolean;
  moreFiltersOpen: boolean;
  orderStatuses: string[];
  paymentStatuses: string[];
  deliveryStatuses: string[];
  staff: Array<{ id: string; displayName: string }>;
  views: Array<{ value: OrderView; label: string }>;
  profitValue: string;
  salesTotalValue: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function MetricBox({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <section className="min-h-24 rounded-lg border border-border/70 bg-soft-accent/30 px-4 py-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-3 text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p>
    </section>
  );
}

export function OrderFilters({
  query,
  selectedView,
  orderStatus,
  paymentStatus,
  deliveryStatus,
  assignedStaffId,
  from,
  to,
  hasBalance,
  hasScheduledDelivery,
  canViewPayments,
  canViewDeliveries,
  hasActiveFilters,
  moreFiltersOpen,
  orderStatuses,
  paymentStatuses,
  deliveryStatuses,
  staff,
  views,
  profitValue,
  salesTotalValue
}: OrderFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [detailsOpen, setDetailsOpen] = useState(moreFiltersOpen);

  function replaceParams(updates: Record<string, string>) {
    const nextParams = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    }

    nextParams.delete("page");
    const queryString = nextParams.toString();
    const href = queryString ? `${pathname}?${queryString}` : pathname;

    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  function updateFilterParam(key: string, value: string) {
    setDetailsOpen(true);
    replaceParams({ [key]: value });
  }

  function updateDateParam(key: "from" | "to", value: string) {
    if (value && !datePattern.test(value)) {
      return;
    }

    updateFilterParam(key, value);
  }

  function viewHref(view: OrderView) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (view === "all") {
      nextParams.delete("view");
    } else {
      nextParams.set("view", view);
    }

    nextParams.delete("hasBalance");
    nextParams.delete("hasScheduledDelivery");
    nextParams.delete("page");

    const queryString = nextParams.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }

  return (
    <section className="mb-5 space-y-3 rounded-lg border border-border bg-panel p-3 sm:p-4" aria-busy={isPending}>
      <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_minmax(180px,240px)_minmax(180px,240px)_auto]">
        <DynamicSearchInput
          name="q"
          defaultValue={query}
          placeholder="Search orders, customers, phone, item..."
          aria-label="Search orders"
        />
        <MetricBox label="Profit" value={profitValue} helper="Gross profit in current filter" />
        <MetricBox label="Sales Total" value={salesTotalValue} helper="Order total in current filter" />
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Select
            name="view"
            value={selectedView}
            aria-label="View orders"
            className="lg:hidden"
            onChange={(event) => {
              const view = event.target.value as OrderView;
              replaceParams({
                view: view === "all" ? "" : view,
                hasBalance: "",
                hasScheduledDelivery: ""
              });
            }}
          >
            {views.map((view) => (
              <option key={view.value} value={view.value}>
                {view.label}
              </option>
            ))}
          </Select>
          {hasActiveFilters ? (
            <Link
              href="/orders"
              className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted/60"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </div>

      <nav className="hidden items-center gap-2 overflow-x-auto lg:flex" aria-label="Order queue views">
        {views.map((view) => {
          const active = selectedView === view.value;

          return (
            <Link
              key={view.value}
              href={viewHref(view.value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-8 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                active
                  ? "border-border bg-soft-accent/70 text-foreground"
                  : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-muted/35 hover:text-foreground"
              )}
            >
              {view.label}
            </Link>
          );
        })}
      </nav>

      <details
        open={detailsOpen}
        className="border-t border-border pt-3"
        onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">More filters</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select
            name="orderStatus"
            value={orderStatus}
            aria-label="Order status"
            onChange={(event) => updateFilterParam("orderStatus", event.target.value)}
          >
            <option value="">Any order status</option>
            {orderStatuses.map((status) => (
              <option key={status} value={status}>
                {readableLabel(status)}
              </option>
            ))}
          </Select>
          {canViewPayments ? (
            <Select
              name="paymentStatus"
              value={paymentStatus}
              aria-label="Payment status"
              onChange={(event) => updateFilterParam("paymentStatus", event.target.value)}
            >
              <option value="">Any payment status</option>
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {readableLabel(status)}
                </option>
              ))}
            </Select>
          ) : null}
          {canViewDeliveries ? (
            <Select
              name="deliveryStatus"
              value={deliveryStatus}
              aria-label="Delivery status"
              onChange={(event) => updateFilterParam("deliveryStatus", event.target.value)}
            >
              <option value="">Any delivery status</option>
              {deliveryStatuses.map((status) => (
                <option key={status} value={status}>
                  {readableLabel(status)}
                </option>
              ))}
            </Select>
          ) : null}
          <Select
            name="assignedStaffId"
            value={assignedStaffId}
            onChange={(event) => updateFilterParam("assignedStaffId", event.target.value)}
          >
            <option value="">All staff</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </Select>
          <Input
            name="from"
            type="date"
            value={from}
            aria-label="Start date"
            onChange={(event) => updateDateParam("from", event.target.value)}
          />
          <Input
            name="to"
            type="date"
            value={to}
            aria-label="End date"
            onChange={(event) => updateDateParam("to", event.target.value)}
          />
          {canViewPayments ? (
            <Select
              name="hasBalance"
              value={hasBalance}
              onChange={(event) => updateFilterParam("hasBalance", event.target.value)}
            >
              <option value="">Any balance</option>
              <option value="yes">Has balance</option>
              <option value="no">No balance</option>
            </Select>
          ) : null}
          {canViewDeliveries ? (
            <Select
              name="hasScheduledDelivery"
              value={hasScheduledDelivery}
              onChange={(event) => updateFilterParam("hasScheduledDelivery", event.target.value)}
            >
              <option value="">Any schedule</option>
              <option value="yes">Scheduled delivery</option>
              <option value="no">Not scheduled</option>
            </Select>
          ) : null}
        </div>
      </details>
    </section>
  );
}
