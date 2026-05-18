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
  | "sales"
  | "quotations"
  | "orders"
  | "unfinished"
  | "payments"
  | "balances"
  | "deliveries"
  | "customers";

type SalesHistoryPageProps = {
  searchParams?: Promise<{
    view?: string;
    q?: string;
    status?: string;
    staffId?: string;
    from?: string;
    to?: string;
  }>;
};

const reportViews: Array<{ value: ReportView; label: string }> = [
  { value: "sales", label: "Sales History" },
  { value: "quotations", label: "Quotation History" },
  { value: "orders", label: "Order History" },
  { value: "unfinished", label: "Unfinished Sales" },
  { value: "payments", label: "Payment History" },
  { value: "balances", label: "Outstanding Balances" },
  { value: "deliveries", label: "Delivery Schedules" },
  { value: "customers", label: "Customer History" }
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
  "PAID"
] as const;

const deliveryStatuses = [
  "NOT_SCHEDULED",
  "SCHEDULED",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "CANCELLED"
] as const;

function asReportView(value: string | undefined): ReportView {
  return reportViews.some((view) => view.value === value) ? (value as ReportView) : "sales";
}

function cleanSearch(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : undefined;
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+08:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
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
  }).format(Number(value));
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

function statusTone(status: string) {
  if (["ACCEPTED", "PAID", "DELIVERED", "COMPLETED", "RECORDED"].includes(status)) {
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
      "NOT_SCHEDULED"
    ].includes(status)
  ) {
    return "warning" as const;
  }

  if (["DECLINED", "CANCELLED", "FAILED", "VOIDED", "REFUNDED"].includes(status)) {
    return "danger" as const;
  }

  return "neutral" as const;
}

function dateRangeWhere(from: Date | undefined, to: Date | undefined) {
  return from || to
    ? {
        gte: from,
        lte: to
      }
    : undefined;
}

function activeTabHref(view: ReportView) {
  return `/sales-history?view=${view}`;
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
      customer: {
        contacts: {
          some: {
            value: { contains: query, mode: "insensitive" }
          }
        }
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

function quotationSearchWhere(query: string | undefined): Prisma.QuotationWhereInput[] | undefined {
  if (!query) {
    return undefined;
  }

  return [
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
      items: {
        some: {
          itemName: { contains: query, mode: "insensitive" }
        }
      }
    }
  ];
}

function neededAction(order: {
  paymentStatus: string;
  deliveryStatus: string;
  paymentDueDate: Date | null;
}) {
  const now = new Date();

  if (order.paymentDueDate && order.paymentDueDate < now && order.paymentStatus !== "PAID") {
    return "Payment overdue";
  }

  if (order.paymentStatus === "UNPAID") {
    return "Order unpaid";
  }

  if (
    ["DOWNPAYMENT_PAID", "PARTIALLY_PAID", "BALANCE_DUE_ON_DELIVERY"].includes(
      order.paymentStatus
    )
  ) {
    return "Balance still open";
  }

  if (order.deliveryStatus === "NOT_SCHEDULED") {
    return "Delivery not scheduled";
  }

  if (order.deliveryStatus === "PARTIALLY_DELIVERED") {
    return "Delivery partially completed";
  }

  return "Needs review";
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
  const from = parseDate(params.from);
  const to = parseDate(params.to, true);
  const staffId = cleanSearch(params.staffId);
  const status = cleanSearch(params.status);
  const createdDateRange = dateRangeWhere(from, to);

  const canViewQuotations = hasPermission(user, "QUOTATIONS", "VIEW");
  const canViewOrders = hasPermission(user, "ORDERS", "VIEW");
  const canViewPayments = hasPermission(user, "PAYMENTS", "VIEW");
  const canViewDeliveries = hasPermission(user, "DELIVERIES", "VIEW");
  const canViewCustomers = hasPermission(user, "CUSTOMERS", "VIEW");
  const canViewDocuments = hasPermission(user, "DOCUMENTS", "VIEW");

  const [staff, salesCount, unfinishedOrderCount, openBalanceTotal, upcomingDeliveryCount] =
    await Promise.all([
      prisma.userProfile.findMany({
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
      }),
      canViewOrders ? prisma.order.count() : 0,
      canViewOrders
        ? prisma.order.count({
            where: {
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
                  deliveryStatus: {
                    in: ["NOT_SCHEDULED", "SCHEDULED", "PARTIALLY_DELIVERED"]
                  }
                }
              ]
            }
          })
        : 0,
      canViewPayments
        ? prisma.order.aggregate({
            where: {
              status: {
                not: "CANCELLED"
              },
              balanceAmount: {
                gt: 0
              }
            },
            _sum: {
              balanceAmount: true
            }
          })
        : null,
      canViewDeliveries
        ? prisma.delivery.count({
            where: {
              status: {
                in: ["PLANNED", "SCHEDULED", "IN_TRANSIT"]
              }
            }
          })
        : 0
    ]);

  const report = await getReportData({
    view,
    query,
    status,
    staffId,
    createdDateRange,
    canViewQuotations,
    canViewOrders,
    canViewPayments,
    canViewDeliveries,
    canViewCustomers,
    canViewDocuments
  });

  return (
    <>
      <PageHeader
        title="Sales History"
        description="Operational reports for quotations, orders, payments, balances, deliveries, unfinished sales, and customer history."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Saved orders" value={canViewOrders ? salesCount.toString() : "Restricted"} />
        <SummaryTile
          label="Unfinished orders"
          value={canViewOrders ? unfinishedOrderCount.toString() : "Restricted"}
        />
        <SummaryTile
          label="Open balances"
          value={
            canViewPayments
              ? formatMoney(openBalanceTotal?._sum.balanceAmount ?? 0)
              : "Restricted"
          }
        />
        <SummaryTile
          label="Active deliveries"
          value={canViewDeliveries ? upcomingDeliveryCount.toString() : "Restricted"}
        />
      </div>

      <nav className="mb-5 flex gap-2 overflow-x-auto border-b border-border pb-2">
        {reportViews.map((item) => (
          <Link
            key={item.value}
            href={activeTabHref(item.value)}
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

      <form className="mb-6 grid gap-3 rounded-lg border border-border bg-panel p-4 lg:grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_0.9fr_auto]">
        <input type="hidden" name="view" value={view} />
        <Input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search customer, order, reference, contact, item, or staff"
        />
        <Select name="status" defaultValue={params.status ?? ""}>
          <option value="">Any status</option>
          {statusOptionsForView(view).map((option) => (
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
        <Input name="from" type="date" defaultValue={params.from ?? ""} />
        <Input name="to" type="date" defaultValue={params.to ?? ""} />
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {report}
    </>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-lg border border-border bg-panel px-5 py-4">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </section>
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
    return ["PLANNED", "SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED", "DELIVERED", "FAILED", "CANCELLED"] as const;
  }

  if (view === "balances") {
    return paymentStatuses;
  }

  if (view === "sales" || view === "orders" || view === "unfinished") {
    return orderStatuses;
  }

  return deliveryStatuses;
}

async function getReportData({
  view,
  query,
  status,
  staffId,
  createdDateRange,
  canViewQuotations,
  canViewOrders,
  canViewPayments,
  canViewDeliveries,
  canViewCustomers,
  canViewDocuments
}: {
  view: ReportView;
  query: string | undefined;
  status: string | undefined;
  staffId: string | undefined;
  createdDateRange: { gte?: Date; lte?: Date } | undefined;
  canViewQuotations: boolean;
  canViewOrders: boolean;
  canViewPayments: boolean;
  canViewDeliveries: boolean;
  canViewCustomers: boolean;
  canViewDocuments: boolean;
}) {
  if ((view === "sales" || view === "orders" || view === "unfinished") && !canViewOrders) {
    return <RestrictedPanel title="order reports" />;
  }

  if (view === "quotations" && !canViewQuotations) {
    return <RestrictedPanel title="quotation history" />;
  }

  if ((view === "payments" || view === "balances") && !canViewPayments) {
    return <RestrictedPanel title={view === "payments" ? "payment history" : "outstanding balances"} />;
  }

  if (view === "deliveries" && !canViewDeliveries) {
    return <RestrictedPanel title="delivery schedules" />;
  }

  if (view === "customers" && !canViewCustomers) {
    return <RestrictedPanel title="customer sales history" />;
  }

  if (view === "quotations") {
    const quotations = await prisma.quotation.findMany({
      where: {
        status: quotationStatuses.includes(status as never) ? (status as never) : undefined,
        createdById: staffId,
        createdAt: createdDateRange,
        OR: quotationSearchWhere(query)
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 80,
      include: {
        customer: {
          select: {
            id: true,
            displayName: true,
            companyName: true
          }
        },
        createdBy: {
          select: {
            displayName: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        },
        _count: {
          select: {
            items: true
          }
        }
      }
    });

    return (
      <ReportSection title="Quotation History" description="Saved quotation records across draft, sent, accepted, declined, cancelled, and converted states.">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <TableHead>Quotation</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Converted order</TableHead>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {quotations.map((quotation) => (
              <tr key={quotation.id}>
                <TableCell>{quotation.id.slice(0, 8)}</TableCell>
                <TableCell>
                  <Link href="/customers" className="font-medium text-primary hover:underline">
                    {quotation.customer.displayName}
                  </Link>
                  <div className="text-xs text-muted-foreground">{quotation.customer.companyName}</div>
                </TableCell>
                <TableCell>
                  <StatusPill tone={statusTone(quotation.status)}>{labelFromEnum(quotation.status)}</StatusPill>
                </TableCell>
                <TableCell>{quotation._count.items}</TableCell>
                <TableCell>{formatMoney(quotation.totalAmount)}</TableCell>
                <TableCell>{quotation.createdBy?.displayName ?? "Not set"}</TableCell>
                <TableCell>{formatDate(quotation.updatedAt)}</TableCell>
                <TableCell>
                  {quotation.order ? (
                    <Link href="/orders" className="text-primary hover:underline">
                      {quotation.order.orderNumber ?? quotation.order.id.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Not converted</span>
                  )}
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
        <EmptyState show={quotations.length === 0} label="No quotations match the current filters." />
      </ReportSection>
    );
  }

  if (view === "payments") {
    const payments = await prisma.payment.findMany({
      where: {
        status: ["RECORDED", "VOIDED", "REFUNDED"].includes(status ?? "")
          ? (status as never)
          : undefined,
        receivedById: staffId,
        paymentDate: createdDateRange,
        OR: query
          ? [
              { referenceNumber: { contains: query, mode: "insensitive" } },
              { payerName: { contains: query, mode: "insensitive" } },
              {
                customer: {
                  OR: [
                    { displayName: { contains: query, mode: "insensitive" } },
                    { companyName: { contains: query, mode: "insensitive" } }
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
      orderBy: [
        {
          paymentDate: "desc"
        },
        {
          createdAt: "desc"
        }
      ],
      take: 80,
      include: {
        customer: {
          select: {
            displayName: true,
            companyName: true
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
        documents: canViewDocuments
          ? {
              where: {
                documentType: "PAYMENT_RECEIPT"
              },
              take: 1,
              select: {
                title: true,
                secureUrl: true
              }
            }
          : false
      }
    });

    return (
      <ReportSection title="Payment History" description="Recorded payment rows with references, methods, receipts, and current order balances.">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Received by</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>Balance</TableHead>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((payment) => {
              const receipt = "documents" in payment ? payment.documents[0] : null;

              return (
                <tr key={payment.id}>
                  <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{payment.customer.displayName}</div>
                    <div className="text-xs text-muted-foreground">{payment.customer.companyName}</div>
                  </TableCell>
                  <TableCell>
                    <Link href="/orders" className="font-medium text-primary hover:underline">
                      {payment.order.orderNumber ?? payment.order.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>{labelFromEnum(payment.paymentType)}</TableCell>
                  <TableCell className="font-medium">{formatMoney(payment.amount)}</TableCell>
                  <TableCell>{labelFromEnum(payment.method)}</TableCell>
                  <TableCell>{payment.referenceNumber ?? "None"}</TableCell>
                  <TableCell>{payment.receivedBy?.displayName ?? "Not set"}</TableCell>
                  <TableCell>
                    {receipt?.secureUrl ? (
                      <a href={receipt.secureUrl} className="text-primary hover:underline">
                        {receipt.title}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">
                        {payment.receiptGenerated ? "Generated" : "Not generated"}
                      </span>
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
        <EmptyState show={payments.length === 0} label="No payments match the current filters." />
      </ReportSection>
    );
  }

  if (view === "deliveries") {
    const deliveries = await prisma.delivery.findMany({
      where: {
        status: ["PLANNED", "SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED", "DELIVERED", "FAILED", "CANCELLED"].includes(status ?? "")
          ? (status as never)
          : undefined,
        assignedStaffId: staffId,
        scheduledDate: createdDateRange,
        OR: query
          ? [
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
      orderBy: [
        {
          scheduledDate: "asc"
        },
        {
          createdAt: "desc"
        }
      ],
      take: 80,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerDisplayNameSnapshot: true,
            paymentStatus: true,
            balanceAmount: true
          }
        },
        assignedStaff: {
          select: {
            displayName: true
          }
        },
        _count: {
          select: {
            items: true
          }
        }
      }
    });

    return (
      <ReportSection title="Delivery Schedules" description="Upcoming and historical delivery records across orders.">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <TableHead>Schedule</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned</TableHead>
              {canViewPayments ? <TableHead>Balance</TableHead> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {deliveries.map((delivery) => (
              <tr key={delivery.id}>
                <TableCell>
                  <div className="font-medium">{formatDate(delivery.scheduledDate)}</div>
                  <div className="text-xs text-muted-foreground">
                    {delivery.scheduledTimeWindow ?? "No time window"}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{delivery.order.customerDisplayNameSnapshot}</TableCell>
                <TableCell>
                  <Link href="/orders" className="text-primary hover:underline">
                    {delivery.order.orderNumber ?? delivery.order.id.slice(0, 8)}
                  </Link>
                </TableCell>
                <TableCell>
                  <div>{delivery.deliveryProviderName ?? labelFromEnum(delivery.deliveryProviderType)}</div>
                  <div className="text-xs text-muted-foreground">
                    {delivery.deliveryProviderReference ?? "No reference"}
                  </div>
                </TableCell>
                <TableCell>
                  <div>{delivery.recipientName ?? "Not set"}</div>
                  <div className="text-xs text-muted-foreground">{delivery.recipientPhone ?? "No phone"}</div>
                </TableCell>
                <TableCell>{delivery._count.items}</TableCell>
                <TableCell>
                  <StatusPill tone={statusTone(delivery.status)}>{labelFromEnum(delivery.status)}</StatusPill>
                </TableCell>
                <TableCell>{delivery.assignedStaff?.displayName ?? "Not set"}</TableCell>
                {canViewPayments ? (
                  <TableCell>
                    <div>{formatMoney(delivery.order.balanceAmount)}</div>
                    <StatusPill tone={statusTone(delivery.order.paymentStatus)}>
                      {labelFromEnum(delivery.order.paymentStatus)}
                    </StatusPill>
                  </TableCell>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        <EmptyState show={deliveries.length === 0} label="No deliveries match the current filters." />
      </ReportSection>
    );
  }

  if (view === "customers") {
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
      take: 60,
      include: {
        assignedStaff: {
          select: {
            displayName: true
          }
        },
        _count: {
          select: {
            inquiries: true,
            quotations: true,
            orders: true,
            payments: true
          }
        },
        orders: canViewOrders
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
                balanceAmount: true
              }
            }
          : false
      }
    });

    return (
      <ReportSection title="Customer Sales History" description="Customer-level sales context with related quotations, orders, payments, and open balances where permitted.">
        <div className="divide-y divide-border">
          {customers.map((customer) => (
            <article key={customer.id} className="px-5 py-4">
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
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs text-muted-foreground">
                  <MiniCount label="Inquiries" value={customer._count.inquiries} />
                  <MiniCount label="Quotes" value={customer._count.quotations} />
                  <MiniCount label="Orders" value={customer._count.orders} />
                  <MiniCount label="Payments" value={canViewPayments ? customer._count.payments : null} />
                </div>
              </div>
              {"orders" in customer && customer.orders.length > 0 ? (
                <div className="mt-4 grid gap-2 lg:grid-cols-3">
                  {customer.orders.map((order) => (
                    <div key={order.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{order.orderNumber ?? order.id.slice(0, 8)}</span>
                        <StatusPill tone={statusTone(order.status)}>{labelFromEnum(order.status)}</StatusPill>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusPill tone={statusTone(order.paymentStatus)}>
                          {labelFromEnum(order.paymentStatus)}
                        </StatusPill>
                        <StatusPill tone={statusTone(order.deliveryStatus)}>
                          {labelFromEnum(order.deliveryStatus)}
                        </StatusPill>
                      </div>
                      {canViewPayments ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatMoney(order.totalAmount)} total · {formatMoney(order.balanceAmount)} balance
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
        <EmptyState show={customers.length === 0} label="No customers match the current filters." />
      </ReportSection>
    );
  }

  const baseOrderWhere: Prisma.OrderWhereInput = {
    createdById: staffId,
    createdAt: createdDateRange,
    OR: orderSearchWhere(query)
  };

  if (view === "balances") {
    const orders = await prisma.order.findMany({
      where: {
        ...baseOrderWhere,
        status: {
          not: "CANCELLED"
        },
        paymentStatus: paymentStatuses.includes(status as never) ? (status as never) : undefined,
        balanceAmount: {
          gt: 0
        }
      },
      orderBy: [
        {
          paymentDueDate: "asc"
        },
        {
          updatedAt: "desc"
        }
      ],
      take: 80,
      include: {
        createdBy: {
          select: {
            displayName: true
          }
        },
        deliveries: {
          where: {
            status: {
              notIn: ["CANCELLED", "FAILED", "DELIVERED"]
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
      }
    });

    return (
      <ReportSection title="Outstanding Balances" description="Orders with remaining balances, payment due timing, and next delivery context.">
        <OrderTable orders={orders} mode="balances" canViewPayments={canViewPayments} />
      </ReportSection>
    );
  }

  if (view === "unfinished") {
    const [quotations, orders] = await Promise.all([
      canViewQuotations
        ? prisma.quotation.findMany({
            where: {
              status: {
                in: ["DRAFT", "SENT", "ACCEPTED"]
              },
              order: null,
              createdById: staffId,
              createdAt: createdDateRange,
              OR: quotationSearchWhere(query)
            },
            orderBy: {
              updatedAt: "desc"
            },
            take: 40,
            include: {
              customer: {
                select: {
                  displayName: true
                }
              },
              createdBy: {
                select: {
                  displayName: true
                }
              }
            }
          })
        : [],
      prisma.order.findMany({
        where: {
          ...baseOrderWhere,
          status: orderStatuses.includes(status as never) ? (status as never) : { notIn: ["COMPLETED", "CANCELLED"] },
          OR: [
            ...(orderSearchWhere(query) ?? []),
            {
              balanceAmount: {
                gt: 0
              }
            },
            {
              deliveryStatus: {
                in: ["NOT_SCHEDULED", "SCHEDULED", "PARTIALLY_DELIVERED"]
              }
            }
          ]
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 60,
        include: {
          createdBy: {
            select: {
              displayName: true
            }
          },
          deliveries: {
            where: {
              status: {
                notIn: ["CANCELLED", "FAILED", "DELIVERED"]
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
        }
      })
    ]);

    return (
      <ReportSection title="Unfinished Sales" description="Open quotations and active orders with balances, delivery work, or conversion follow-up.">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <TableHead>Type</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Needed action</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Next date</TableHead>
              <TableHead>Owner</TableHead>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {quotations.map((quotation) => (
              <tr key={quotation.id}>
                <TableCell>Quotation</TableCell>
                <TableCell>{quotation.id.slice(0, 8)}</TableCell>
                <TableCell className="font-medium">{quotation.customer.displayName}</TableCell>
                <TableCell>
                  <StatusPill tone={statusTone(quotation.status)}>{labelFromEnum(quotation.status)}</StatusPill>
                </TableCell>
                <TableCell>
                  {quotation.status === "ACCEPTED" ? "Accepted quotation not converted" : "Quotation follow-up"}
                </TableCell>
                <TableCell>{formatMoney(quotation.totalAmount)}</TableCell>
                <TableCell className="text-muted-foreground">Not an order</TableCell>
                <TableCell>{formatDate(quotation.updatedAt)}</TableCell>
                <TableCell>{quotation.createdBy?.displayName ?? "Not set"}</TableCell>
              </tr>
            ))}
            {orders.map((order) => (
              <tr key={order.id}>
                <TableCell>Order</TableCell>
                <TableCell>
                  <Link href="/orders" className="font-medium text-primary hover:underline">
                    {order.orderNumber ?? order.id.slice(0, 8)}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{order.customerDisplayNameSnapshot}</TableCell>
                <TableCell>
                  <StatusPill tone={statusTone(order.status)}>{labelFromEnum(order.status)}</StatusPill>
                </TableCell>
                <TableCell>{neededAction(order)}</TableCell>
                <TableCell>{canViewPayments ? formatMoney(order.totalAmount) : "Restricted"}</TableCell>
                <TableCell>{canViewPayments ? formatMoney(order.balanceAmount) : "Restricted"}</TableCell>
                <TableCell>
                  {formatDate(order.paymentDueDate ?? order.deliveries[0]?.scheduledDate ?? order.updatedAt)}
                </TableCell>
                <TableCell>{order.createdBy?.displayName ?? "Not set"}</TableCell>
              </tr>
            ))}
          </tbody>
        </table>
        <EmptyState
          show={quotations.length === 0 && orders.length === 0}
          label="No unfinished sales match the current filters."
        />
      </ReportSection>
    );
  }

  const orders = await prisma.order.findMany({
    where: {
      ...baseOrderWhere,
      status: orderStatuses.includes(status as never) ? (status as never) : undefined
    },
    orderBy: view === "sales" ? { createdAt: "desc" } : { updatedAt: "desc" },
    take: 80,
    include: {
      createdBy: {
        select: {
          displayName: true
        }
      },
      deliveries: {
        where: {
          status: {
            notIn: ["CANCELLED", "FAILED", "DELIVERED"]
          }
        },
        orderBy: {
          scheduledDate: "asc"
        },
        take: 1,
        select: {
          scheduledDate: true
        }
      },
      _count: {
        select: {
          payments: true,
          deliveries: true,
          documents: true
        }
      }
    }
  });

  return (
    <ReportSection
      title={view === "orders" ? "Order History" : "Sales History"}
      description={
        view === "orders"
          ? "Order progress across payment, delivery, document, and update history."
          : "Saved order records used as operational sales history."
      }
    >
      <OrderTable orders={orders} mode={view === "orders" ? "orders" : "sales"} canViewPayments={canViewPayments} />
    </ReportSection>
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

function OrderTable({
  orders,
  mode,
  canViewPayments
}: {
  orders: Array<{
    id: string;
    orderNumber: string | null;
    customerDisplayNameSnapshot: string;
    status: string;
    paymentStatus: string;
    deliveryStatus: string;
    sourceType: string;
    totalAmount: unknown;
    paidAmount: unknown;
    balanceAmount: unknown;
    paymentDueTiming: string | null;
    paymentDueDate: Date | null;
    lastPaymentAt: Date | null;
    confirmedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: { displayName: string } | null;
    deliveries?: Array<{ scheduledDate: Date | null }>;
    _count?: {
      payments: number;
      deliveries: number;
      documents: number;
    };
  }>;
  mode: "sales" | "orders" | "balances";
  canViewPayments: boolean;
}) {
  return (
    <>
      <table className="w-full min-w-[1120px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>{mode === "balances" ? "Due / delivery" : "Dates"}</TableHead>
            {mode === "orders" ? <TableHead>Counts</TableHead> : null}
            <TableHead>Created by</TableHead>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {orders.map((order) => (
            <tr key={order.id}>
              <TableCell>
                <Link href="/orders" className="font-medium text-primary hover:underline">
                  {order.orderNumber ?? order.id.slice(0, 8)}
                </Link>
              </TableCell>
              <TableCell className="font-medium">{order.customerDisplayNameSnapshot}</TableCell>
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
              <TableCell>{labelFromEnum(order.sourceType)}</TableCell>
              <TableCell>{canViewPayments ? formatMoney(order.totalAmount) : "Restricted"}</TableCell>
              <TableCell>{canViewPayments ? formatMoney(order.paidAmount) : "Restricted"}</TableCell>
              <TableCell>{canViewPayments ? formatMoney(order.balanceAmount) : "Restricted"}</TableCell>
              <TableCell>
                {mode === "balances" ? (
                  <>
                    <div>{labelFromEnum(order.paymentDueTiming)}</div>
                    <div className="text-xs text-muted-foreground">
                      Due {formatDate(order.paymentDueDate)} · Delivery{" "}
                      {formatDate(order.deliveries?.[0]?.scheduledDate)}
                    </div>
                  </>
                ) : (
                  <>
                    <div>Created {formatDate(order.createdAt)}</div>
                    <div className="text-xs text-muted-foreground">
                      Updated {formatDate(order.updatedAt)}
                    </div>
                  </>
                )}
              </TableCell>
              {mode === "orders" ? (
                <TableCell>
                  {order._count
                    ? `${order._count.payments} payments · ${order._count.deliveries} deliveries · ${order._count.documents} docs`
                    : "Not loaded"}
                </TableCell>
              ) : null}
              <TableCell>{order.createdBy?.displayName ?? "Not set"}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
      <EmptyState show={orders.length === 0} label="No orders match the current filters." />
    </>
  );
}

function MiniCount({ label, value }: { label: string; value: number | null }) {
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
  return <td className={`px-5 py-3 text-muted-foreground ${className}`}>{children}</td>;
}

function EmptyState({ show, label }: { show: boolean; label: string }) {
  return show ? <div className="px-5 py-8 text-sm text-muted-foreground">{label}</div> : null;
}
