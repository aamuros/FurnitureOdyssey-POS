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
import {
  PAGE_SIZE,
  activeDeliveryStatuses,
  buildOrderWhere,
  canAccessReportView,
  customerHistoryCountSelect,
  customerHistoryOrderSelect,
  deliveryStatuses,
  orderDeliveryStatuses,
  orderListSelect,
  overviewOrderWhere,
  overviewOutstandingBalanceAggregateArgs,
  overviewSalesAggregateArgs,
  parseReportFilters,
  paymentRecordStatuses,
  paymentStatuses,
  quotationSearchWhere,
  quotationStatuses,
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
  showHasDelivery: boolean;
  showCompletedOnly: boolean;
  showUnfinishedOnly: boolean;
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

function formatQuantity(value: unknown) {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 2
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

function customerName(
  value: {
    displayName?: string | null;
    companyName?: string | null;
    contactPersonName?: string | null;
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
    primary: value.displayName ?? "Unknown customer",
    secondary: value.companyName ?? value.contactPersonName ?? ""
  };
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

function addressLine(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const address = value as {
    addressLine?: unknown;
    city?: unknown;
    province?: unknown;
  };

  return [address.addressLine, address.city, address.province]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(", ");
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

  if (order.deliveries?.[0]?.scheduledDate && order.deliveries[0].scheduledDate < now) {
    return "Delivery overdue";
  }

  if (order.deliveryStatus === "SCHEDULED" || order.deliveries?.[0]?.scheduledDate) {
    return "Delivery scheduled";
  }

  if (order.deliveryStatus === "PARTIALLY_DELIVERED") {
    return "Delivery partially completed";
  }

  return "Operational review";
}

function filterVisibilityForView(view: ReportView, permissions: Permissions): FilterVisibility {
  return {
    showSearch: view !== "overview",
    showStatus: ["payments", "deliveries", "orders", "quotations"].includes(view),
    showPaymentStatus: permissions.canViewPayments && ["unfinished", "balances", "orders"].includes(view),
    showDeliveryStatus: ["unfinished", "orders"].includes(view),
    showHasBalance: permissions.canViewPayments && ["balances", "orders"].includes(view),
    showHasDelivery: permissions.canViewDeliveries && view === "orders",
    showCompletedOnly: view === "orders",
    showUnfinishedOnly: view === "orders",
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
    hasDelivery,
    completedOnly,
    unfinishedOnly,
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
  const activeHasDelivery = filterVisibility.showHasDelivery && hasDelivery;
  const activeCompletedOnly = filterVisibility.showCompletedOnly && completedOnly;
  const activeUnfinishedOnly = filterVisibility.showUnfinishedOnly && unfinishedOnly;
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
    hasDelivery: activeHasDelivery,
    completedOnly: activeCompletedOnly,
    unfinishedOnly: activeUnfinishedOnly,
    overdueOnly: activeOverdueOnly,
    permissions,
    params
  });

  return (
    <>
      <PageHeader
        title="Sales History / Reports"
        description="Daily operations reports for orders, balances, payments, deliveries, quotations, and customers."
      />

      <nav className="mb-5 flex gap-2 overflow-x-auto border-b border-border pb-2">
        {reportViews.map((item) => (
          <Link
            key={item.value}
            href={reportHref(item.value)}
            className={
              item.value === view
                ? "whitespace-nowrap rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                : "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <ReportFilters
        view={view}
        params={params}
        staff={staff}
        filterVisibility={filterVisibility}
        selectedStaffId={staffId}
        hasBalance={activeHasBalance}
        hasDelivery={activeHasDelivery}
        completedOnly={activeCompletedOnly}
        unfinishedOnly={activeUnfinishedOnly}
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
  hasDelivery,
  completedOnly,
  unfinishedOnly,
  overdueOnly
}: {
  view: ReportView;
  params: ReportSearchParams;
  staff: Array<{ id: string; displayName: string }>;
  filterVisibility: FilterVisibility;
  selectedStaffId: string | undefined;
  hasBalance: boolean;
  hasDelivery: boolean;
  completedOnly: boolean;
  unfinishedOnly: boolean;
  overdueOnly: boolean;
}) {
  const {
    showSearch,
    showStatus,
    showPaymentStatus,
    showDeliveryStatus,
    showHasBalance,
    showHasDelivery,
    showCompletedOnly,
    showUnfinishedOnly,
    showOverdueOnly
  } = filterVisibility;
  const hasExtraFilters =
    showHasBalance || showHasDelivery || showCompletedOnly || showUnfinishedOnly || showOverdueOnly;
  const isOverview = view === "overview";

  return (
    <form className="mb-6 rounded-lg border border-border bg-panel p-4">
      <input type="hidden" name="view" value={view} />
      <div
        className={
          isOverview
            ? "grid gap-3 md:grid-cols-[minmax(220px,1fr)_160px_160px_auto_auto]"
            : "grid gap-3 md:grid-cols-2 xl:grid-cols-6"
        }
      >
        {showSearch ? (
          <Input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={searchPlaceholder(view)}
            aria-label={searchLabel(view)}
            className="xl:col-span-2"
          />
        ) : null}
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
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        <Link
          href={reportHref(view)}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-muted/60"
        >
          Reset
        </Link>
      </div>
      {isOverview ? <p className="mt-3 text-xs text-muted-foreground">{filterSummary(staff, selectedStaffId, params)}</p> : null}
      {hasExtraFilters ? (
        <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
          {showHasBalance ? (
            <label className="flex items-center gap-2">
              <input name="hasBalance" type="checkbox" defaultChecked={hasBalance} />
              Has balance
            </label>
          ) : null}
          {showHasDelivery ? (
            <label className="flex items-center gap-2">
              <input name="hasDelivery" type="checkbox" defaultChecked={hasDelivery} />
              Has delivery
            </label>
          ) : null}
          {showCompletedOnly ? (
            <label className="flex items-center gap-2">
              <input name="completedOnly" type="checkbox" defaultChecked={completedOnly} />
              Completed only
            </label>
          ) : null}
          {showUnfinishedOnly ? (
            <label className="flex items-center gap-2">
              <input name="unfinishedOnly" type="checkbox" defaultChecked={unfinishedOnly} />
              Needs action only
            </label>
          ) : null}
          {showOverdueOnly ? (
            <label className="flex items-center gap-2">
              <input name="overdueOnly" type="checkbox" defaultChecked={overdueOnly} />
              Overdue only
            </label>
          ) : null}
        </div>
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
  if (view === "payments") {
    return "Search receipt no., order, customer, reference, or payer";
  }

  if (view === "deliveries") {
    return "Search delivery no., order, customer, recipient, provider, or reference";
  }

  if (view === "quotations") {
    return "Search quotation, customer, inquiry, or item";
  }

  if (view === "customers") {
    return "Search customer, company, contact, phone, Viber, Facebook, or email";
  }

  return "Search customer, order, contact, item, or reference";
}

function searchLabel(view: ReportView) {
  return view === "customers" ? "Search customers" : "Search report rows";
}

function statusLabel(view: ReportView) {
  if (view === "payments") {
    return "Payment record status";
  }

  if (view === "deliveries") {
    return "Delivery status";
  }

  if (view === "quotations") {
    return "Quotation status";
  }

  return "Order status";
}

function statusPlaceholder(view: ReportView) {
  if (view === "payments") {
    return "Any payment record status";
  }

  if (view === "deliveries") {
    return "Active delivery statuses";
  }

  if (view === "quotations") {
    return "Any quotation status";
  }

  return "Any order status";
}

function staffLabel(view: ReportView) {
  if (view === "payments") {
    return "Received by";
  }

  if (view === "deliveries") {
    return "Assigned staff";
  }

  return "Staff";
}

function staffPlaceholder(view: ReportView) {
  if (view === "payments") {
    return "Any receiver";
  }

  if (view === "deliveries" || view === "customers") {
    return "Any assigned staff";
  }

  return "Any staff";
}

function fromDateLabel(view: ReportView) {
  if (view === "balances") {
    return "Due date from";
  }

  if (view === "payments") {
    return "Payment date from";
  }

  if (view === "deliveries") {
    return "Scheduled date from";
  }

  return "Date from";
}

function toDateLabel(view: ReportView) {
  if (view === "balances") {
    return "Due date to";
  }

  if (view === "payments") {
    return "Payment date to";
  }

  if (view === "deliveries") {
    return "Scheduled date to";
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
  hasDelivery,
  completedOnly,
  unfinishedOnly,
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
  hasDelivery: boolean;
  completedOnly: boolean;
  unfinishedOnly: boolean;
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

  if (view === "quotations") {
    return getQuotationReport({ query, status, staffId, dateRange, page, permissions, params });
  }

  if (view === "payments") {
    return getPaymentReport({ query, status, staffId, dateRange, page, permissions, params });
  }

  if (view === "deliveries") {
    return getDeliveryReport({ query, status, staffId, dateRange, page, permissions, params });
  }

  if (view === "customers") {
    return getCustomerReport({ query, staffId, dateRange, permissions });
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
    hasDelivery,
    completedOnly,
    unfinishedOnly: unfinishedOnly || view === "unfinished",
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
    title: view === "unfinished" ? "Orders Needing Action" : "Order History",
    mode: view
  });
}

function restrictedTitle(view: ReportView) {
  if (view === "payments") {
    return "payment history";
  }

  if (view === "balances") {
    return "outstanding balances";
  }

  if (view === "deliveries") {
    return "delivery schedule";
  }

  if (view === "quotations") {
    return "quotation history";
  }

  if (view === "customers") {
    return "customer sales history";
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
    confirmedOrders,
    otherActiveOrders,
    completedOrders,
    cancelledOrders,
    unfinishedOrders,
    ordersWithBalance,
    salesTotals,
    outstandingBalance,
    paymentCount,
    scheduledDeliveryCount,
    pendingDeliveryCount
  ] = await Promise.all([
    permissions.canViewOrders ? prisma.order.count({ where: orderDateWhere }) : 0,
    permissions.canViewOrders
      ? prisma.order.count({ where: { ...orderDateWhere, status: "CONFIRMED" } })
      : 0,
    permissions.canViewOrders
      ? prisma.order.count({
          where: {
            ...orderDateWhere,
            status: {
              notIn: ["CONFIRMED", "COMPLETED", "CANCELLED"]
            }
          }
        })
      : 0,
    permissions.canViewOrders
      ? prisma.order.count({ where: { ...orderDateWhere, status: "COMPLETED" } })
      : 0,
    permissions.canViewOrders
      ? prisma.order.count({ where: { ...orderDateWhere, status: "CANCELLED" } })
      : 0,
    permissions.canViewOrders
      ? prisma.order.count({ where: { AND: [orderDateWhere, unfinishedOrderWhere()] } })
      : 0,
    permissions.canViewPayments
      ? prisma.order.count({
          where: { ...orderDateWhere, status: { not: "CANCELLED" }, balanceAmount: { gt: 0 } }
        })
      : null,
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
    permissions.canViewDeliveries
      ? prisma.delivery.count({
          where: {
            ...deliveryDateWhere,
            status: {
              in: ["PLANNED", "SCHEDULED", "IN_TRANSIT"]
            }
          }
        })
      : 0
  ]);
  const salesTotal = Number(salesTotals?._sum.totalAmount ?? 0);

  return (
    <ReportSection
      title="Overview"
      description="Daily snapshot of orders, balances, payments, and deliveries."
    >
      <div className="space-y-6 p-5">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Priority</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              href={permissions.canViewDeliveries ? "/sales-history?view=deliveries" : undefined}
              primary
            />
            <OverviewMetricCard
              label="Payment Records"
              value={permissions.canViewPayments ? paymentCount.toString() : "Restricted"}
              helper="Recorded in the selected range"
              href={permissions.canViewPayments ? "/sales-history?view=payments" : undefined}
              primary
            />
          </div>
        </div>

        <div className="border-t border-border/70 pt-5">
          <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Order Status</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewMetricCard
              label="Total Orders"
              value={permissions.canViewOrders ? totalOrders.toString() : "Restricted"}
              helper={permissions.canViewPayments ? `Sales Total: ${formatMoney(salesTotal)}` : "Saved orders in range"}
              href={permissions.canViewOrders ? "/sales-history?view=orders" : undefined}
            />
            <OverviewMetricCard
              label="Confirmed Orders"
              value={permissions.canViewOrders ? confirmedOrders.toString() : "Restricted"}
              helper="Ready for payment or delivery work"
            />
            <OverviewMetricCard
              label="Other Active Orders"
              value={permissions.canViewOrders ? otherActiveOrders.toString() : "Restricted"}
              helper="Open statuses outside confirmed"
            />
            <OverviewMetricCard
              label="Completed Orders"
              value={permissions.canViewOrders ? completedOrders.toString() : "Restricted"}
              helper="Finished orders"
            />
            <OverviewMetricCard
              label="Cancelled Orders"
              value={permissions.canViewOrders ? cancelledOrders.toString() : "Restricted"}
              helper="Cancelled orders"
            />
            <OverviewMetricCard
              label="Orders With Balance"
              value={permissions.canViewPayments ? (ordersWithBalance ?? 0).toString() : "Restricted"}
              helper="Orders with customer balance"
            />
            <OverviewMetricCard
              label="Pending Deliveries"
              value={permissions.canViewDeliveries ? pendingDeliveryCount.toString() : "Restricted"}
              helper="Planned, scheduled, or in transit"
            />
          </div>
        </div>
      </div>
    </ReportSection>
  );
}

async function getQuotationReport({
  query,
  status,
  staffId,
  dateRange,
  page,
  permissions,
  params
}: {
  query: string | undefined;
  status: string | undefined;
  staffId: string | undefined;
  dateRange: { gte?: Date; lte?: Date } | undefined;
  page: number;
  permissions: Permissions;
  params: Awaited<NonNullable<SalesHistoryPageProps["searchParams"]>>;
}) {
  const search = quotationSearchWhere(query);
  const quotations = await prisma.quotation.findMany({
    where: {
      AND: [
        status && quotationStatuses.includes(status as never) ? { status: status as never } : {},
        staffId ? { createdById: staffId } : {},
        dateRange ? { createdAt: dateRange } : {},
        search ? { OR: search } : {}
      ]
    },
    orderBy: {
      updatedAt: "desc"
    },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    include: {
      customer: {
        select: {
          displayName: true,
          companyName: true,
          contactPersonName: true
        }
      },
      inquiry: permissions.canViewInquiries
        ? {
            select: {
              id: true,
              sourceReference: true,
              subject: true
            }
          }
        : false,
      order: permissions.canViewOrders
        ? {
            select: {
              id: true,
              orderNumber: true
            }
          }
        : false
    }
  });
  const hasNext = quotations.length > PAGE_SIZE;
  const rows = quotations.slice(0, PAGE_SIZE);

  return (
    <ReportSection title="Quotation History" description="Saved quotation history and conversion status.">
      <table className="w-full min-w-[1180px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <TableHead>Quotation</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Linked inquiry</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Subtotal</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Expiration</TableHead>
            <TableHead>Accepted</TableHead>
            <TableHead>Related order</TableHead>
            <TableHead>PDF</TableHead>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((quotation) => {
            const customer = customerName(quotation.customer, permissions.canViewCustomers);
            const inquiry = "inquiry" in quotation ? quotation.inquiry : null;
            const order = "order" in quotation ? quotation.order : null;

            return (
              <tr key={quotation.id}>
                <TableCell className="font-medium">
                  <Link href={`/quotations/${quotation.id}`} className="text-primary hover:underline">
                    {quotation.quotationNumber ?? "Not assigned"}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-foreground">{customer.primary}</div>
                  <div className="text-xs">{customer.secondary}</div>
                </TableCell>
                <TableCell>{inquiry?.sourceReference ?? inquiry?.subject ?? "Not linked"}</TableCell>
                <TableCell>
                  <StatusPill tone={statusTone(quotation.status)}>{labelFromEnum(quotation.status)}</StatusPill>
                </TableCell>
                <TableCell>{formatMoney(quotation.subtotalAmount)}</TableCell>
                <TableCell>{formatMoney(quotation.itemDiscountTotal)}</TableCell>
                <TableCell className="font-medium text-foreground">{formatMoney(quotation.totalAmount)}</TableCell>
                <TableCell>{formatDate(quotation.createdAt)}</TableCell>
                <TableCell>Not stored</TableCell>
                <TableCell>{quotation.status === "ACCEPTED" ? formatDate(quotation.updatedAt) : "Not accepted"}</TableCell>
                <TableCell>
                  {order ? (
                    <Link href={`/orders?orderId=${order.id}`} className="text-primary hover:underline">
                      {order.orderNumber ?? "Not assigned"}
                    </Link>
                  ) : (
                    "Not converted"
                  )}
                </TableCell>
                <TableCell>
                  {permissions.canExportDocuments ? (
                    <a href={`/api/documents/quotation/${quotation.id}`} className="text-primary hover:underline">
                      Download
                    </a>
                  ) : (
                    "Restricted"
                  )}
                </TableCell>
              </tr>
            );
          })}
        </tbody>
      </table>
      <EmptyState show={rows.length === 0} label="No quotations match the current filters." />
      <Pagination page={page} hasNext={hasNext} params={params} />
    </ReportSection>
  );
}

async function getPaymentReport({
  query,
  status,
  staffId,
  dateRange,
  page,
  permissions,
  params
}: {
  query: string | undefined;
  status: string | undefined;
  staffId: string | undefined;
  dateRange: { gte?: Date; lte?: Date } | undefined;
  page: number;
  permissions: Permissions;
  params: Awaited<NonNullable<SalesHistoryPageProps["searchParams"]>>;
}) {
  const payments = await prisma.payment.findMany({
    where: {
      status: paymentRecordStatuses.includes(status as never) ? (status as never) : undefined,
      receivedById: staffId,
      paymentDate: dateRange,
      OR: query
        ? [
            { paymentNumber: { contains: query, mode: "insensitive" } },
            { referenceNumber: { contains: query, mode: "insensitive" } },
            { payerName: { contains: query, mode: "insensitive" } },
            {
              customer: {
                OR: [
                  { displayName: { contains: query, mode: "insensitive" } },
                  { companyName: { contains: query, mode: "insensitive" } },
                  { contactPersonName: { contains: query, mode: "insensitive" } }
                ]
              }
            },
            {
              order: {
                orderNumber: { contains: query, mode: "insensitive" }
              }
            }
          ]
        : undefined
    },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    include: {
      customer: {
        select: {
          displayName: true,
          companyName: true,
          contactPersonName: true
        }
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          paymentStatus: true,
          balanceAmount: true
        }
      },
      receivedBy: {
        select: {
          displayName: true
        }
      },
      documents: permissions.canExportDocuments
        ? {
            where: {
              documentType: "PAYMENT_RECEIPT"
            },
            orderBy: {
              createdAt: "desc"
            },
            take: 1,
            select: {
              id: true
            }
          }
        : false
    }
  });
  const hasNext = payments.length > PAGE_SIZE;
  const rows = payments.slice(0, PAGE_SIZE);

  return (
    <ReportSection title="Payment History" description="Recorded payments and receipt references.">
      <table className="w-full min-w-[1180px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <TableHead>Payment date</TableHead>
            <TableHead>Receipt no.</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Payer</TableHead>
            <TableHead>Received by</TableHead>
            <TableHead>Receipt PDF</TableHead>
            <TableHead>Order balance</TableHead>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((payment) => {
            const customer = customerName(payment.customer, permissions.canViewCustomers);
            const hasReceipt = "documents" in payment && payment.documents.length > 0;

            return (
              <tr key={payment.id}>
                <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                <TableCell className="font-medium">{payment.paymentNumber ?? "Not assigned"}</TableCell>
                <TableCell>
                  <div className="font-medium text-foreground">{customer.primary}</div>
                  <div className="text-xs">{customer.secondary}</div>
                </TableCell>
                <TableCell>
                  <Link href={`/orders?orderId=${payment.order.id}`} className="font-medium text-primary hover:underline">
                    {payment.order.orderNumber ?? "Not assigned"}
                  </Link>
                </TableCell>
                <TableCell>{labelFromEnum(payment.paymentType)}</TableCell>
                <TableCell>{labelFromEnum(payment.method)}</TableCell>
                <TableCell className="font-medium text-foreground">{formatMoney(payment.amount)}</TableCell>
                <TableCell>{payment.referenceNumber ?? "None"}</TableCell>
                <TableCell>{payment.payerName ?? "Not set"}</TableCell>
                <TableCell>{payment.receivedBy?.displayName ?? "Not set"}</TableCell>
                <TableCell>
                  {permissions.canExportDocuments && hasReceipt ? (
                    <a href={`/api/documents/payment-receipt/${payment.id}`} className="text-primary hover:underline">
                      Download
                    </a>
                  ) : (
                    <span>{permissions.canExportDocuments ? "Not generated" : "Restricted"}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div>{formatMoney(payment.order.balanceAmount)}</div>
                  <StatusPill tone={statusTone(payment.order.paymentStatus)}>
                    {labelFromEnum(payment.order.paymentStatus)}
                  </StatusPill>
                </TableCell>
              </tr>
            );
          })}
        </tbody>
      </table>
      <EmptyState show={rows.length === 0} label="No payments match the current filters." />
      <Pagination page={page} hasNext={hasNext} params={params} />
    </ReportSection>
  );
}

async function getDeliveryReport({
  query,
  status,
  staffId,
  dateRange,
  page,
  permissions,
  params
}: {
  query: string | undefined;
  status: string | undefined;
  staffId: string | undefined;
  dateRange: { gte?: Date; lte?: Date } | undefined;
  page: number;
  permissions: Permissions;
  params: Awaited<NonNullable<SalesHistoryPageProps["searchParams"]>>;
}) {
  const deliveries = await prisma.delivery.findMany({
    where: {
      status: deliveryStatuses.includes(status as never) ? (status as never) : { in: [...activeDeliveryStatuses] },
      assignedStaffId: staffId,
      scheduledDate: dateRange,
      OR: query
        ? [
            { deliveryNumber: { contains: query, mode: "insensitive" } },
            { deliveryProviderName: { contains: query, mode: "insensitive" } },
            { deliveryProviderReference: { contains: query, mode: "insensitive" } },
            { recipientName: { contains: query, mode: "insensitive" } },
            {
              order: {
                OR: [
                  { orderNumber: { contains: query, mode: "insensitive" } },
                  { customerDisplayNameSnapshot: { contains: query, mode: "insensitive" } }
                ]
              }
            }
          ]
        : undefined
    },
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerDisplayNameSnapshot: true,
          companyNameSnapshot: true,
          contactPersonNameSnapshot: true
        }
      },
      assignedStaff: {
        select: {
          displayName: true
        }
      },
      items: {
        take: 6,
        include: {
          orderItem: {
            select: {
              itemName: true
            }
          }
        }
      },
      documents: permissions.canExportDocuments
        ? {
            where: {
              documentType: "DELIVERY_RECEIPT"
            },
            take: 1,
            select: {
              id: true
            }
          }
        : false
    }
  });
  const hasNext = deliveries.length > PAGE_SIZE;
  const rows = deliveries.slice(0, PAGE_SIZE);

  return (
    <ReportSection title="Delivery Schedule" description="Scheduled and pending deliveries.">
      <table className="w-full min-w-[1280px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <TableHead>Scheduled date</TableHead>
            <TableHead>DR no.</TableHead>
            <TableHead>Time window</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>DR PDF</TableHead>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((delivery) => {
            const customer = orderSnapshotCustomer(delivery.order, permissions.canViewCustomers);
            const hasReceipt = "documents" in delivery && delivery.documents.length > 0;

            return (
              <tr key={delivery.id}>
                <TableCell>{formatDate(delivery.scheduledDate)}</TableCell>
                <TableCell className="font-medium">{delivery.deliveryNumber ?? "Not assigned"}</TableCell>
                <TableCell>{delivery.scheduledTimeWindow ?? "No time window"}</TableCell>
                <TableCell>
                  <StatusPill tone={statusTone(delivery.status)}>{labelFromEnum(delivery.status)}</StatusPill>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-foreground">{customer.primary}</div>
                  <div className="text-xs">{customer.secondary}</div>
                </TableCell>
                <TableCell>
                  <Link href={`/orders?orderId=${delivery.order.id}`} className="text-primary hover:underline">
                    {delivery.order.orderNumber ?? "Not assigned"}
                  </Link>
                </TableCell>
                <TableCell>{delivery.recipientName ?? "Not set"}</TableCell>
                <TableCell>{delivery.recipientPhone ?? "Not set"}</TableCell>
                <TableCell className="max-w-[260px]">{addressLine(delivery.deliveryAddressSnapshot) ?? "No address"}</TableCell>
                <TableCell>
                  <div>{labelFromEnum(delivery.deliveryProviderType)}</div>
                  <div className="text-xs">{delivery.deliveryProviderName ?? "No provider name"}</div>
                </TableCell>
                <TableCell>{delivery.deliveryProviderReference ?? "No reference"}</TableCell>
                <TableCell>
                  {delivery.items.length > 0
                    ? delivery.items.map((item) => (
                        <div key={item.id}>
                          {item.orderItem.itemName}: {formatQuantity(item.quantityDelivered)}/
                          {formatQuantity(item.quantityPlanned)}
                        </div>
                      ))
                    : "No items"}
                </TableCell>
                <TableCell>{delivery.assignedStaff?.displayName ?? "Not set"}</TableCell>
                <TableCell>
                  {permissions.canExportDocuments && hasReceipt ? (
                    <a href={`/api/documents/delivery-receipt/${delivery.id}`} className="text-primary hover:underline">
                      Download
                    </a>
                  ) : (
                    <span>{permissions.canExportDocuments ? "Not generated" : "Restricted"}</span>
                  )}
                </TableCell>
              </tr>
            );
          })}
        </tbody>
      </table>
      <EmptyState
        show={rows.length === 0}
        label={
          status
            ? "No deliveries match the current filters."
            : "No active scheduled or planned deliveries match the current filters."
        }
      />
      <Pagination page={page} hasNext={hasNext} params={params} />
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

function salesWorkflowDetails(order: {
  needsAssembly: boolean;
  salesInvoiceRequested: boolean;
  modeOfDelivery: string | null;
  deliveryMethod: string | null;
  paymentTerms: string | null;
  specialInstructions: string | null;
}) {
  const delivery = [order.modeOfDelivery, order.deliveryMethod].filter(Boolean).join(" / ");

  return [
    `Assemble: ${order.needsAssembly ? "Yes" : "No"}`,
    `Sales invoice: ${order.salesInvoiceRequested ? "Requested" : "No"}`,
    delivery ? `Delivery: ${delivery}` : null,
    order.paymentTerms ? `Payment terms: ${order.paymentTerms}` : null,
    order.specialInstructions ? `Remarks: ${order.specialInstructions}` : null
  ].filter(Boolean);
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
  needsAssembly: boolean;
  salesInvoiceRequested: boolean;
  modeOfDelivery: string | null;
  deliveryMethod: string | null;
  paymentTerms: string | null;
  specialInstructions: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { displayName: string } | null;
  quotation?: { id: string; quotationNumber: string | null } | null;
  inquiry?: { id: string; sourceReference: string | null } | null;
  deliveries?: Array<{ scheduledDate: Date | null }>;
  _count: {
    payments?: number;
    deliveries?: number;
    documents?: number;
  };
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
  const showDeliverySchedule = permissions.canViewDeliveries;

  return (
    <>
      <table className="w-full min-w-[1320px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Assigned staff</TableHead>
            <TableHead>Order status</TableHead>
            {showPaymentColumns ? <TableHead>Payment status</TableHead> : null}
            <TableHead>Delivery status</TableHead>
            {mode === "unfinished" ? <TableHead>Needed action</TableHead> : null}
            {showPaymentColumns ? <TableHead>Total</TableHead> : null}
            {showPaymentColumns ? <TableHead>Paid</TableHead> : null}
            {showPaymentColumns ? <TableHead>Balance</TableHead> : null}
            {showPaymentColumns ? <TableHead>Last payment</TableHead> : null}
            {showDeliverySchedule ? <TableHead>Next delivery</TableHead> : null}
            {mode === "balances" ? <TableHead>Due timing</TableHead> : null}
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            {mode === "orders" ? <TableHead>Related refs</TableHead> : null}
            {mode === "orders" ? <TableHead>Counts</TableHead> : null}
            <TableHead>PDF</TableHead>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {orders.map((order) => {
            const customer = orderSnapshotCustomer(order, permissions.canViewCustomers);
            const quotation = "quotation" in order ? order.quotation : null;
            const inquiry = "inquiry" in order ? order.inquiry : null;
            const deliveries = "deliveries" in order ? (order.deliveries ?? []) : [];
            const salesDetails = salesWorkflowDetails(order);

            return (
              <tr key={order.id}>
                <TableCell>
                  <Link href={`/orders?orderId=${order.id}`} className="font-medium text-primary hover:underline">
                    {order.orderNumber ?? "Not assigned"}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-foreground">{customer.primary}</div>
                  <div className="text-xs">{customer.secondary}</div>
                </TableCell>
                <TableCell>{order.createdBy?.displayName ?? "Not set"}</TableCell>
                <TableCell>
                  <StatusPill tone={statusTone(order.status)}>{labelFromEnum(order.status)}</StatusPill>
                </TableCell>
                {showPaymentColumns ? (
                  <TableCell>
                    <StatusPill tone={statusTone(order.paymentStatus)}>
                      {labelFromEnum(order.paymentStatus)}
                    </StatusPill>
                  </TableCell>
                ) : null}
                <TableCell>
                  <StatusPill tone={statusTone(order.deliveryStatus)}>
                    {labelFromEnum(order.deliveryStatus)}
                  </StatusPill>
                </TableCell>
                {mode === "unfinished" ? (
                  <TableCell>
                    {neededAction({
                      deliveryStatus: order.deliveryStatus,
                      deliveries,
                      paymentStatus: order.paymentStatus,
                      paymentDueDate: order.paymentDueDate,
                      balanceAmount: order.balanceAmount
                    })}
                  </TableCell>
                ) : null}
                {showPaymentColumns ? <TableCell>{formatMoney(order.totalAmount)}</TableCell> : null}
                {showPaymentColumns ? <TableCell>{formatMoney(order.paidAmount)}</TableCell> : null}
                {showPaymentColumns ? <TableCell>{formatMoney(order.balanceAmount)}</TableCell> : null}
                {showPaymentColumns ? <TableCell>{formatDate(order.lastPaymentAt)}</TableCell> : null}
                {showDeliverySchedule ? <TableCell>{formatDate(deliveries[0]?.scheduledDate)}</TableCell> : null}
                {mode === "balances" ? (
                  <TableCell>
                    <div>{labelFromEnum(order.paymentDueTiming)}</div>
                    <div className="text-xs">Due {formatDate(order.paymentDueDate)}</div>
                  </TableCell>
                ) : null}
                <TableCell>{formatDate(order.createdAt)}</TableCell>
                <TableCell>{formatDate(order.updatedAt)}</TableCell>
                {mode === "orders" ? (
                  <TableCell>
                    <div>
                      Quotation{" "}
                      {quotation ? (
                        <Link href={`/quotations/${quotation.id}`} className="text-primary hover:underline">
                          {quotation.quotationNumber ?? "Not assigned"}
                        </Link>
                      ) : (
                        "None"
                      )}
                    </div>
                    <div className="text-xs">Inquiry {inquiry?.sourceReference ?? inquiry?.id?.slice(0, 8) ?? "None"}</div>
                    {salesDetails.map((detail) => (
                      <div key={detail} className="text-xs text-muted-foreground">
                        {detail}
                      </div>
                    ))}
                  </TableCell>
                ) : null}
                {mode === "orders" ? (
                  <TableCell>{orderCountSummary(order, permissions)}</TableCell>
                ) : null}
                <TableCell>
                  {permissions.canExportDocuments ? (
                    <a href={`/api/documents/invoice/${order.id}`} className="text-primary hover:underline">
                      Invoice
                    </a>
                  ) : (
                    "Restricted"
                  )}
                </TableCell>
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

function orderCountSummary(order: OrderListRow, permissions: Permissions) {
  const parts = [];

  if (permissions.canViewPayments) {
    parts.push(`${order._count.payments ?? 0} payment records`);
  }

  if (permissions.canViewDeliveries) {
    parts.push(`${order._count.deliveries ?? 0} deliveries`);
  }

  if (permissions.canViewDocuments || permissions.canExportDocuments) {
    parts.push(`${order._count.documents ?? 0} docs`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Restricted";
}

async function getCustomerReport({
  query,
  staffId,
  dateRange,
  permissions
}: {
  query: string | undefined;
  staffId: string | undefined;
  dateRange: { gte?: Date; lte?: Date } | undefined;
  permissions: Permissions;
}) {
  const customers = await prisma.customer.findMany({
    where: {
      archivedAt: null,
      assignedStaffId: staffId,
      createdAt: dateRange,
      OR: query
        ? [
            { displayName: { contains: query, mode: "insensitive" } },
            { companyName: { contains: query, mode: "insensitive" } },
            { contactPersonName: { contains: query, mode: "insensitive" } },
            {
              contacts: {
                some: {
                  value: { contains: query, mode: "insensitive" }
                }
              }
            }
          ]
        : undefined
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 30,
    include: {
      assignedStaff: {
        select: {
          displayName: true
        }
      },
      inquiries: permissions.canViewInquiries
        ? {
            orderBy: {
              updatedAt: "desc"
            },
            take: 3,
            select: {
              id: true,
              source: true,
              sourceReference: true,
              status: true,
              subject: true,
              updatedAt: true
            }
          }
        : false,
      quotations: permissions.canViewQuotations
        ? {
            orderBy: {
              updatedAt: "desc"
            },
            take: 3,
            select: {
              id: true,
              quotationNumber: true,
              status: true,
              totalAmount: true,
              createdAt: true,
              updatedAt: true
            }
          }
        : false,
      orders: permissions.canViewOrders
        ? {
            orderBy: {
              updatedAt: "desc"
            },
            take: 3,
            select: customerHistoryOrderSelect(permissions)
          }
        : false,
      payments: permissions.canViewPayments
        ? {
            orderBy: {
              paymentDate: "desc"
            },
            take: 3,
            select: {
              id: true,
              paymentNumber: true,
              paymentDate: true,
              paymentType: true,
              amount: true,
              method: true
            }
          }
        : false,
      _count: {
        select: customerHistoryCountSelect(permissions)
      }
    }
  });

  const deliveryByCustomer = permissions.canViewDeliveries
    ? await prisma.delivery.findMany({
        where: {
          order: {
            customerId: {
              in: customers.map((customer) => customer.id)
            }
          }
        },
        orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
        take: 90,
        select: {
          id: true,
          deliveryNumber: true,
          status: true,
          scheduledDate: true,
          order: {
            select: {
              customerId: true,
              orderNumber: true
            }
          }
        }
      })
    : [];

  const deliveriesByCustomerId = new Map<string, typeof deliveryByCustomer>();
  for (const delivery of deliveryByCustomer) {
    const current = deliveriesByCustomerId.get(delivery.order.customerId) ?? [];
    if (current.length < 3) {
      current.push(delivery);
      deliveriesByCustomerId.set(delivery.order.customerId, current);
    }
  }

  return (
    <ReportSection
      title="Customer Sales History"
      description="Customer-level sales activity summary."
    >
      <div className="divide-y divide-border">
        {customers.map((customer) => {
          const orders = "orders" in customer ? customer.orders : [];
          const quotations = "quotations" in customer ? customer.quotations : [];
          const inquiries = "inquiries" in customer ? customer.inquiries : [];
          const payments = "payments" in customer ? customer.payments : [];
          const deliveries = deliveriesByCustomerId.get(customer.id) ?? [];
          const outstandingBalance = permissions.canViewPayments
            ? orders.reduce((sum, order) => sum + Number(order.balanceAmount ?? 0), 0)
            : 0;

          return (
            <article key={customer.id} className="px-5 py-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Link href="/customers" className="font-semibold text-primary hover:underline">
                    {customer.displayName}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[customer.companyName, customer.contactPersonName, customer.assignedStaff?.displayName]
                      .filter(Boolean)
                      .join(" · ") || "No company or staff assignment"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Latest activity {formatDate(customer.updatedAt)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs text-muted-foreground sm:grid-cols-5">
                  <MiniCount label="Inquiries" value={permissions.canViewInquiries ? customer._count.inquiries ?? 0 : null} />
                  <MiniCount label="Quotes" value={permissions.canViewQuotations ? customer._count.quotations ?? 0 : null} />
                  <MiniCount label="Orders" value={permissions.canViewOrders ? customer._count.orders ?? 0 : null} />
                  <MiniCount label="Payment Records" value={permissions.canViewPayments ? customer._count.payments ?? 0 : null} />
                  <MiniCount
                    label="Balance"
                    value={permissions.canViewPayments ? formatMoney(outstandingBalance) : null}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-5">
                <CustomerHistoryBlock title="Inquiries" restricted={!permissions.canViewInquiries}>
                  {inquiries.map((inquiry) => (
                    <CompactRow key={inquiry.id} title={inquiry.subject} meta={`${labelFromEnum(inquiry.status)} · ${inquiry.sourceReference ?? labelFromEnum(inquiry.source)}`} />
                  ))}
                  <EmptyInline show={inquiries.length === 0} label="No visible inquiries" />
                </CustomerHistoryBlock>
                <CustomerHistoryBlock title="Quotations" restricted={!permissions.canViewQuotations}>
                  {quotations.map((quotation) => (
                    <CompactRow
                      key={quotation.id}
                      title={quotation.quotationNumber ?? "Not assigned"}
                      meta={`${labelFromEnum(quotation.status)} · ${formatMoney(quotation.totalAmount)}`}
                      href={`/quotations/${quotation.id}`}
                    />
                  ))}
                  <EmptyInline show={quotations.length === 0} label="No visible quotations" />
                </CustomerHistoryBlock>
                <CustomerHistoryBlock title="Orders" restricted={!permissions.canViewOrders}>
                  {orders.map((order) => (
                    <CompactRow
                      key={order.id}
                      title={order.orderNumber ?? "Not assigned"}
                      meta={`${labelFromEnum(order.status)} · ${labelFromEnum(order.deliveryStatus)}${
                        permissions.canViewPayments ? ` · Balance ${formatMoney(order.balanceAmount ?? 0)}` : ""
                      }`}
                      href={`/orders?orderId=${order.id}`}
                    />
                  ))}
                  <EmptyInline show={orders.length === 0} label="No visible orders" />
                </CustomerHistoryBlock>
                <CustomerHistoryBlock title="Payments" restricted={!permissions.canViewPayments}>
                  {payments.map((payment) => (
                    <CompactRow
                      key={payment.id}
                      title={payment.paymentNumber ?? "Not assigned"}
                      meta={`${labelFromEnum(payment.paymentType)} · ${formatMoney(payment.amount)}`}
                      href={permissions.canExportDocuments ? `/api/documents/payment-receipt/${payment.id}` : undefined}
                    />
                  ))}
                  <EmptyInline show={payments.length === 0} label="No visible payments" />
                </CustomerHistoryBlock>
                <CustomerHistoryBlock title="Deliveries" restricted={!permissions.canViewDeliveries}>
                  {deliveries.map((delivery) => (
                    <CompactRow
                      key={delivery.id}
                      title={delivery.deliveryNumber ?? "Not assigned"}
                      meta={`${delivery.order.orderNumber ?? "Order"} · ${labelFromEnum(delivery.status)}`}
                      href={permissions.canExportDocuments ? `/api/documents/delivery-receipt/${delivery.id}` : undefined}
                    />
                  ))}
                  <EmptyInline show={deliveries.length === 0} label="No visible deliveries" />
                </CustomerHistoryBlock>
              </div>
            </article>
          );
        })}
      </div>
      <EmptyState show={customers.length === 0} label="No customers match the current filters." />
    </ReportSection>
  );
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
  const className = [
    "block rounded-lg border border-border/70 bg-background px-5 transition",
    primary ? "min-h-32 py-5" : "min-h-28 py-4",
    href ? "hover:border-primary/35 hover:bg-soft-accent/30" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className={primary ? "mt-4 text-3xl font-semibold text-foreground" : "mt-3 text-2xl font-semibold text-foreground"}>
        {value}
      </p>
      {helper ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{helper}</p> : null}
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
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="studio-card">
      <div className="studio-card-header">
        <p className="studio-kicker">Sales History</p>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function CustomerHistoryBlock({
  title,
  restricted,
  children
}: {
  title: string;
  restricted: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border p-3 text-sm">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
      <div className="mt-2 space-y-2">
        {restricted ? <p className="text-xs text-muted-foreground">Restricted</p> : children}
      </div>
    </section>
  );
}

function CompactRow({ title, meta, href }: { title: string; meta: string; href?: string }) {
  return (
    <div>
      {href?.startsWith("/api/") ? (
        <a href={href} className="font-medium text-primary hover:underline">
          {title}
        </a>
      ) : href ? (
        <Link href={href} className="font-medium text-primary hover:underline">
          {title}
        </Link>
      ) : (
        <div className="font-medium text-foreground">{title}</div>
      )}
      <div className="text-xs text-muted-foreground">{meta}</div>
    </div>
  );
}

function MiniCount({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="rounded-md border border-border px-2 py-1">
      <div className="font-semibold text-foreground">{value ?? "-"}</div>
      <div>{label}</div>
    </div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 font-medium">{children}</th>;
}

function TableCell({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-5 py-3 align-top text-muted-foreground ${className}`}>{children}</td>;
}

function EmptyState({ show, label }: { show: boolean; label: string }) {
  return show ? <div className="px-5 py-8 text-sm text-muted-foreground">{label}</div> : null;
}

function EmptyInline({ show, label }: { show: boolean; label: string }) {
  return show ? <p className="text-xs text-muted-foreground">{label}</p> : null;
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
