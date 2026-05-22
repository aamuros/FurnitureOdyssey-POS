import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import {
  PAGE_SIZE,
  activeDeliveryStatuses,
  buildOrderWhere,
  canAccessReportView,
  orderDeliveryStatuses,
  orderListSelect,
  overviewOrderWhere,
  overviewOutstandingBalanceAggregateArgs,
  overviewSalesAggregateArgs,
  parseReportFilters,
  paymentStatuses,
  reportViews,
  statusOptionsForView,
  unfinishedOrderWhere,
  type ReportPermissions,
  type ReportSearchParams,
  type ReportView
} from "@/lib/sales-history/reporting";

type SalesHistoryPageProps = {
  searchParams?: Promise<ReportSearchParams>;
};

type Permissions = ReportPermissions;

type FilterVisibility = {
  showSearch: boolean;
  showStatus: boolean;
  showPaymentStatus: boolean;
  showDeliveryStatus: boolean;
  showHasBalance: boolean;
  showOverdueOnly: boolean;
};

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value ?? 0));
}

function labelFromEnum(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSummaryDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000+08:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function statusTone(status: string | null | undefined) {
  if (["ACCEPTED", "PAID", "DELIVERED", "COMPLETED", "RECORDED", "GENERATED"].includes(status ?? "")) {
    return "success" as const;
  }

  if (
    [
      "DRAFT",
      "SENT",
      "PARTIALLY_PAID",
      "PARTIALLY_DELIVERED",
      "DOWNPAYMENT_PAID",
      "BALANCE_DUE_ON_DELIVERY",
      "NOT_SCHEDULED",
      "PLANNED"
    ].includes(status ?? "")
  ) {
    return "warning" as const;
  }

  if (["CONFIRMED", "SCHEDULED", "SCHEDULED_FOR_DELIVERY", "IN_TRANSIT"].includes(status ?? "")) {
    return "teal" as const;
  }

  if (["DECLINED", "CANCELLED", "FAILED", "VOIDED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(status ?? "")) {
    return "danger" as const;
  }

  return "neutral" as const;
}

function reportHref(view: ReportView) {
  return `/sales-history?view=${view}`;
}

function hasActiveReportFilters(params: ReportSearchParams, view: ReportView) {
  return Boolean(
    params.q ||
      params.status ||
      params.paymentStatus ||
      params.deliveryStatus ||
      params.staffId ||
      params.from ||
      params.to ||
      params.hasBalance ||
      params.overdueOnly ||
      (params.view !== undefined && params.view !== view)
  );
}

function paginationHref(searchParams: ReportSearchParams, page: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === "string" && value && key !== "page") {
      params.set(key, value);
    }
  }

  params.set("page", page.toString());
  return `/sales-history?${params.toString()}`;
}

function orderSnapshotCustomer(
  order: {
    customerDisplayNameSnapshot: string;
    companyNameSnapshot: string | null;
    contactPersonNameSnapshot: string | null;
  },
  canViewCustomers: boolean
) {
  if (!canViewCustomers) {
    return {
      primary: "Restricted",
      secondary: "Customer details hidden"
    };
  }

  return {
    primary: order.customerDisplayNameSnapshot,
    secondary: order.companyNameSnapshot ?? order.contactPersonNameSnapshot ?? ""
  };
}

function neededAction(order: {
  paymentStatus?: string;
  deliveryStatus: string;
  paymentDueDate?: Date | null;
  balanceAmount?: unknown;
  deliveries?: Array<{ scheduledDate: Date | null }>;
}) {
  const now = new Date();

  if (order.paymentDueDate && order.paymentDueDate < now && order.paymentStatus !== "PAID") {
    return "Payment overdue";
  }

  if (Number(order.balanceAmount ?? 0) > 0) {
    return "Balance still open";
  }

  if (order.paymentStatus && order.paymentStatus !== "PAID") {
    return "Payment follow-up";
  }

  if (order.deliveryStatus === "NOT_SCHEDULED") {
    return "Delivery not scheduled";
  }

  if (order.deliveryStatus === "PARTIALLY_DELIVERED") {
    return "Delivery partially completed";
  }

  if (order.deliveries?.[0]?.scheduledDate && order.deliveries[0].scheduledDate < now) {
    return "Delivery overdue";
  }

  if (order.deliveryStatus === "SCHEDULED" || order.deliveries?.[0]?.scheduledDate) {
    return "Delivery scheduled";
  }

  return "Operational review";
}

function filterVisibilityForView(view: ReportView, permissions: Permissions): FilterVisibility {
  return {
    showSearch: view !== "overview",
    showStatus: view === "orders",
    showPaymentStatus: permissions.canViewPayments && ["unfinished", "balances", "orders"].includes(view),
    showDeliveryStatus: ["unfinished", "orders"].includes(view),
    showHasBalance: permissions.canViewPayments && view === "orders",
    showOverdueOnly: view === "unfinished" && (permissions.canViewPayments || permissions.canViewDeliveries)
  };
}

function RestrictedPanel({ title }: { title: string }) {
  return (
    <section className="studio-empty px-5 py-8 text-sm">
      You do not have permission to view {title.toLowerCase()}.
    </section>
  );
}

export default async function SalesHistoryPage({ searchParams }: SalesHistoryPageProps) {
  const user = await requirePermission("SALES_HISTORY", "VIEW");
  const params = (await searchParams) ?? {};
  const {
    view,
    query,
    status,
    paymentStatus,
    deliveryStatus,
    staffId,
    dateRange,
    page,
    hasBalance,
    overdueOnly
  } = parseReportFilters(params);

  const permissions: Permissions = {
    canViewQuotations: hasPermission(user, "QUOTATIONS", "VIEW"),
    canViewOrders: hasPermission(user, "ORDERS", "VIEW"),
    canViewPayments: hasPermission(user, "PAYMENTS", "VIEW"),
    canViewDeliveries: hasPermission(user, "DELIVERIES", "VIEW"),
    canViewCustomers: hasPermission(user, "CUSTOMERS", "VIEW"),
    canViewInquiries: hasPermission(user, "INQUIRIES", "VIEW"),
    canViewDocuments: hasPermission(user, "DOCUMENTS", "VIEW"),
    canExportDocuments: hasPermission(user, "DOCUMENTS", "EXPORT")
  };
  const filterVisibility = filterVisibilityForView(view, permissions);

  const activeQuery = filterVisibility.showSearch ? query : undefined;
  const activeStatus = filterVisibility.showStatus ? status : undefined;
  const activePaymentStatus = filterVisibility.showPaymentStatus ? paymentStatus : undefined;
  const activeDeliveryStatus = filterVisibility.showDeliveryStatus ? deliveryStatus : undefined;
  const activeHasBalance = filterVisibility.showHasBalance && (hasBalance || view === "balances");
  const activeOverdueOnly = filterVisibility.showOverdueOnly && overdueOnly;

  const staff = await prisma.userProfile.findMany({
    where: {
      status: "ACTIVE"
    },
    orderBy: {
      displayName: "asc"
    },
    select: {
      id: true,
      displayName: true
    }
  });

  const report = await getReportData({
    view,
    query: activeQuery,
    status: activeStatus,
    paymentStatus: activePaymentStatus,
    deliveryStatus: activeDeliveryStatus,
    staffId,
    dateRange,
    page,
    hasBalance: activeHasBalance,
    overdueOnly: activeOverdueOnly,
    permissions,
    params
  });

  return (
    <>
      <PageHeader
        title="Sales Reports"
        description="Track revenue, open balances, and orders that need follow-up."
      />

      <nav className="mb-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Sales report views">
        {reportViews.map((item) => {
          const active = item.value === view;

          return (
            <Link
              key={item.value}
              href={reportHref(item.value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                active
                  ? "border-border bg-soft-accent/70 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/35 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <ReportFilters
        view={view}
        params={params}
        staff={staff}
        filterVisibility={filterVisibility}
        selectedStaffId={staffId}
        hasBalance={activeHasBalance}
        overdueOnly={activeOverdueOnly}
      />

      {report}
    </>
  );
}

function ReportFilters({
  view,
  params,
  staff,
  filterVisibility,
  selectedStaffId,
  hasBalance,
  overdueOnly
}: {
  view: ReportView;
  params: ReportSearchParams;
  staff: Array<{ id: string; displayName: string }>;
  filterVisibility: FilterVisibility;
  selectedStaffId: string | undefined;
  hasBalance: boolean;
  overdueOnly: boolean;
}) {
  const {
    showSearch,
    showStatus,
    showPaymentStatus,
    showDeliveryStatus,
    showHasBalance,
    showOverdueOnly
  } = filterVisibility;
  const hasAdvancedFilters =
    showStatus || showPaymentStatus || showDeliveryStatus || showHasBalance || showOverdueOnly;
  const hasActiveFilters = hasActiveReportFilters(params, view);
  const hasActiveAdvancedFilters = Boolean(
    params.status || params.paymentStatus || params.deliveryStatus || params.hasBalance || params.overdueOnly
  );
  const isOverview = view === "overview";

  return (
    <form className="mb-3 space-y-2.5 rounded-lg border border-border bg-panel p-3">
      <input type="hidden" name="view" value={view} />
      <div
        className={cn(
          "grid items-center gap-2.5",
          showSearch
            ? "md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_180px_minmax(260px,300px)_112px_auto]"
            : "sm:grid-cols-[minmax(180px,220px)_minmax(260px,300px)_112px_auto]"
        )}
      >
        {showSearch ? (
          <Input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={searchPlaceholder(view)}
            aria-label={searchLabel(view)}
          />
        ) : null}
        <Select name="staffId" defaultValue={selectedStaffId ?? ""} aria-label={staffLabel(view)}>
          <option value="">{staffPlaceholder(view)}</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input name="from" type="date" defaultValue={params.from ?? ""} aria-label={fromDateLabel(view)} />
          <Input name="to" type="date" defaultValue={params.to ?? ""} aria-label={toDateLabel(view)} />
        </div>
        <Button type="submit" variant="secondary" className="w-full px-3">
          Apply
        </Button>
        <Link
          href={reportHref(view)}
          className="inline-flex min-h-10 items-center justify-center rounded-lg px-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted/50 hover:text-foreground sm:justify-start"
        >
          {hasActiveFilters ? "Clear" : "Reset"}
        </Link>
      </div>
      {isOverview ? <p className="text-xs text-muted-foreground">{filterSummary(staff, selectedStaffId, params)}</p> : null}
      {hasAdvancedFilters ? (
        <details open={hasActiveAdvancedFilters} className="border-t border-border pt-2.5">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground transition hover:text-foreground">
            Advanced filters
          </summary>
          <div className="mt-2.5 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {showStatus ? (
              <Select name="status" defaultValue={params.status ?? ""} aria-label={statusLabel(view)}>
                <option value="">{statusPlaceholder(view)}</option>
                {statusOptionsForView(view).map((option) => (
                  <option key={option} value={option}>
                    {labelFromEnum(option)}
                  </option>
                ))}
              </Select>
            ) : null}
            {showPaymentStatus ? (
              <Select name="paymentStatus" defaultValue={params.paymentStatus ?? ""} aria-label="Payment status">
                <option value="">Any payment status</option>
                {paymentStatuses.map((option) => (
                  <option key={option} value={option}>
                    {labelFromEnum(option)}
                  </option>
                ))}
              </Select>
            ) : null}
            {showDeliveryStatus ? (
              <Select name="deliveryStatus" defaultValue={params.deliveryStatus ?? ""} aria-label="Delivery status">
                <option value="">Any delivery status</option>
                {orderDeliveryStatuses.map((option) => (
                  <option key={option} value={option}>
                    {labelFromEnum(option)}
                  </option>
                ))}
              </Select>
            ) : null}
            {showHasBalance ? (
              <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-panel px-3 text-sm text-muted-foreground">
                <input name="hasBalance" type="checkbox" defaultChecked={hasBalance} />
                Has balance
              </label>
            ) : null}
            {showOverdueOnly ? (
              <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-panel px-3 text-sm text-muted-foreground">
                <input name="overdueOnly" type="checkbox" defaultChecked={overdueOnly} />
                Overdue only
              </label>
            ) : null}
          </div>
        </details>
      ) : null}
    </form>
  );
}

function filterSummary(
  staff: Array<{ id: string; displayName: string }>,
  selectedStaffId: string | undefined,
  params: ReportSearchParams
) {
  const staffName = selectedStaffId
    ? staff.find((member) => member.id === selectedStaffId)?.displayName ?? "Selected staff"
    : "all staff";
  const from = formatSummaryDate(params.from);
  const to = formatSummaryDate(params.to);
  let dateLabel = "All dates";

  if (from && to) {
    dateLabel = `${from} – ${to}`;
  } else if (from) {
    dateLabel = `From ${from}`;
  } else if (to) {
    dateLabel = `Until ${to}`;
  }

  return `Showing ${staffName} · ${dateLabel}`;
}

function searchPlaceholder(view: ReportView) {
  if (view === "balances") {
    return "Search order, customer, or item";
  }

  return "Search customer, order, contact, item, or reference";
}

function searchLabel(view: ReportView) {
  void view;
  return "Search report rows";
}

function statusLabel(view: ReportView) {
  void view;
  return "Order status";
}

function statusPlaceholder(view: ReportView) {
  void view;
  return "Any order status";
}

function staffLabel(view: ReportView) {
  void view;
  return "Staff";
}

function staffPlaceholder(view: ReportView) {
  void view;
  return "Any staff";
}

function fromDateLabel(view: ReportView) {
  if (view === "balances") {
    return "Due date from";
  }

  return "Date from";
}

function toDateLabel(view: ReportView) {
  if (view === "balances") {
    return "Due date to";
  }

  return "Date to";
}

async function getReportData({
  view,
  query,
  status,
  paymentStatus,
  deliveryStatus,
  staffId,
  dateRange,
  page,
  hasBalance,
  overdueOnly,
  permissions,
  params
}: {
  view: ReportView;
  query: string | undefined;
  status: string | undefined;
  paymentStatus: string | undefined;
  deliveryStatus: string | undefined;
  staffId: string | undefined;
  dateRange: { gte?: Date; lte?: Date } | undefined;
  page: number;
  hasBalance: boolean;
  overdueOnly: boolean;
  permissions: Permissions;
  params: Awaited<NonNullable<SalesHistoryPageProps["searchParams"]>>;
}) {
  if (view === "overview") {
    return getOverviewReport({ dateRange, staffId, permissions });
  }

  if (!canAccessReportView(view, permissions)) {
    return <RestrictedPanel title={restrictedTitle(view)} />;
  }

  const orderWhere = buildOrderWhere({
    query,
    status,
    paymentStatus,
    deliveryStatus,
    staffId,
    dateRange,
    dateField: view === "balances" ? "paymentDueDate" : "createdAt",
    hasBalance,
    unfinishedOnly: view === "unfinished",
    overdueOnly,
    canUsePaymentFields: permissions.canViewPayments,
    canUseDeliveryFields: permissions.canViewDeliveries
  });

  if (view === "balances") {
    return getBalancesReport({ orderWhere, page, permissions, params });
  }

  return getOrderReport({
    orderWhere,
    page,
    permissions,
    params,
    title: view === "unfinished" ? "Orders Needing Action" : "Sales Ledger",
    mode: view
  });
}

function restrictedTitle(view: ReportView) {
  if (view === "balances") {
    return "outstanding balances";
  }

  return "order reports";
}

async function getOverviewReport({
  dateRange,
  staffId,
  permissions
}: {
  dateRange: { gte?: Date; lte?: Date } | undefined;
  staffId: string | undefined;
  permissions: Permissions;
}) {
  const orderDateWhere = overviewOrderWhere({ dateRange, staffId });

  const paymentDateWhere: Prisma.PaymentWhereInput = {
    receivedById: staffId,
    paymentDate: dateRange
  };

  const deliveryDateWhere: Prisma.DeliveryWhereInput = {
    assignedStaffId: staffId,
    scheduledDate: dateRange
  };

  const [
    totalOrders,
    unfinishedOrders,
    salesTotals,
    outstandingBalance,
    paymentCount,
    scheduledDeliveryCount
  ] = await Promise.all([
    permissions.canViewOrders ? prisma.order.count({ where: orderDateWhere }) : 0,
    permissions.canViewOrders
      ? prisma.order.count({ where: { AND: [orderDateWhere, unfinishedOrderWhere()] } })
      : 0,
    permissions.canViewPayments
      ? prisma.order.aggregate(overviewSalesAggregateArgs(orderDateWhere))
      : null,
    permissions.canViewPayments
      ? prisma.order.aggregate(overviewOutstandingBalanceAggregateArgs(orderDateWhere))
      : null,
    permissions.canViewPayments ? prisma.payment.count({ where: paymentDateWhere }) : 0,
    permissions.canViewDeliveries
      ? prisma.delivery.count({
          where: {
            ...deliveryDateWhere,
            status: {
              in: [...activeDeliveryStatuses]
            }
          }
        })
      : 0,
  ]);
  const salesTotal = Number(salesTotals?._sum.totalAmount ?? 0);

  return (
    <ReportSection
      title="Overview"
      description="Daily snapshot of orders, balances, payments, and deliveries."
      showHeader={false}
    >
      <div className="space-y-4 p-4">
        <OverviewMetricGrid>
          <OverviewMetricCard
            label="Orders Needing Action"
            value={permissions.canViewOrders ? unfinishedOrders.toString() : "Restricted"}
            helper="Payment, delivery, or follow-up pending"
            href={permissions.canViewOrders ? "/sales-history?view=unfinished" : undefined}
            primary
          />
          <OverviewMetricCard
            label="Outstanding Balance"
            value={
              permissions.canViewPayments ? formatMoney(outstandingBalance?._sum.balanceAmount ?? 0) : "Restricted"
            }
            helper="Customer balances still open"
            href={permissions.canViewPayments ? "/sales-history?view=balances" : undefined}
            primary
          />
          <OverviewMetricCard
            label="Scheduled Deliveries"
            value={permissions.canViewDeliveries ? scheduledDeliveryCount.toString() : "Restricted"}
            helper="Active delivery records"
            href={permissions.canViewDeliveries ? "/deliveries" : undefined}
          />
          <OverviewMetricCard
            label="Payment Records"
            value={permissions.canViewPayments ? paymentCount.toString() : "Restricted"}
            helper="Recorded in the selected range"
            href={permissions.canViewPayments ? "/payments" : undefined}
          />
          <OverviewMetricCard
            label="Total Orders"
            value={permissions.canViewOrders ? totalOrders.toString() : "Restricted"}
            helper="Saved orders in range"
            href={permissions.canViewOrders ? "/sales-history?view=orders" : undefined}
          />
          <OverviewMetricCard
            label="Sales Total"
            value={permissions.canViewPayments ? formatMoney(salesTotal) : "Restricted"}
            helper="Order total in range"
          />
        </OverviewMetricGrid>
      </div>
    </ReportSection>
  );
}

async function getBalancesReport({
  orderWhere,
  page,
  permissions,
  params
}: {
  orderWhere: Prisma.OrderWhereInput;
  page: number;
  permissions: Permissions;
  params: Awaited<NonNullable<SalesHistoryPageProps["searchParams"]>>;
}) {
  const orders = await prisma.order.findMany({
    where: {
      AND: [
        orderWhere,
        {
          status: {
            not: "CANCELLED"
          },
          balanceAmount: {
            gt: 0
          }
        }
      ]
    },
    orderBy: [{ paymentDueDate: "asc" }, { updatedAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    select: orderListSelect(permissions)
  });
  const hasNext = orders.length > PAGE_SIZE;

  return (
    <ReportSection title="Outstanding Balances" description="Orders with remaining customer balances.">
      <OrderTable orders={orders.slice(0, PAGE_SIZE)} mode="balances" permissions={permissions} />
      <Pagination page={page} hasNext={hasNext} params={params} />
    </ReportSection>
  );
}

async function getOrderReport({
  orderWhere,
  page,
  permissions,
  params,
  title,
  mode
}: {
  orderWhere: Prisma.OrderWhereInput;
  page: number;
  permissions: Permissions;
  params: Awaited<NonNullable<SalesHistoryPageProps["searchParams"]>>;
  title: string;
  mode: "orders" | "unfinished";
}) {
  const orders = await prisma.order.findMany({
    where: orderWhere,
    orderBy: mode === "unfinished" ? { updatedAt: "desc" } : { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    select: orderListSelect(permissions)
  });
  const hasNext = orders.length > PAGE_SIZE;

  return (
    <ReportSection
      title={title}
      description={
        mode === "unfinished"
          ? "Orders that still need payment, delivery, or follow-up."
          : "Saved order history with customer and status context."
      }
    >
      <OrderTable orders={orders.slice(0, PAGE_SIZE)} mode={mode} permissions={permissions} />
      <Pagination page={page} hasNext={hasNext} params={params} />
    </ReportSection>
  );
}

type OrderListRow = {
  id: string;
  orderNumber: string | null;
  customerDisplayNameSnapshot: string;
  companyNameSnapshot: string | null;
  contactPersonNameSnapshot: string | null;
  status: string;
  deliveryStatus: string;
  paymentStatus?: string;
  paymentDueTiming?: string | null;
  paymentDueDate?: Date | null;
  totalAmount?: unknown;
  paidAmount?: unknown;
  balanceAmount?: unknown;
  lastPaymentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deliveries?: Array<{ scheduledDate: Date | null }>;
};

function OrderTable({
  orders,
  mode,
  permissions
}: {
  orders: OrderListRow[];
  mode: "orders" | "unfinished" | "balances";
  permissions: Permissions;
}) {
  const showPaymentColumns = permissions.canViewPayments;
  const isNeedsAction = mode === "unfinished";
  const isBalances = mode === "balances";
  const isLedger = mode === "orders";
  const showDeliverySchedule = permissions.canViewDeliveries && isNeedsAction;
  const minWidth = isLedger ? "min-w-[1140px]" : isBalances ? "min-w-[900px]" : "min-w-[1120px]";

  return (
    <>
      <table className={cn("studio-table w-full text-left text-sm", minWidth)}>
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <TableHead className={isNeedsAction ? "w-44 min-w-[11rem]" : "w-40 min-w-[10rem]"}>Order</TableHead>
            <TableHead className={isBalances ? "min-w-[15rem]" : "min-w-[16rem]"}>Customer</TableHead>
            {isBalances ? (
              <>
                {showPaymentColumns ? <TableHead align="right" className="w-32 min-w-[8rem]">Balance</TableHead> : null}
                {showPaymentColumns ? <TableHead className="w-36 min-w-[9rem]">Due date</TableHead> : null}
                {showPaymentColumns ? <TableHead className="w-44 min-w-[11rem]">Payment status</TableHead> : null}
                {showPaymentColumns ? <TableHead className="w-32 min-w-[8rem]">Last payment</TableHead> : null}
                <TableHead align="right" className="w-24 min-w-[6rem]">Invoice</TableHead>
              </>
            ) : (
              <>
                <TableHead className="w-36 min-w-[9rem]">Order Status</TableHead>
                {showPaymentColumns ? <TableHead className="w-44 min-w-[11rem]">Payment</TableHead> : null}
                <TableHead className="w-40 min-w-[10rem]">Delivery</TableHead>
                {isNeedsAction ? <TableHead className="min-w-[11rem]">Needed Action</TableHead> : null}
                {showPaymentColumns && isLedger ? <TableHead align="right" className="w-28 min-w-[7rem]">Total</TableHead> : null}
                {showPaymentColumns && isLedger ? <TableHead align="right" className="w-28 min-w-[7rem]">Paid</TableHead> : null}
                {showPaymentColumns ? <TableHead align="right" className="w-32 min-w-[8rem]">Balance</TableHead> : null}
                {showDeliverySchedule ? <TableHead className="w-32 min-w-[8rem]">Next Delivery</TableHead> : null}
                {isLedger ? <TableHead className="w-32 min-w-[8rem]">Created</TableHead> : null}
                <TableHead className="w-32 min-w-[8rem]">Updated</TableHead>
                <TableHead align="right" className="w-24 min-w-[6rem]">Invoice</TableHead>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {orders.map((order) => {
            const customer = orderSnapshotCustomer(order, permissions.canViewCustomers);
            const deliveries = "deliveries" in order ? (order.deliveries ?? []) : [];

            return (
              <tr key={order.id}>
                <TableCell className="whitespace-nowrap">
                  <Link href={`/orders?orderId=${order.id}`} className="whitespace-nowrap font-semibold text-primary hover:underline">
                    {order.orderNumber ?? "Not assigned"}
                  </Link>
                </TableCell>
                <TableCell className="min-w-0">
                  <div className="font-medium leading-5 text-foreground">{customer.primary}</div>
                  {customer.secondary ? (
                    <div className="text-xs leading-5 text-muted-foreground">{customer.secondary}</div>
                  ) : null}
                </TableCell>
                {isBalances ? (
                  <>
                    {showPaymentColumns ? <MoneyCell strong>{formatMoney(order.balanceAmount)}</MoneyCell> : null}
                    {showPaymentColumns ? (
                      <DateCell>
                        <div>{formatDate(order.paymentDueDate)}</div>
                        <div className="text-xs">{labelFromEnum(order.paymentDueTiming)}</div>
                      </DateCell>
                    ) : null}
                    {showPaymentColumns ? (
                      <StatusCell status={order.paymentStatus} />
                    ) : null}
                    {showPaymentColumns ? <DateCell>{formatDate(order.lastPaymentAt)}</DateCell> : null}
                    <InvoiceCell orderId={order.id} canExportDocuments={permissions.canExportDocuments} />
                  </>
                ) : (
                  <>
                    <StatusCell status={order.status} />
                    {showPaymentColumns ? (
                      <StatusCell status={order.paymentStatus} />
                    ) : null}
                    <StatusCell status={order.deliveryStatus} />
                    {isNeedsAction ? (
                      <TableCell className="font-medium leading-5 text-foreground">
                        {neededAction({
                          deliveryStatus: order.deliveryStatus,
                          deliveries,
                          paymentStatus: order.paymentStatus,
                          paymentDueDate: order.paymentDueDate,
                          balanceAmount: order.balanceAmount
                        })}
                      </TableCell>
                    ) : null}
                    {showPaymentColumns && isLedger ? <MoneyCell>{formatMoney(order.totalAmount)}</MoneyCell> : null}
                    {showPaymentColumns && isLedger ? <MoneyCell>{formatMoney(order.paidAmount)}</MoneyCell> : null}
                    {showPaymentColumns ? <MoneyCell strong={isNeedsAction}>{formatMoney(order.balanceAmount)}</MoneyCell> : null}
                    {showDeliverySchedule ? <DateCell>{formatDate(deliveries[0]?.scheduledDate)}</DateCell> : null}
                    {isLedger ? <DateCell>{formatDate(order.createdAt)}</DateCell> : null}
                    <DateCell>{formatDate(order.updatedAt)}</DateCell>
                    <InvoiceCell orderId={order.id} canExportDocuments={permissions.canExportDocuments} />
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <EmptyState show={orders.length === 0} label={orderEmptyLabel(mode)} />
    </>
  );
}

function orderEmptyLabel(mode: "orders" | "unfinished" | "balances") {
  if (mode === "unfinished") {
    return "No orders needing action match the current filters.";
  }

  if (mode === "balances") {
    return "No outstanding balances match the current filters.";
  }

  return "No orders match the current filters.";
}

function InvoiceCell({ orderId, canExportDocuments }: { orderId: string; canExportDocuments: boolean }) {
  return (
    <TableCell align="right" className="whitespace-nowrap">
      {canExportDocuments ? (
        <a
          href={`/api/documents/invoice/${orderId}`}
          className="font-medium text-muted-foreground transition hover:text-primary hover:underline"
        >
          Invoice
        </a>
      ) : (
        "Restricted"
      )}
    </TableCell>
  );
}

function StatusCell({ status }: { status: string | null | undefined }) {
  return (
    <TableCell>
      <div className="flex items-center">
        <span className="whitespace-nowrap">
          <StatusPill tone={statusTone(status)}>{labelFromEnum(status)}</StatusPill>
        </span>
      </div>
    </TableCell>
  );
}

function MoneyCell({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <TableCell
      align="right"
      className={cn("whitespace-nowrap tabular-nums", strong ? "font-semibold text-foreground" : "text-muted-foreground")}
    >
      {children}
    </TableCell>
  );
}

function DateCell({ children }: { children: React.ReactNode }) {
  return <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{children}</TableCell>;
}

function OverviewMetricGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

function OverviewMetricCard({
  label,
  value,
  helper,
  href,
  primary = false
}: {
  label: string;
  value: string;
  helper?: string;
  href?: string;
  primary?: boolean;
}) {
  const className = cn(
    "block min-h-24 rounded-lg border border-border/70 bg-background px-4 py-4 transition",
    primary ? "bg-soft-accent/30" : "bg-background",
    href ? "hover:border-primary/35 hover:bg-soft-accent/40" : ""
  );
  const content = (
    <>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p
        className={
          primary ? "mt-3 text-2xl font-semibold text-foreground" : "mt-2 text-xl font-semibold text-foreground"
        }
      >
        {value}
      </p>
      {helper ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p> : null}
    </>
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <section className={className}>{content}</section>
  );
}

function ReportSection({
  title,
  description,
  children,
  showHeader = true
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  showHeader?: boolean;
}) {
  return (
    <section className="studio-card">
      {showHeader ? (
        <div className="studio-card-header px-4 py-2.5">
          <h2 className="text-sm font-semibold leading-5">{title}</h2>
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      ) : null}
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function TableHead({
  children,
  className,
  align = "left"
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <th className={cn("px-4 py-2.5 font-medium leading-4", align === "right" && "text-right", className)}>
      {children}
    </th>
  );
}

function TableCell({
  children,
  className,
  align = "left"
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <td className={cn("px-4 py-2.5 align-top text-foreground", align === "right" && "text-right", className)}>
      {children}
    </td>
  );
}

function EmptyState({ show, label }: { show: boolean; label: string }) {
  return show ? <div className="px-5 py-8 text-sm text-muted-foreground">{label}</div> : null;
}

function Pagination({
  page,
  hasNext,
  params
}: {
  page: number;
  hasNext: boolean;
  params: Awaited<NonNullable<SalesHistoryPageProps["searchParams"]>>;
}) {
  if (page === 1 && !hasNext) {
    return null;
  }

  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
      <span>Page {page}</span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={paginationHref(params, page - 1)} className="rounded-md border border-border px-3 py-1 hover:bg-muted">
            Previous
          </Link>
        ) : null}
        {hasNext ? (
          <Link href={paginationHref(params, page + 1)} className="rounded-md border border-border px-3 py-1 hover:bg-muted">
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}
