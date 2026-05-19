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

type ReportView =
  | "overview"
  | "unfinished"
  | "balances"
  | "payments"
  | "deliveries"
  | "orders"
  | "quotations"
  | "customers";

type SalesHistoryPageProps = {
  searchParams?: Promise<{
    view?: string;
    q?: string;
    status?: string;
    paymentStatus?: string;
    deliveryStatus?: string;
    staffId?: string;
    from?: string;
    to?: string;
    hasBalance?: string;
    hasDelivery?: string;
    completedOnly?: string;
    unfinishedOnly?: string;
    page?: string;
  }>;
};

type ReportSearchParams = Awaited<NonNullable<SalesHistoryPageProps["searchParams"]>>;

type Permissions = {
  canViewQuotations: boolean;
  canViewOrders: boolean;
  canViewPayments: boolean;
  canViewDeliveries: boolean;
  canViewCustomers: boolean;
  canViewInquiries: boolean;
  canExportDocuments: boolean;
};

const PAGE_SIZE = 50;

const reportViews: Array<{ value: ReportView; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "unfinished", label: "Unfinished Sales" },
  { value: "balances", label: "Outstanding Balances" },
  { value: "payments", label: "Payment History" },
  { value: "deliveries", label: "Delivery Schedule" },
  { value: "orders", label: "Order History" },
  { value: "quotations", label: "Quotation History" },
  { value: "customers", label: "Customer Sales History" }
];

const orderStatuses = [
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_PAID",
  "PAID",
  "SCHEDULED_FOR_DELIVERY",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED"
] as const;

const quotationStatuses = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "CANCELLED"] as const;

const paymentStatuses = [
  "UNPAID",
  "DOWNPAYMENT_PAID",
  "PARTIALLY_PAID",
  "BALANCE_DUE_ON_DELIVERY",
  "PAID",
  "REFUNDED",
  "PARTIALLY_REFUNDED"
] as const;

const orderDeliveryStatuses = [
  "NOT_SCHEDULED",
  "SCHEDULED",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "CANCELLED"
] as const;

const deliveryStatuses = [
  "PLANNED",
  "SCHEDULED",
  "IN_TRANSIT",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "FAILED",
  "CANCELLED"
] as const;

function asReportView(value: string | undefined): ReportView {
  if (value === "sales") {
    return "overview";
  }

  return reportViews.some((view) => view.value === value) ? (value as ReportView) : "overview";
}

function cleanSearch(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 100) : undefined;
}

function cleanSelect(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+08:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateRangeWhere(from: Date | undefined, to: Date | undefined) {
  return from || to
    ? {
        gte: from,
        lte: to
      }
    : undefined;
}

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

function statusTone(status: string | null | undefined) {
  if (["ACCEPTED", "PAID", "DELIVERED", "COMPLETED", "RECORDED", "GENERATED"].includes(status ?? "")) {
    return "success" as const;
  }

  if (
    [
      "DRAFT",
      "SENT",
      "CONFIRMED",
      "PARTIALLY_PAID",
      "SCHEDULED",
      "SCHEDULED_FOR_DELIVERY",
      "PARTIALLY_DELIVERED",
      "DOWNPAYMENT_PAID",
      "BALANCE_DUE_ON_DELIVERY",
      "NOT_SCHEDULED",
      "PLANNED",
      "IN_TRANSIT"
    ].includes(status ?? "")
  ) {
    return "warning" as const;
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

function orderSearchWhere(query: string | undefined): Prisma.OrderWhereInput[] | undefined {
  if (!query) {
    return undefined;
  }

  return [
    { orderNumber: { contains: query, mode: "insensitive" } },
    { customerDisplayNameSnapshot: { contains: query, mode: "insensitive" } },
    { companyNameSnapshot: { contains: query, mode: "insensitive" } },
    { contactPersonNameSnapshot: { contains: query, mode: "insensitive" } },
    {
      inquiry: {
        sourceReference: { contains: query, mode: "insensitive" }
      }
    },
    {
      items: {
        some: {
          OR: [
            { itemName: { contains: query, mode: "insensitive" } },
            { snapshotProductCode: { contains: query, mode: "insensitive" } }
          ]
        }
      }
    }
  ];
}

function quotationSearchWhere(query: string | undefined): Prisma.QuotationWhereInput[] | undefined {
  if (!query) {
    return undefined;
  }

  return [
    { quotationNumber: { contains: query, mode: "insensitive" } },
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
      inquiry: {
        sourceReference: { contains: query, mode: "insensitive" }
      }
    },
    {
      items: {
        some: {
          itemName: { contains: query, mode: "insensitive" }
        }
      }
    }
  ];
}

function unfinishedOrderWhere(): Prisma.OrderWhereInput {
  return {
    status: {
      notIn: ["COMPLETED", "CANCELLED"]
    },
    OR: [
      {
        balanceAmount: {
          gt: 0
        }
      },
      {
        paymentStatus: {
          not: "PAID"
        }
      },
      {
        deliveryStatus: {
          in: ["NOT_SCHEDULED", "SCHEDULED", "PARTIALLY_DELIVERED"]
        }
      },
      {
        deliveries: {
          some: {
            status: {
              in: ["PLANNED", "SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED"]
            }
          }
        }
      }
    ]
  };
}

function buildOrderWhere({
  query,
  status,
  paymentStatus,
  deliveryStatus,
  staffId,
  createdDateRange,
  hasBalance,
  hasDelivery,
  completedOnly,
  unfinishedOnly
}: {
  query: string | undefined;
  status: string | undefined;
  paymentStatus: string | undefined;
  deliveryStatus: string | undefined;
  staffId: string | undefined;
  createdDateRange: { gte?: Date; lte?: Date } | undefined;
  hasBalance: boolean;
  hasDelivery: boolean;
  completedOnly: boolean;
  unfinishedOnly: boolean;
}): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  const search = orderSearchWhere(query);

  if (search) {
    and.push({ OR: search });
  }

  if (status && orderStatuses.includes(status as never)) {
    and.push({ status: status as never });
  }

  if (paymentStatus && paymentStatuses.includes(paymentStatus as never)) {
    and.push({ paymentStatus: paymentStatus as never });
  }

  if (deliveryStatus && orderDeliveryStatuses.includes(deliveryStatus as never)) {
    and.push({ deliveryStatus: deliveryStatus as never });
  }

  if (staffId) {
    and.push({ createdById: staffId });
  }

  if (createdDateRange) {
    and.push({ createdAt: createdDateRange });
  }

  if (hasBalance) {
    and.push({ balanceAmount: { gt: 0 } });
  }

  if (hasDelivery) {
    and.push({
      deliveries: {
        some: {}
      }
    });
  }

  if (completedOnly) {
    and.push({ status: "COMPLETED" });
  }

  if (unfinishedOnly) {
    and.push(unfinishedOrderWhere());
  }

  return and.length > 0 ? { AND: and } : {};
}

function neededAction(order: {
  paymentStatus: string;
  deliveryStatus: string;
  paymentDueDate: Date | null;
  balanceAmount: unknown;
  deliveries?: Array<{ scheduledDate: Date | null }>;
}) {
  const now = new Date();

  if (order.paymentDueDate && order.paymentDueDate < now && order.paymentStatus !== "PAID") {
    return "Payment overdue";
  }

  if (Number(order.balanceAmount) > 0) {
    return "Balance still open";
  }

  if (order.paymentStatus !== "PAID") {
    return "Payment follow-up";
  }

  if (order.deliveryStatus === "NOT_SCHEDULED") {
    return "Delivery not scheduled";
  }

  if (order.deliveryStatus === "SCHEDULED" || order.deliveries?.[0]?.scheduledDate) {
    return "Delivery scheduled";
  }

  if (order.deliveryStatus === "PARTIALLY_DELIVERED") {
    return "Delivery partially completed";
  }

  return "Operational review";
}

function RestrictedPanel({ title }: { title: string }) {
  return (
    <section className="rounded-lg border border-border bg-panel px-5 py-8 text-sm text-muted-foreground">
      You do not have permission to view {title.toLowerCase()}.
    </section>
  );
}

export default async function SalesHistoryPage({ searchParams }: SalesHistoryPageProps) {
  const user = await requirePermission("SALES_HISTORY", "VIEW");
  const params = (await searchParams) ?? {};
  const view = asReportView(params.view);
  const query = cleanSearch(params.q);
  const status = cleanSelect(params.status);
  const paymentStatus = cleanSelect(params.paymentStatus);
  const deliveryStatus = cleanSelect(params.deliveryStatus);
  const staffId = cleanSelect(params.staffId);
  const from = parseDate(params.from);
  const to = parseDate(params.to, true);
  const createdDateRange = dateRangeWhere(from, to);
  const page = parsePage(params.page);
  const hasBalance = params.hasBalance === "on";
  const hasDelivery = params.hasDelivery === "on";
  const completedOnly = params.completedOnly === "on";
  const unfinishedOnly = params.unfinishedOnly === "on";

  const permissions: Permissions = {
    canViewQuotations: hasPermission(user, "QUOTATIONS", "VIEW"),
    canViewOrders: hasPermission(user, "ORDERS", "VIEW"),
    canViewPayments: hasPermission(user, "PAYMENTS", "VIEW"),
    canViewDeliveries: hasPermission(user, "DELIVERIES", "VIEW"),
    canViewCustomers: hasPermission(user, "CUSTOMERS", "VIEW"),
    canViewInquiries: hasPermission(user, "INQUIRIES", "VIEW"),
    canExportDocuments: hasPermission(user, "DOCUMENTS", "EXPORT")
  };

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
    query,
    status,
    paymentStatus,
    deliveryStatus,
    staffId,
    createdDateRange,
    page,
    hasBalance,
    hasDelivery,
    completedOnly,
    unfinishedOnly,
    permissions,
    params
  });

  return (
    <>
      <PageHeader
        title="Sales History / Reports"
        description="Operational reporting for unfinished sales, balances, payments, deliveries, order history, quotation history, and customer history."
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

      <form className="mb-6 grid gap-3 rounded-lg border border-border bg-panel p-4 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_auto]">
        <input type="hidden" name="view" value={view} />
        <Input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search customer, order, reference, contact, item, provider, or payer"
        />
        <Select name="status" defaultValue={params.status ?? ""}>
          <option value="">Any status</option>
          {statusOptionsForView(view).map((option) => (
            <option key={option} value={option}>
              {labelFromEnum(option)}
            </option>
          ))}
        </Select>
        <Select name="paymentStatus" defaultValue={params.paymentStatus ?? ""}>
          <option value="">Any payment</option>
          {paymentStatuses.map((option) => (
            <option key={option} value={option}>
              {labelFromEnum(option)}
            </option>
          ))}
        </Select>
        <Select name="deliveryStatus" defaultValue={params.deliveryStatus ?? ""}>
          <option value="">Any delivery</option>
          {orderDeliveryStatuses.map((option) => (
            <option key={option} value={option}>
              {labelFromEnum(option)}
            </option>
          ))}
        </Select>
        <Select name="staffId" defaultValue={params.staffId ?? ""}>
          <option value="">Any staff</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input name="from" type="date" defaultValue={params.from ?? ""} aria-label="Date from" />
          <Input name="to" type="date" defaultValue={params.to ?? ""} aria-label="Date to" />
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground lg:col-span-7">
          <label className="flex items-center gap-2">
            <input name="hasBalance" type="checkbox" defaultChecked={hasBalance} />
            Has balance
          </label>
          <label className="flex items-center gap-2">
            <input name="hasDelivery" type="checkbox" defaultChecked={hasDelivery} />
            Has delivery
          </label>
          <label className="flex items-center gap-2">
            <input name="completedOnly" type="checkbox" defaultChecked={completedOnly} />
            Completed only
          </label>
          <label className="flex items-center gap-2">
            <input name="unfinishedOnly" type="checkbox" defaultChecked={unfinishedOnly} />
            Unfinished only
          </label>
        </div>
      </form>

      {report}
    </>
  );
}

function statusOptionsForView(view: ReportView) {
  if (view === "quotations") {
    return quotationStatuses;
  }

  if (view === "payments") {
    return ["RECORDED", "VOIDED", "REFUNDED"] as const;
  }

  if (view === "deliveries") {
    return deliveryStatuses;
  }

  return orderStatuses;
}

async function getReportData({
  view,
  query,
  status,
  paymentStatus,
  deliveryStatus,
  staffId,
  createdDateRange,
  page,
  hasBalance,
  hasDelivery,
  completedOnly,
  unfinishedOnly,
  permissions,
  params
}: {
  view: ReportView;
  query: string | undefined;
  status: string | undefined;
  paymentStatus: string | undefined;
  deliveryStatus: string | undefined;
  staffId: string | undefined;
  createdDateRange: { gte?: Date; lte?: Date } | undefined;
  page: number;
  hasBalance: boolean;
  hasDelivery: boolean;
  completedOnly: boolean;
  unfinishedOnly: boolean;
  permissions: Permissions;
  params: Awaited<NonNullable<SalesHistoryPageProps["searchParams"]>>;
}) {
  if (view === "overview") {
    return getOverviewReport({ createdDateRange, staffId, permissions });
  }

  if ((view === "orders" || view === "unfinished") && !permissions.canViewOrders) {
    return <RestrictedPanel title="order reports" />;
  }

  if (view === "quotations" && !permissions.canViewQuotations) {
    return <RestrictedPanel title="quotation history" />;
  }

  if ((view === "payments" || view === "balances") && !permissions.canViewPayments) {
    return <RestrictedPanel title={view === "payments" ? "payment history" : "outstanding balances"} />;
  }

  if (view === "deliveries" && !permissions.canViewDeliveries) {
    return <RestrictedPanel title="delivery schedule" />;
  }

  if (view === "customers" && !permissions.canViewCustomers) {
    return <RestrictedPanel title="customer sales history" />;
  }

  if (view === "quotations") {
    return getQuotationReport({ query, status, staffId, createdDateRange, page, permissions, params });
  }

  if (view === "payments") {
    return getPaymentReport({ query, status, staffId, createdDateRange, page, permissions, params });
  }

  if (view === "deliveries") {
    return getDeliveryReport({ query, status, staffId, createdDateRange, page, permissions, params });
  }

  if (view === "customers") {
    return getCustomerReport({ query, staffId, createdDateRange, permissions });
  }

  const orderWhere = buildOrderWhere({
    query,
    status,
    paymentStatus,
    deliveryStatus,
    staffId,
    createdDateRange,
    hasBalance,
    hasDelivery,
    completedOnly,
    unfinishedOnly: unfinishedOnly || view === "unfinished"
  });

  if (view === "balances") {
    return getBalancesReport({ orderWhere, page, permissions, params });
  }

  return getOrderReport({
    orderWhere,
    page,
    permissions,
    params,
    title: view === "unfinished" ? "Unfinished Sales" : "Order History",
    mode: view
  });
}

async function getOverviewReport({
  createdDateRange,
  staffId,
  permissions
}: {
  createdDateRange: { gte?: Date; lte?: Date } | undefined;
  staffId: string | undefined;
  permissions: Permissions;
}) {
  const orderDateWhere: Prisma.OrderWhereInput = {
    createdById: staffId,
    createdAt: createdDateRange
  };

  const paymentDateWhere: Prisma.PaymentWhereInput = {
    receivedById: staffId,
    paymentDate: createdDateRange
  };

  const deliveryDateWhere: Prisma.DeliveryWhereInput = {
    assignedStaffId: staffId,
    scheduledDate: createdDateRange
  };

  const [
    totalOrders,
    completedOrders,
    unfinishedOrders,
    financialTotals,
    paidAmount,
    outstandingBalance,
    paymentCount,
    scheduledDeliveryCount,
    pendingDeliveryCount
  ] = await Promise.all([
    permissions.canViewOrders ? prisma.order.count({ where: orderDateWhere }) : 0,
    permissions.canViewOrders
      ? prisma.order.count({ where: { ...orderDateWhere, status: "COMPLETED" } })
      : 0,
    permissions.canViewOrders
      ? prisma.order.count({ where: { AND: [orderDateWhere, unfinishedOrderWhere()] } })
      : 0,
    permissions.canViewPayments
      ? prisma.order.aggregate({
          where: { ...orderDateWhere, status: { not: "CANCELLED" } },
          _sum: { totalAmount: true, totalCostAmount: true, grossProfitAmount: true }
        })
      : null,
    permissions.canViewPayments
      ? prisma.order.aggregate({
          where: { ...orderDateWhere, status: { not: "CANCELLED" } },
          _sum: { paidAmount: true }
        })
      : null,
    permissions.canViewPayments
      ? prisma.order.aggregate({
          where: { ...orderDateWhere, status: { not: "CANCELLED" }, balanceAmount: { gt: 0 } },
          _sum: { balanceAmount: true }
        })
      : null,
    permissions.canViewPayments ? prisma.payment.count({ where: paymentDateWhere }) : 0,
    permissions.canViewDeliveries
      ? prisma.delivery.count({
          where: {
            ...deliveryDateWhere,
            status: {
              in: ["PLANNED", "SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED"]
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
  const grossSalesTotal = Number(financialTotals?._sum.totalAmount ?? 0);
  const grossProfitTotal = Number(financialTotals?._sum.grossProfitAmount ?? 0);
  const grossMargin =
    grossSalesTotal > 0 ? `${((grossProfitTotal / grossSalesTotal) * 100).toFixed(1)}%` : "0.0%";

  return (
    <ReportSection
      title="Overview"
      description="Date-range summary for daily order, payment, balance, and delivery checks."
    >
      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryTile label="Total orders" value={permissions.canViewOrders ? totalOrders.toString() : "Restricted"} />
        <SummaryTile
          label="Completed orders"
          value={permissions.canViewOrders ? completedOrders.toString() : "Restricted"}
        />
        <SummaryTile
          label="Unfinished orders"
          value={permissions.canViewOrders ? unfinishedOrders.toString() : "Restricted"}
        />
        <SummaryTile
          label="Gross sales total"
          value={permissions.canViewPayments ? formatMoney(grossSalesTotal) : "Restricted"}
        />
        <SummaryTile
          label="Total cost"
          value={permissions.canViewPayments ? formatMoney(financialTotals?._sum.totalCostAmount ?? 0) : "Restricted"}
        />
        <SummaryTile
          label="Gross profit"
          value={permissions.canViewPayments ? formatMoney(grossProfitTotal) : "Restricted"}
        />
        <SummaryTile
          label="Gross margin"
          value={permissions.canViewPayments ? grossMargin : "Restricted"}
        />
        <SummaryTile
          label="Paid amount"
          value={permissions.canViewPayments ? formatMoney(paidAmount?._sum.paidAmount ?? 0) : "Restricted"}
        />
        <SummaryTile
          label="Outstanding balance"
          value={
            permissions.canViewPayments ? formatMoney(outstandingBalance?._sum.balanceAmount ?? 0) : "Restricted"
          }
        />
        <SummaryTile
          label="Payments received"
          value={permissions.canViewPayments ? paymentCount.toString() : "Restricted"}
        />
        <SummaryTile
          label="Scheduled deliveries"
          value={permissions.canViewDeliveries ? scheduledDeliveryCount.toString() : "Restricted"}
        />
        <SummaryTile
          label="Pending deliveries"
          value={permissions.canViewDeliveries ? pendingDeliveryCount.toString() : "Restricted"}
        />
      </div>
    </ReportSection>
  );
}

async function getQuotationReport({
  query,
  status,
  staffId,
  createdDateRange,
  page,
  permissions,
  params
}: {
  query: string | undefined;
  status: string | undefined;
  staffId: string | undefined;
  createdDateRange: { gte?: Date; lte?: Date } | undefined;
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
        createdDateRange ? { createdAt: createdDateRange } : {},
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
    <ReportSection title="Quotation History" description="Saved quotation records and conversion status.">
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
                <TableCell className="font-medium">{quotation.quotationNumber ?? "Not assigned"}</TableCell>
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
                    <Link href="/orders" className="text-primary hover:underline">
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
  createdDateRange,
  page,
  permissions,
  params
}: {
  query: string | undefined;
  status: string | undefined;
  staffId: string | undefined;
  createdDateRange: { gte?: Date; lte?: Date } | undefined;
  page: number;
  permissions: Permissions;
  params: Awaited<NonNullable<SalesHistoryPageProps["searchParams"]>>;
}) {
  const payments = await prisma.payment.findMany({
    where: {
      status: ["RECORDED", "VOIDED", "REFUNDED"].includes(status ?? "") ? (status as never) : undefined,
      receivedById: staffId,
      paymentDate: createdDateRange,
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
    <ReportSection title="Payment History" description="Recorded payments across orders, methods, references, and receipts.">
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
                  <Link href="/orders" className="font-medium text-primary hover:underline">
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
  createdDateRange,
  page,
  permissions,
  params
}: {
  query: string | undefined;
  status: string | undefined;
  staffId: string | undefined;
  createdDateRange: { gte?: Date; lte?: Date } | undefined;
  page: number;
  permissions: Permissions;
  params: Awaited<NonNullable<SalesHistoryPageProps["searchParams"]>>;
}) {
  const deliveries = await prisma.delivery.findMany({
    where: {
      status: deliveryStatuses.includes(status as never) ? (status as never) : undefined,
      assignedStaffId: staffId,
      scheduledDate: createdDateRange,
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
    <ReportSection title="Delivery Schedule" description="Scheduled and pending delivery records across orders.">
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
                  <Link href="/orders" className="text-primary hover:underline">
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
      <EmptyState show={rows.length === 0} label="No deliveries match the current filters." />
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
    include: orderListInclude(permissions)
  });
  const hasNext = orders.length > PAGE_SIZE;

  return (
    <ReportSection title="Outstanding Balances" description="Orders and customers with remaining balances.">
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
    include: orderListInclude(permissions)
  });
  const hasNext = orders.length > PAGE_SIZE;

  return (
    <ReportSection
      title={title}
      description={
        mode === "unfinished"
          ? "Orders that still need payment, delivery, or operational follow-up."
          : "Searchable order history with payment, delivery, staff, quotation, and inquiry context."
      }
    >
      <OrderTable orders={orders.slice(0, PAGE_SIZE)} mode={mode} permissions={permissions} />
      <Pagination page={page} hasNext={hasNext} params={params} />
    </ReportSection>
  );
}

function orderListInclude(permissions: Permissions) {
  return {
    createdBy: {
      select: {
        displayName: true
      }
    },
    quotation: permissions.canViewQuotations
        ? {
          select: {
            id: true,
            quotationNumber: true
          }
        }
      : false,
    inquiry: permissions.canViewInquiries
      ? {
          select: {
            id: true,
            sourceReference: true
          }
        }
      : false,
    deliveries: permissions.canViewDeliveries
      ? {
          where: {
            status: {
              in: ["PLANNED", "SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED"]
            }
          },
          orderBy: {
            scheduledDate: "asc"
          },
          take: 1,
          select: {
            scheduledDate: true
          }
        }
      : false,
    _count: {
      select: {
        payments: true,
        deliveries: true,
        documents: true
      }
    }
  } satisfies Prisma.OrderInclude;
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
    `Assembly: ${order.needsAssembly ? "Yes" : "No"}`,
    `Sales invoice: ${order.salesInvoiceRequested ? "Requested" : "No"}`,
    delivery ? `Delivery: ${delivery}` : null,
    order.paymentTerms ? `Payment terms: ${order.paymentTerms}` : null,
    order.specialInstructions ? `Remarks: ${order.specialInstructions}` : null
  ].filter(Boolean);
}

type OrderListRow = Prisma.OrderGetPayload<{
  include: ReturnType<typeof orderListInclude>;
}>;

function OrderTable({
  orders,
  mode,
  permissions
}: {
  orders: OrderListRow[];
  mode: "orders" | "unfinished" | "balances";
  permissions: Permissions;
}) {
  return (
    <>
      <table className="w-full min-w-[1320px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Assigned staff</TableHead>
            <TableHead>Order status</TableHead>
            <TableHead>Payment status</TableHead>
            <TableHead>Delivery status</TableHead>
            {mode === "unfinished" ? <TableHead>Needed action</TableHead> : null}
            <TableHead>Total</TableHead>
            {permissions.canViewPayments ? <TableHead>Cost</TableHead> : null}
            {permissions.canViewPayments ? <TableHead>Gross profit</TableHead> : null}
            <TableHead>Paid</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Last payment</TableHead>
            <TableHead>Next delivery</TableHead>
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
            const deliveries = "deliveries" in order ? order.deliveries : [];
            const salesDetails = salesWorkflowDetails(order);

            return (
              <tr key={order.id}>
                <TableCell>
                  <Link href="/orders" className="font-medium text-primary hover:underline">
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
                <TableCell>
                  <StatusPill tone={statusTone(order.paymentStatus)}>
                    {labelFromEnum(order.paymentStatus)}
                  </StatusPill>
                </TableCell>
                <TableCell>
                  <StatusPill tone={statusTone(order.deliveryStatus)}>
                    {labelFromEnum(order.deliveryStatus)}
                  </StatusPill>
                </TableCell>
                {mode === "unfinished" ? <TableCell>{neededAction({ ...order, deliveries })}</TableCell> : null}
                <TableCell>{permissions.canViewPayments ? formatMoney(order.totalAmount) : "Restricted"}</TableCell>
                {permissions.canViewPayments ? <TableCell>{formatMoney(order.totalCostAmount)}</TableCell> : null}
                {permissions.canViewPayments ? <TableCell>{formatMoney(order.grossProfitAmount)}</TableCell> : null}
                <TableCell>{permissions.canViewPayments ? formatMoney(order.paidAmount) : "Restricted"}</TableCell>
                <TableCell>{permissions.canViewPayments ? formatMoney(order.balanceAmount) : "Restricted"}</TableCell>
                <TableCell>{permissions.canViewPayments ? formatDate(order.lastPaymentAt) : "Restricted"}</TableCell>
                <TableCell>{permissions.canViewDeliveries ? formatDate(deliveries[0]?.scheduledDate) : "Restricted"}</TableCell>
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
                    <div>Quotation {quotation ? (quotation.quotationNumber ?? "Not assigned") : "None"}</div>
                    <div className="text-xs">Inquiry {inquiry?.sourceReference ?? inquiry?.id?.slice(0, 8) ?? "None"}</div>
                    {salesDetails.map((detail) => (
                      <div key={detail} className="text-xs text-muted-foreground">
                        {detail}
                      </div>
                    ))}
                  </TableCell>
                ) : null}
                {mode === "orders" ? (
                  <TableCell>
                    {order._count.payments} payments · {order._count.deliveries} deliveries ·{" "}
                    {order._count.documents} docs
                  </TableCell>
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
      <EmptyState show={orders.length === 0} label="No orders match the current filters." />
    </>
  );
}

async function getCustomerReport({
  query,
  staffId,
  createdDateRange,
  permissions
}: {
  query: string | undefined;
  staffId: string | undefined;
  createdDateRange: { gte?: Date; lte?: Date } | undefined;
  permissions: Permissions;
}) {
  const customers = await prisma.customer.findMany({
    where: {
      archivedAt: null,
      assignedStaffId: staffId,
      createdAt: createdDateRange,
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
            select: {
              id: true,
              orderNumber: true,
              status: true,
              paymentStatus: true,
              deliveryStatus: true,
              totalAmount: true,
              totalCostAmount: true,
              grossProfitAmount: true,
              paidAmount: true,
              balanceAmount: true,
              updatedAt: true
            }
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
        select: {
          inquiries: true,
          quotations: true,
          orders: true,
          payments: true
        }
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
      description="Customer profile summaries with related activity composed by module permissions."
    >
      <div className="divide-y divide-border">
        {customers.map((customer) => {
          const orders = "orders" in customer ? customer.orders : [];
          const quotations = "quotations" in customer ? customer.quotations : [];
          const inquiries = "inquiries" in customer ? customer.inquiries : [];
          const payments = "payments" in customer ? customer.payments : [];
          const deliveries = deliveriesByCustomerId.get(customer.id) ?? [];
          const outstandingBalance = orders.reduce((sum, order) => sum + Number(order.balanceAmount), 0);
          const totalCost = orders.reduce((sum, order) => sum + Number(order.totalCostAmount), 0);
          const grossProfit = orders.reduce((sum, order) => sum + Number(order.grossProfitAmount), 0);

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
                <div className="grid grid-cols-2 gap-2 text-center text-xs text-muted-foreground sm:grid-cols-7">
                  <MiniCount label="Inquiries" value={permissions.canViewInquiries ? customer._count.inquiries : null} />
                  <MiniCount label="Quotes" value={permissions.canViewQuotations ? customer._count.quotations : null} />
                  <MiniCount label="Orders" value={permissions.canViewOrders ? customer._count.orders : null} />
                  <MiniCount label="Payments" value={permissions.canViewPayments ? customer._count.payments : null} />
                  <MiniCount
                    label="Balance"
                    value={permissions.canViewPayments ? formatMoney(outstandingBalance) : null}
                  />
                  <MiniCount
                    label="Cost"
                    value={permissions.canViewPayments ? formatMoney(totalCost) : null}
                  />
                  <MiniCount
                    label="Profit"
                    value={permissions.canViewPayments ? formatMoney(grossProfit) : null}
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
                        permissions.canViewPayments ? ` · Profit ${formatMoney(order.grossProfitAmount)}` : ""
                      }`}
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

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-lg border border-border bg-background px-5 py-4">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </section>
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
    <section className="overflow-hidden rounded-lg border border-border bg-panel">
      <div className="border-b border-border px-5 py-4">
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

function CompactRow({ title, meta }: { title: string; meta: string }) {
  return (
    <div>
      <div className="font-medium text-foreground">{title}</div>
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
