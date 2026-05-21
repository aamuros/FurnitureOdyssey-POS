import { canViewModule, type UserWithPermissions } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

const closedOrderStatuses = ["COMPLETED", "CANCELLED"] as const;
const pendingPaymentStatuses = [
  "UNPAID",
  "DOWNPAYMENT_PAID",
  "PARTIALLY_PAID",
  "BALANCE_DUE_ON_DELIVERY"
] as const;
const activeDeliveryStatuses = ["PLANNED", "SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED"] as const;

export type DashboardKpiCard = {
  key: string;
  label: string;
  value: string;
  detail: string;
};

export type DashboardAttentionItem = {
  key: string;
  title: string;
  detail: string;
  href: string;
  sourceOrderId?: string;
};

function manilaDayRange(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((current, part) => {
      if (part.type !== "literal") {
        current[part.type] = part.value;
      }

      return current;
    }, {});

  const start = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000+08:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
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

function orderLabel(orderNumber: string | null, fallback = "Order") {
  return orderNumber ?? fallback;
}

function customerDetail(customerName: string | null | undefined, canViewCustomers: boolean) {
  return canViewCustomers && customerName ? customerName : "Customer details hidden";
}

export async function getDashboardOperations(user: UserWithPermissions) {
  const { start: todayStart, end: tomorrowStart } = manilaDayRange();
  const now = new Date();
  const canViewCustomers = canViewModule(user, "CUSTOMERS");
  const canViewQuotations = canViewModule(user, "QUOTATIONS");
  const canViewOrders = canViewModule(user, "ORDERS");
  const canViewPayments = canViewModule(user, "PAYMENTS");
  const canViewDeliveries = canViewModule(user, "DELIVERIES");

  const [
    todaySales,
    openOrderCount,
    pendingPaymentCount,
    deliveryDueCount,
    overduePaymentOrders,
    dueDeliveries,
    fulfillmentOrders,
    quotationActions
  ] = await Promise.all([
    canViewPayments
      ? prisma.payment.aggregate({
          where: {
            status: "RECORDED",
            paymentDate: {
              gte: todayStart,
              lt: tomorrowStart
            }
          },
          _sum: {
            amount: true
          }
        })
      : Promise.resolve(null),
    canViewOrders
      ? prisma.order.count({
          where: {
            status: {
              notIn: [...closedOrderStatuses]
            }
          }
        })
      : Promise.resolve(null),
    canViewPayments
      ? prisma.order.count({
          where: {
            status: {
              notIn: [...closedOrderStatuses]
            },
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
          }
        })
      : Promise.resolve(null),
    canViewDeliveries
      ? prisma.delivery.count({
          where: {
            scheduledDate: {
              lt: tomorrowStart
            },
            status: {
              in: [...activeDeliveryStatuses]
            }
          }
        })
      : Promise.resolve(null),
    canViewPayments
      ? prisma.order.findMany({
          where: {
            status: {
              notIn: [...closedOrderStatuses]
            },
            balanceAmount: {
              gt: 0
            },
            paymentDueDate: {
              lt: now
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
          take: 2,
          select: {
            id: true,
            orderNumber: true,
            customerDisplayNameSnapshot: true,
            balanceAmount: true,
            paymentDueDate: true
          }
        })
      : Promise.resolve([]),
    canViewDeliveries
      ? prisma.delivery.findMany({
          where: {
            scheduledDate: {
              lt: tomorrowStart
            },
            status: {
              in: [...activeDeliveryStatuses]
            }
          },
          orderBy: [
            {
              scheduledDate: "asc"
            },
            {
              createdAt: "desc"
            }
          ],
          take: 2,
          select: {
            id: true,
            deliveryNumber: true,
            scheduledDate: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                customerDisplayNameSnapshot: true
              }
            }
          }
        })
      : Promise.resolve([]),
    canViewOrders
      ? prisma.order.findMany({
          where: {
            status: {
              notIn: [...closedOrderStatuses]
            },
            deliveryStatus: {
              in: ["NOT_SCHEDULED", "SCHEDULED", "PARTIALLY_DELIVERED"]
            }
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: 2,
          select: {
            id: true,
            orderNumber: true,
            customerDisplayNameSnapshot: true,
            deliveryStatus: true
          }
        })
      : Promise.resolve([]),
    canViewQuotations
      ? prisma.quotation.findMany({
          where: {
            OR: [
              {
                status: "SENT"
              },
              {
                status: "ACCEPTED",
                order: null
              }
            ]
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: 2,
          select: {
            id: true,
            quotationNumber: true,
            status: true,
            customer: {
              select: {
                displayName: true
              }
            }
          }
        })
      : Promise.resolve([])
  ]);

  const kpiCards: DashboardKpiCard[] = [
    ...(todaySales
      ? [
          {
            key: "today-sales",
            label: "Today's Sales",
            value: formatMoney(todaySales._sum.amount),
            detail: "Recorded payments today"
          }
        ]
      : []),
    ...(openOrderCount !== null
      ? [
          {
            key: "open-orders",
            label: "Open Orders",
            value: formatNumber(openOrderCount),
            detail: "Not completed or cancelled"
          }
        ]
      : []),
    ...(pendingPaymentCount !== null
      ? [
          {
            key: "pending-payments",
            label: "Pending Payments",
            value: formatNumber(pendingPaymentCount),
            detail: "Orders with open balances"
          }
        ]
      : []),
    ...(deliveryDueCount !== null
      ? [
          {
            key: "deliveries-due",
            label: "Deliveries Due",
            value: formatNumber(deliveryDueCount),
            detail: "Due today or overdue"
          }
        ]
      : [])
  ];
  const seenOrders = new Set<string>();
  const attentionItems: DashboardAttentionItem[] = [];
  const addAttentionItem = (item: DashboardAttentionItem) => {
    if (item.sourceOrderId && seenOrders.has(item.sourceOrderId)) {
      return;
    }

    if (item.sourceOrderId) {
      seenOrders.add(item.sourceOrderId);
    }

    attentionItems.push(item);
  };

  overduePaymentOrders.forEach((order) => {
    addAttentionItem({
      key: `payment-${order.id}`,
      title: `Collect ${formatMoney(order.balanceAmount)} for ${orderLabel(order.orderNumber)}`,
      detail: `Due ${formatDate(order.paymentDueDate)} - ${customerDetail(
        order.customerDisplayNameSnapshot,
        canViewCustomers
      )}`,
      href: canViewOrders ? `/orders?orderId=${order.id}` : "/payments",
      sourceOrderId: order.id
    });
  });

  dueDeliveries.forEach((delivery) => {
    addAttentionItem({
      key: `delivery-${delivery.id}`,
      title: `Confirm ${delivery.deliveryNumber ?? "delivery"} for ${orderLabel(
        delivery.order.orderNumber
      )}`,
      detail: `${formatDate(delivery.scheduledDate)} - ${customerDetail(
        delivery.order.customerDisplayNameSnapshot,
        canViewCustomers
      )}`,
      href: "/deliveries",
      sourceOrderId: delivery.order.id
    });
  });

  fulfillmentOrders.forEach((order) => {
    const action =
      order.deliveryStatus === "NOT_SCHEDULED" ? "Schedule delivery" : "Review fulfillment";

    addAttentionItem({
      key: `fulfillment-${order.id}`,
      title: `${action} for ${orderLabel(order.orderNumber)}`,
      detail: customerDetail(order.customerDisplayNameSnapshot, canViewCustomers),
      href: `/orders?orderId=${order.id}`,
      sourceOrderId: order.id
    });
  });

  quotationActions.forEach((quotation) => {
    addAttentionItem({
      key: `quotation-${quotation.id}`,
      title:
        quotation.status === "SENT"
          ? `Follow up ${quotation.quotationNumber ?? "quotation"}`
          : `Convert ${quotation.quotationNumber ?? "accepted quotation"}`,
      detail: customerDetail(quotation.customer.displayName, canViewCustomers),
      href: `/quotations/${quotation.id}`
    });
  });

  return {
    attentionItems: attentionItems.slice(0, 5),
    kpiCards
  };
}
