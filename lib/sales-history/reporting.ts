import type { Prisma } from "@prisma/client";

export type ReportView =
  | "overview"
  | "unfinished"
  | "balances"
  | "orders";

export type ReportPermissions = {
  canViewQuotations: boolean;
  canViewOrders: boolean;
  canViewPayments: boolean;
  canViewDeliveries: boolean;
  canViewCustomers: boolean;
  canViewInquiries: boolean;
  canViewDocuments: boolean;
  canExportDocuments: boolean;
};

export type ReportSearchParams = {
  view?: string;
  q?: string;
  status?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  staffId?: string;
  from?: string;
  to?: string;
  hasBalance?: string;
  overdueOnly?: string;
  page?: string;
};

export const PAGE_SIZE = 50;
export const MAX_PAGE = 500;

export const reportViews: Array<{ value: ReportView; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "unfinished", label: "Needs Action" },
  { value: "balances", label: "Balances" },
  { value: "orders", label: "Sales Ledger" }
];

export const orderStatuses = [
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

export const paymentStatuses = [
  "UNPAID",
  "DOWNPAYMENT_PAID",
  "PARTIALLY_PAID",
  "BALANCE_DUE_ON_DELIVERY",
  "PAID",
  "REFUNDED",
  "PARTIALLY_REFUNDED"
] as const;

export const orderDeliveryStatuses = [
  "NOT_SCHEDULED",
  "SCHEDULED",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "CANCELLED"
] as const;

export const activeDeliveryStatuses = ["PLANNED", "SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED"] as const;

export function asReportView(value: string | undefined): ReportView {
  if (value === "sales") {
    return "overview";
  }

  return reportViews.some((view) => view.value === value) ? (value as ReportView) : "overview";
}

export function cleanSearch(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 100) : undefined;
}

export function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? Math.min(page, MAX_PAGE) : 1;
}

export function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+08:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function dateRangeWhere(from: Date | undefined, to: Date | undefined) {
  return from || to
    ? {
        gte: from,
        lte: to
      }
    : undefined;
}

export function parseDateRange(fromValue: string | undefined, toValue: string | undefined) {
  const from = parseDate(fromValue);
  const to = parseDate(toValue, true);

  if (from && to && from > to) {
    return {
      from: undefined,
      to: undefined,
      dateRange: undefined
    };
  }

  return {
    from,
    to,
    dateRange: dateRangeWhere(from, to)
  };
}

export function cleanUuid(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      trimmed
    )
    ? trimmed
    : undefined;
}

export function enumValue<T extends readonly string[]>(values: T, value: string | undefined) {
  const trimmed = value?.trim();
  return values.find((option) => option === trimmed);
}

export function statusOptionsForView(view: ReportView) {
  void view;
  return orderStatuses;
}

export function cleanStatusForView(view: ReportView, value: string | undefined) {
  return enumValue(statusOptionsForView(view), value);
}

export function parseReportFilters(params: ReportSearchParams) {
  const view = asReportView(params.view);
  const { from, to, dateRange } = parseDateRange(params.from, params.to);

  return {
    view,
    query: cleanSearch(params.q),
    status: cleanStatusForView(view, params.status),
    paymentStatus: enumValue(paymentStatuses, params.paymentStatus),
    deliveryStatus: enumValue(orderDeliveryStatuses, params.deliveryStatus),
    staffId: cleanUuid(params.staffId),
    from,
    to,
    dateRange,
    page: parsePage(params.page),
    hasBalance: params.hasBalance === "on",
    overdueOnly: params.overdueOnly === "on"
  };
}

export function canAccessReportView(view: ReportView, permissions: ReportPermissions) {
  if ((view === "orders" || view === "unfinished") && !permissions.canViewOrders) {
    return false;
  }

  if (view === "balances" && !permissions.canViewPayments) {
    return false;
  }

  return true;
}

export function orderSearchWhere(query: string | undefined): Prisma.OrderWhereInput[] | undefined {
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

export function unfinishedOrderWhere(): Prisma.OrderWhereInput {
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
              in: [...activeDeliveryStatuses]
            }
          }
        }
      }
    ]
  };
}

export function overdueOrderWhere({
  includePaymentFields,
  includeDeliveryFields,
  now = new Date()
}: {
  includePaymentFields: boolean;
  includeDeliveryFields: boolean;
  now?: Date;
}): Prisma.OrderWhereInput {
  const overdueReasons: Prisma.OrderWhereInput[] = [];

  if (includePaymentFields) {
    overdueReasons.push({
      paymentDueDate: {
        lt: now
      },
      balanceAmount: {
        gt: 0
      }
    });
  }

  if (includeDeliveryFields) {
    overdueReasons.push({
      deliveries: {
        some: {
          scheduledDate: {
            lt: now
          },
          status: {
            in: [...activeDeliveryStatuses]
          }
        }
      }
    });
  }

  return overdueReasons.length > 0
    ? {
        status: {
          notIn: ["COMPLETED", "CANCELLED"]
        },
        OR: overdueReasons
      }
    : {};
}

export function buildOrderWhere({
  query,
  status,
  paymentStatus,
  deliveryStatus,
  staffId,
  dateRange,
  dateField = "createdAt",
  hasBalance,
  unfinishedOnly,
  overdueOnly,
  canUsePaymentFields,
  canUseDeliveryFields
}: {
  query: string | undefined;
  status: string | undefined;
  paymentStatus: string | undefined;
  deliveryStatus: string | undefined;
  staffId: string | undefined;
  dateRange: { gte?: Date; lte?: Date } | undefined;
  dateField?: "createdAt" | "paymentDueDate";
  hasBalance: boolean;
  unfinishedOnly: boolean;
  overdueOnly: boolean;
  canUsePaymentFields: boolean;
  canUseDeliveryFields: boolean;
}): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  const search = orderSearchWhere(query);

  if (search) {
    and.push({ OR: search });
  }

  if (status && orderStatuses.includes(status as never)) {
    and.push({ status: status as never });
  }

  if (canUsePaymentFields && paymentStatus && paymentStatuses.includes(paymentStatus as never)) {
    and.push({ paymentStatus: paymentStatus as never });
  }

  if (deliveryStatus && orderDeliveryStatuses.includes(deliveryStatus as never)) {
    and.push({ deliveryStatus: deliveryStatus as never });
  }

  if (staffId) {
    and.push({ createdById: staffId });
  }

  if (dateRange) {
    and.push({ [dateField]: dateRange } as Prisma.OrderWhereInput);
  }

  if (canUsePaymentFields && hasBalance) {
    and.push({ balanceAmount: { gt: 0 } });
  }

  if (unfinishedOnly) {
    and.push(unfinishedOrderWhere());
  }

  if (overdueOnly) {
    const overdueWhere = overdueOrderWhere({
      includePaymentFields: canUsePaymentFields,
      includeDeliveryFields: canUseDeliveryFields
    });

    if (Object.keys(overdueWhere).length > 0) {
      and.push(overdueWhere);
    }
  }

  return and.length > 0 ? { AND: and } : {};
}

export function overviewOrderWhere({
  dateRange,
  staffId
}: {
  dateRange: { gte?: Date; lte?: Date } | undefined;
  staffId: string | undefined;
}): Prisma.OrderWhereInput {
  return {
    createdById: staffId,
    createdAt: dateRange
  };
}

export function overviewSalesAggregateArgs(orderDateWhere: Prisma.OrderWhereInput) {
  return {
    where: { ...orderDateWhere, status: { not: "CANCELLED" } },
    _sum: { totalAmount: true }
  } satisfies Prisma.OrderAggregateArgs;
}

export function overviewOutstandingBalanceAggregateArgs(orderDateWhere: Prisma.OrderWhereInput) {
  return {
    where: { ...orderDateWhere, status: { not: "CANCELLED" }, balanceAmount: { gt: 0 } },
    _sum: { balanceAmount: true }
  } satisfies Prisma.OrderAggregateArgs;
}

export function orderListSelect(permissions: ReportPermissions) {
  return {
    id: true,
    orderNumber: true,
    customerDisplayNameSnapshot: true,
    companyNameSnapshot: true,
    contactPersonNameSnapshot: true,
    status: true,
    deliveryStatus: true,
    createdAt: true,
    updatedAt: true,
    ...(permissions.canViewPayments
      ? {
          paymentStatus: true,
          paymentDueTiming: true,
          paymentDueDate: true,
          totalAmount: true,
          paidAmount: true,
          balanceAmount: true,
          lastPaymentAt: true
        }
      : {}),
    deliveries: permissions.canViewDeliveries
      ? {
          where: {
            status: {
              in: [...activeDeliveryStatuses]
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
      : false
  } satisfies Prisma.OrderSelect;
}
