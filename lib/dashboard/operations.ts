import type { Prisma } from "@prisma/client";
import { canViewModule, isAdmin, type UserWithPermissions } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { manilaDayRange, type ReportRangePreset } from "@/lib/reporting/date-range";

const closedOrderStatuses = ["COMPLETED", "CANCELLED"] as const;
const pendingPaymentStatuses = [
  "UNPAID",
  "DOWNPAYMENT_PAID",
  "PARTIALLY_PAID",
  "BALANCE_DUE_ON_DELIVERY"
] as const;
const activeDeliveryStatuses = ["PLANNED", "SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED"] as const;

type DashboardMetric = {
  key: string;
  label: string;
  value: string;
  detail?: string;
};

export type DashboardKpiCard = DashboardMetric;

export type DashboardAttentionItem = {
  key: string;
  title: string;
  detail: string;
  href: string;
  sourceOrderId?: string;
};

export type DashboardRecentActivity = {
  key: string;
  title: string;
  detail: string;
  href: string;
  timestamp: string;
  occurredAt: Date;
};

type DashboardPermissions = {
  canViewCustomers: boolean;
  canViewQuotations: boolean;
  canViewOrders: boolean;
  canViewPayments: boolean;
  canViewDeliveries: boolean;
};

type RecentCandidate = Omit<DashboardRecentActivity, "timestamp">;

function daysAgo(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value ?? 0));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-PH").format(value);
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "No date set";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric"
  }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function jsonString(value: unknown, key: string) {
  if (value && typeof value === "object" && key in value) {
    const raw = (value as Record<string, unknown>)[key];
    return typeof raw === "string" && raw.trim() ? raw : null;
  }

  return null;
}

function addressLine(value: unknown) {
  const parts = [
    jsonString(value, "recipientName"),
    jsonString(value, "phone"),
    jsonString(value, "addressLine"),
    jsonString(value, "city"),
    jsonString(value, "province"),
    jsonString(value, "postalCode")
  ];

  return parts.filter(Boolean).join(" - ") || null;
}

function orderLabel(orderNumber: string | null, fallback = "Order") {
  return orderNumber ?? fallback;
}

function quotationLabel(quotationNumber: string | null, fallback = "quotation") {
  return quotationNumber ?? fallback;
}

function customerDetail(customerName: string | null | undefined, canViewCustomers: boolean) {
  return canViewCustomers && customerName ? customerName : "Customer details hidden";
}

function openOrderWhere(): Prisma.OrderWhereInput {
  return {
    status: {
      notIn: [...closedOrderStatuses]
    }
  };
}

function pendingPaymentWhere(): Prisma.OrderWhereInput {
  return {
    ...openOrderWhere(),
    OR: [
      {
        balanceAmount: {
          gt: 0
        }
      },
      {
        paymentStatus: {
          in: [...pendingPaymentStatuses]
        }
      }
    ]
  };
}

function outstandingBalanceWhere(): Prisma.OrderWhereInput {
  return {
    ...openOrderWhere(),
    balanceAmount: {
      gt: 0
    }
  };
}

function dueDeliveryWhere(dateRange: { gte?: Date; lte?: Date }): Prisma.DeliveryWhereInput {
  return {
    scheduledDate: dateRange,
    status: {
      in: [...activeDeliveryStatuses]
    }
  };
}

export function assignedDueDeliveryWhere(
  dateRange: { gte?: Date; lte?: Date },
  userId: string,
  showAllDeliveries: boolean
): Prisma.DeliveryWhereInput {
  return {
    ...dueDeliveryWhere(dateRange),
    ...(showAllDeliveries ? {} : { assignedStaffId: userId })
  };
}

function pLimit(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  function next() {
    if (queue.length > 0 && active < concurrency) {
      active++;
      queue.shift()!();
    }
  }

  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn().then(resolve, reject).finally(() => {
          active--;
          next();
        });
      });
      next();
    });
}

function buildKpiCards({
  paymentsInRange,
  profitInRange,
  openOrderCount,
  awaitingFulfillmentCount,
  outstandingBalance,
  deliveryDueCount
}: {
  paymentsInRange: Prisma.GetPaymentAggregateType<{ _count: true; _sum: { amount: true } }> | null;
  profitInRange: Prisma.GetOrderAggregateType<{ _sum: { grossProfitAmount: true } }> | null;
  openOrderCount: number | null;
  awaitingFulfillmentCount: number | null;
  outstandingBalance: Prisma.GetOrderAggregateType<{ _count: true; _sum: { balanceAmount: true } }> | null;
  deliveryDueCount: number | null;
}) {
  const unpaidOrderCount = outstandingBalance?._count ?? null;
  const unpaidOrderBalance = outstandingBalance?._sum.balanceAmount ?? 0;

  const cards: DashboardKpiCard[] = [];

  if (paymentsInRange) {
    cards.push({
      key: "sales",
      label: "Sales",
      value: formatMoney(paymentsInRange._sum.amount),
      detail: "Recorded payments in selected period"
    });
  }

  if (unpaidOrderCount !== null) {
    cards.push({
      key: "outstanding-balance",
      label: "Outstanding Balance",
      value: formatMoney(unpaidOrderBalance),
      detail: `Unpaid order balance in selected period - ${formatNumber(unpaidOrderCount)} ${
        unpaidOrderCount === 1 ? "order" : "orders"
      }`
    });
  }

  if (profitInRange) {
    cards.push({
      key: "profit",
      label: "Profit",
      value: formatMoney(profitInRange._sum.grossProfitAmount),
      detail: "Gross profit in selected period"
    });
  }

  if (openOrderCount !== null) {
    cards.push({
      key: "open-orders",
      label: "Open Orders",
      value: formatNumber(openOrderCount),
      detail:
        awaitingFulfillmentCount !== null
          ? `${formatNumber(awaitingFulfillmentCount)} awaiting fulfillment in selected period`
          : "Open orders created in selected period"
    });
  }

  if (deliveryDueCount !== null) {
    cards.push({
      key: "deliveries-due",
      label: "Deliveries Due",
      value: formatNumber(deliveryDueCount),
      detail: "Due in selected period"
    });
  }

  return cards;
}

function buildPeriodMetrics({
  permissions,
  paymentsInRange,
  ordersCreatedInRange,
  quotationsCreatedInRange,
  deliveriesScheduledInRange
}: {
  permissions: DashboardPermissions;
  paymentsInRange: Prisma.GetPaymentAggregateType<{ _count: true; _sum: { amount: true } }> | null;
  ordersCreatedInRange: number | null;
  quotationsCreatedInRange: number | null;
  deliveriesScheduledInRange: number | null;
}) {
  const today: DashboardMetric[] = [];

  if (permissions.canViewPayments && paymentsInRange) {
    today.push({
      key: "payments-in-range",
      label: "Payments recorded",
      value: formatNumber(paymentsInRange._count),
      detail: formatMoney(paymentsInRange._sum.amount)
    });
  }

  if (permissions.canViewOrders && ordersCreatedInRange !== null) {
    today.push({
      key: "orders-created-in-range",
      label: "Orders created",
      value: formatNumber(ordersCreatedInRange)
    });
  }

  if (permissions.canViewQuotations && quotationsCreatedInRange !== null) {
    today.push({
      key: "quotations-created-in-range",
      label: "Quotations created",
      value: formatNumber(quotationsCreatedInRange)
    });
  }

  if (permissions.canViewDeliveries && deliveriesScheduledInRange !== null) {
    today.push({
      key: "deliveries-scheduled-in-range",
      label: "Deliveries scheduled",
      value: formatNumber(deliveriesScheduledInRange)
    });
  }

  return today.slice(0, 4);
}

function buildAttentionItems({
  canViewCustomers,
  canViewOrders,
  missingDeliveryOrders,
  paymentRiskOrders,
  dueDeliveries,
  fulfillmentOrders,
  quotationActions
}: {
  canViewCustomers: boolean;
  canViewOrders: boolean;
  missingDeliveryOrders: Array<{
    id: string;
    orderNumber: string | null;
    customerDisplayNameSnapshot: string;
    createdAt: Date;
  }>;
  paymentRiskOrders: Array<{
    id: string;
    orderNumber: string | null;
    customerDisplayNameSnapshot: string;
    balanceAmount: unknown;
    paymentDueDate: Date | null;
  }>;
  dueDeliveries: Array<{
    id: string;
    deliveryNumber: string | null;
    status: string;
    scheduledDate: Date | null;
    scheduledTimeWindow: string | null;
    deliveryAddressSnapshot: unknown;
    order: {
      id: string;
      orderNumber: string | null;
      customerDisplayNameSnapshot: string;
      deliveryAddressSnapshot: unknown;
    };
  }>;
  fulfillmentOrders: Array<{
    id: string;
    orderNumber: string | null;
    customerDisplayNameSnapshot: string;
    deliveryStatus: string;
  }>;
  quotationActions: Array<{
    id: string;
    quotationNumber: string | null;
    status: string;
    updatedAt: Date;
    customer: {
      displayName: string;
    };
  }>;
}) {
  const seenOrders = new Set<string>();
  const attentionItems: DashboardAttentionItem[] = [];
  const addAttentionItem = (item: DashboardAttentionItem) => {
    if (attentionItems.length >= 3) {
      return;
    }

    if (item.sourceOrderId && seenOrders.has(item.sourceOrderId)) {
      return;
    }

    if (item.sourceOrderId) {
      seenOrders.add(item.sourceOrderId);
    }

    attentionItems.push(item);
  };

  dueDeliveries.forEach((delivery) => {
    const deliveryAddress =
      addressLine(delivery.deliveryAddressSnapshot) ?? addressLine(delivery.order.deliveryAddressSnapshot);
    const deliveryTiming = [formatDate(delivery.scheduledDate), delivery.scheduledTimeWindow].filter(Boolean).join(", ");
    const detailParts = [
      customerDetail(delivery.order.customerDisplayNameSnapshot, canViewCustomers),
      deliveryTiming,
      delivery.status.replaceAll("_", " ").toLowerCase(),
      deliveryAddress
    ].filter(Boolean);

    addAttentionItem({
      key: `delivery-${delivery.id}`,
      title: `Complete delivery for ${orderLabel(delivery.order.orderNumber)}`,
      detail: detailParts.join(" - "),
      href: `/orders?orderId=${delivery.order.id}`,
      sourceOrderId: delivery.order.id
    });
  });

  paymentRiskOrders.forEach((order) => {
    addAttentionItem({
      key: `payment-${order.id}`,
      title: `Collect ${formatMoney(order.balanceAmount)} on ${orderLabel(order.orderNumber)}`,
      detail: `Due ${formatDate(order.paymentDueDate)} - ${customerDetail(
        order.customerDisplayNameSnapshot,
        canViewCustomers
      )}`,
      href: canViewOrders ? `/orders?orderId=${order.id}` : "/payments",
      sourceOrderId: order.id
    });
  });

  missingDeliveryOrders.forEach((order) => {
    addAttentionItem({
      key: `schedule-${order.id}`,
      title: `Schedule delivery for ${orderLabel(order.orderNumber)}`,
      detail: `${customerDetail(order.customerDisplayNameSnapshot, canViewCustomers)} - created ${formatDate(
        order.createdAt
      )}`,
      href: `/orders?orderId=${order.id}`,
      sourceOrderId: order.id
    });
  });

  fulfillmentOrders.forEach((order) => {
    addAttentionItem({
      key: `fulfillment-${order.id}`,
      title: `Fulfill ${orderLabel(order.orderNumber)}`,
      detail: `${customerDetail(order.customerDisplayNameSnapshot, canViewCustomers)} - ${order.deliveryStatus
        .replaceAll("_", " ")
        .toLowerCase()}`,
      href: `/orders?orderId=${order.id}`,
      sourceOrderId: order.id
    });
  });

  quotationActions.forEach((quotation) => {
    addAttentionItem({
      key: `quotation-${quotation.id}`,
      title:
        quotation.status === "SENT"
          ? `Follow up ${quotationLabel(quotation.quotationNumber)}`
          : `Review ${quotationLabel(quotation.quotationNumber, "quotation")}`,
      detail: `${customerDetail(quotation.customer.displayName, canViewCustomers)} - updated ${formatDate(
        quotation.updatedAt
      )}`,
      href: `/quotations/${quotation.id}`
    });
  });

  return attentionItems;
}

function buildRecentActivity(candidates: RecentCandidate[]) {
  return candidates
    .sort((first, second) => second.occurredAt.getTime() - first.occurredAt.getTime())
    .slice(0, 3)
    .map((candidate) => ({
      ...candidate,
      timestamp: formatDateTime(candidate.occurredAt)
    }));
}

export async function getDashboardOperations(
  user: UserWithPermissions,
  options: {
    dateRange?: { gte?: Date; lte?: Date };
    range?: ReportRangePreset;
    rangeLabel?: string;
    fromInput?: string;
    toInput?: string;
  } = {}
) {
  const todayRange = manilaDayRange();
  const selectedDateRange = options.dateRange ?? todayRange.dateRange;
  const now = new Date();
  const quotationAgingDate = daysAgo(now, 3);
  const adminDashboard = isAdmin(user);
  const permissions: DashboardPermissions = {
    canViewCustomers: canViewModule(user, "CUSTOMERS"),
    canViewQuotations: canViewModule(user, "QUOTATIONS"),
    canViewOrders: canViewModule(user, "ORDERS"),
    canViewPayments: canViewModule(user, "PAYMENTS"),
    canViewDeliveries: canViewModule(user, "DELIVERIES")
  };

  const limit = pLimit(5);

  const [
    openOrderCount,
    awaitingFulfillmentCount,
    outstandingBalance,
    deliveryDueCount,
    paymentsInRange,
    profitInRange,
    ordersCreatedInRange,
    quotationsCreatedInRange,
    deliveriesScheduledInRange,
    missingDeliveryOrders,
    paymentRiskOrders,
    dueDeliveries,
    fulfillmentOrders,
    quotationActions,
    recentPayments,
    recentOrders,
    recentQuotations,
    recentDeliveries
  ] = await Promise.all([
    limit(() =>
      permissions.canViewOrders
        ? prisma.order.count({
            where: {
              ...openOrderWhere(),
              createdAt: selectedDateRange
            }
          })
        : Promise.resolve(null)
    ),
    limit(() =>
      permissions.canViewOrders
        ? prisma.order.count({
            where: {
              ...openOrderWhere(),
              createdAt: selectedDateRange,
              deliveryStatus: {
                notIn: ["DELIVERED", "CANCELLED"]
              }
            }
          })
        : Promise.resolve(null)
    ),
    limit(() =>
      permissions.canViewPayments
        ? prisma.order.aggregate({
            where: {
              ...outstandingBalanceWhere(),
              createdAt: selectedDateRange
            },
            _count: true,
            _sum: {
              balanceAmount: true
            }
          })
        : Promise.resolve(null)
    ),
    limit(() =>
      permissions.canViewDeliveries
        ? prisma.delivery.count({
            where: assignedDueDeliveryWhere(selectedDateRange, user.id, adminDashboard)
          })
        : Promise.resolve(null)
    ),
    limit(() =>
      permissions.canViewPayments
        ? prisma.payment.aggregate({
            where: {
              status: "RECORDED",
              paymentDate: selectedDateRange
            },
            _count: true,
            _sum: {
              amount: true
            }
          })
        : Promise.resolve(null)
    ),
    limit(() =>
      permissions.canViewOrders && permissions.canViewPayments
        ? prisma.order.aggregate({
            where: {
              status: {
                not: "CANCELLED"
              },
              createdAt: selectedDateRange
            },
            _sum: {
              grossProfitAmount: true
            }
          })
        : Promise.resolve(null)
    ),
    limit(() =>
      permissions.canViewOrders
        ? prisma.order.count({
            where: {
              createdAt: selectedDateRange
            }
          })
        : Promise.resolve(null)
    ),
    limit(() =>
      permissions.canViewQuotations
        ? prisma.quotation.count({
            where: {
              createdAt: selectedDateRange
            }
          })
        : Promise.resolve(null)
    ),
    limit(() =>
      permissions.canViewDeliveries
        ? prisma.delivery.count({
            where: {
              scheduledDate: selectedDateRange,
              status: {
                notIn: ["DELIVERED", "CANCELLED", "FAILED"]
              }
            }
          })
        : Promise.resolve(null)
    ),
    limit(() =>
      permissions.canViewOrders
        ? prisma.order.findMany({
            where: {
              ...openOrderWhere(),
              createdAt: selectedDateRange,
              deliveryStatus: "NOT_SCHEDULED"
            },
            orderBy: [
              {
                createdAt: "asc"
              },
              {
                updatedAt: "desc"
              }
            ],
            take: 3,
            select: {
              id: true,
              orderNumber: true,
              customerDisplayNameSnapshot: true,
              createdAt: true
            }
          })
        : Promise.resolve([])
    ),
    limit(() =>
      permissions.canViewPayments
        ? prisma.order.findMany({
            where: {
              ...pendingPaymentWhere(),
              OR: [
                {
                  paymentDueDate: {
                    ...selectedDateRange,
                    lt: now
                  }
                },
                {
                  paymentStatus: "UNPAID",
                  createdAt: selectedDateRange
                },
                {
                  balanceAmount: {
                    gt: 0
                  },
                  createdAt: selectedDateRange
                }
              ]
            },
            orderBy: [
              {
                paymentDueDate: "asc"
              },
              {
                updatedAt: "desc"
              }
            ],
            take: 4,
            select: {
              id: true,
              orderNumber: true,
              customerDisplayNameSnapshot: true,
              balanceAmount: true,
              paymentDueDate: true
            }
          })
        : Promise.resolve([])
    ),
    limit(() =>
      permissions.canViewDeliveries
        ? prisma.delivery.findMany({
            where: assignedDueDeliveryWhere(selectedDateRange, user.id, adminDashboard),
            orderBy: [
              {
                scheduledDate: "asc"
              },
              {
                createdAt: "desc"
              }
            ],
            take: 4,
            select: {
              id: true,
              deliveryNumber: true,
              status: true,
              scheduledDate: true,
              scheduledTimeWindow: true,
              deliveryAddressSnapshot: true,
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  customerDisplayNameSnapshot: true,
                  deliveryAddressSnapshot: true
                }
              }
            }
          })
        : Promise.resolve([])
    ),
    limit(() =>
      permissions.canViewOrders
        ? prisma.order.findMany({
            where: {
              ...openOrderWhere(),
              OR: [{ updatedAt: selectedDateRange }, { createdAt: selectedDateRange }],
              deliveryStatus: {
                in: ["SCHEDULED", "PARTIALLY_DELIVERED"]
              }
            },
            orderBy: {
              updatedAt: "desc"
            },
            take: 3,
            select: {
              id: true,
              orderNumber: true,
              customerDisplayNameSnapshot: true,
              deliveryStatus: true
            }
          })
        : Promise.resolve([])
    ),
    limit(() =>
      permissions.canViewQuotations
        ? prisma.quotation.findMany({
            where: {
              OR: [
                {
                  status: "SENT",
                  updatedAt: {
                    ...selectedDateRange,
                    lt: quotationAgingDate
                  }
                },
                {
                  status: "ACCEPTED",
                  createdAt: selectedDateRange,
                  order: null
                }
              ]
            },
            orderBy: {
              updatedAt: "asc"
            },
            take: 4,
            select: {
              id: true,
              quotationNumber: true,
              status: true,
              updatedAt: true,
              customer: {
                select: {
                  displayName: true
                }
              }
            }
          })
        : Promise.resolve([])
    ),
    limit(() =>
      permissions.canViewPayments
        ? prisma.payment.findMany({
            where: {
              status: "RECORDED",
              paymentDate: selectedDateRange
            },
            orderBy: [
              {
                paymentDate: "desc"
              },
              {
                createdAt: "desc"
              }
            ],
            take: 5,
            select: {
              id: true,
              paymentNumber: true,
              amount: true,
              paymentDate: true,
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  customerDisplayNameSnapshot: true
                }
              }
            }
          })
        : Promise.resolve([])
    ),
    limit(() =>
      permissions.canViewOrders
        ? prisma.order.findMany({
            where: {
              createdAt: selectedDateRange
            },
            orderBy: {
              createdAt: "desc"
            },
            take: 5,
            select: {
              id: true,
              orderNumber: true,
              customerDisplayNameSnapshot: true,
              totalAmount: true,
              createdAt: true
            }
          })
        : Promise.resolve([])
    ),
    limit(() =>
      permissions.canViewQuotations
        ? prisma.quotation.findMany({
            where: {
              createdAt: selectedDateRange
            },
            orderBy: {
              createdAt: "desc"
            },
            take: 5,
            select: {
              id: true,
              quotationNumber: true,
              totalAmount: true,
              createdAt: true,
              customer: {
                select: {
                  displayName: true
                }
              }
            }
          })
        : Promise.resolve([])
    ),
    limit(() =>
      permissions.canViewDeliveries
        ? prisma.delivery.findMany({
            where: {
              updatedAt: selectedDateRange
            },
            orderBy: {
              updatedAt: "desc"
            },
            take: 5,
            select: {
              id: true,
              deliveryNumber: true,
              status: true,
              updatedAt: true,
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  customerDisplayNameSnapshot: true
                }
              }
            }
          })
        : Promise.resolve([])
    )
  ]);

  const recentCandidates: RecentCandidate[] = [
    ...recentPayments.map((payment) => ({
      key: `payment-${payment.id}`,
      title: `Payment recorded: ${formatMoney(payment.amount)}`,
      detail: `${payment.paymentNumber ?? orderLabel(payment.order.orderNumber)} - ${customerDetail(
        payment.order.customerDisplayNameSnapshot,
        permissions.canViewCustomers
      )}`,
      href: permissions.canViewOrders ? `/orders?orderId=${payment.order.id}` : "/payments",
      occurredAt: payment.paymentDate
    })),
    ...recentOrders.map((order) => ({
      key: `order-${order.id}`,
      title: `Order created: ${orderLabel(order.orderNumber)}`,
      detail: `${customerDetail(order.customerDisplayNameSnapshot, permissions.canViewCustomers)} - ${formatMoney(
        order.totalAmount
      )}`,
      href: `/orders?orderId=${order.id}`,
      occurredAt: order.createdAt
    })),
    ...recentQuotations.map((quotation) => ({
      key: `quotation-${quotation.id}`,
      title: `Quotation created: ${quotationLabel(quotation.quotationNumber, "quotation")}`,
      detail: `${customerDetail(quotation.customer.displayName, permissions.canViewCustomers)} - ${formatMoney(
        quotation.totalAmount
      )}`,
      href: `/quotations/${quotation.id}`,
      occurredAt: quotation.createdAt
    })),
    ...recentDeliveries.map((delivery) => ({
      key: `delivery-${delivery.id}`,
      title: `Delivery updated: ${delivery.deliveryNumber ?? orderLabel(delivery.order.orderNumber)}`,
      detail: `${orderLabel(delivery.order.orderNumber)} - ${delivery.status.replaceAll("_", " ").toLowerCase()}`,
      href: "/deliveries",
      occurredAt: delivery.updatedAt
    }))
  ];

  return {
    attentionItems: buildAttentionItems({
      canViewCustomers: permissions.canViewCustomers,
      canViewOrders: permissions.canViewOrders,
      missingDeliveryOrders,
      paymentRiskOrders,
      dueDeliveries,
      fulfillmentOrders,
      quotationActions
    }),
    kpiCards: buildKpiCards({
      paymentsInRange,
      profitInRange,
      openOrderCount,
      awaitingFulfillmentCount,
      outstandingBalance,
      deliveryDueCount
    }),
    todayMetrics: buildPeriodMetrics({
      permissions,
      paymentsInRange,
      ordersCreatedInRange,
      quotationsCreatedInRange,
      deliveriesScheduledInRange
    }),
    recentActivity: buildRecentActivity(recentCandidates)
  };
}
