import Link from "next/link";
import { Prisma } from "@prisma/client";
import { NewOrderLauncher, OrderWorkspace } from "@/components/dashboard/order-workspace";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { readableLabel } from "@/lib/orders/status-labels";
import {
  canCompleteOrder as canCompleteOrderWorkflow,
  canScheduleOrderDelivery
} from "@/lib/orders/status";
import { timeQuery } from "@/lib/query-timing";
import { cn } from "@/lib/utils";

type OrdersPageProps = {
  searchParams?: Promise<{
    q?: string;
    orderStatus?: string;
    paymentStatus?: string;
    deliveryStatus?: string;
    assignedStaffId?: string;
    from?: string;
    to?: string;
    hasBalance?: string;
    hasScheduledDelivery?: string;
    unfinished?: string;
    needsAction?: string;
    view?: string;
    orderId?: string;
    page?: string;
  }>;
};

type OrderListDeliveryItem = {
  quantityPlanned: unknown;
  quantityDelivered: unknown;
};

type OrderListPayment = {
  id: string;
  paymentNumber: string | null;
  paymentDate: Date;
  amount: unknown;
  paymentType: string;
  method: string | null;
  status: string;
  referenceNumber: string | null;
  payerName: string | null;
  receiptGenerated: boolean;
  documents: Array<{ id: string }>;
};

type OrderListDelivery = {
  id: string;
  deliveryNumber: string | null;
  status: string;
  scheduledDate: Date | null;
  scheduledTimeWindow: string | null;
  deliveryProviderType: string | null;
  deliveryProviderName: string | null;
  deliveryProviderReference: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  deliveryAddressSnapshot: unknown;
  documents: Array<{ id: string }>;
  assignedStaff: { displayName: string } | null;
  _count: { items: number };
  items: Array<{
    id: string;
    quantityPlanned: unknown;
    quantityDelivered: unknown;
    orderItem: {
      itemName: string;
    };
  }>;
};

type OrderListDocument = {
  id: string;
  documentType: string;
  title: string;
  status: string;
  paymentId: string | null;
  deliveryId: string | null;
};

const pageSize = 25;

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

const paymentStatuses = [
  "UNPAID",
  "DOWNPAYMENT_PAID",
  "PARTIALLY_PAID",
  "BALANCE_DUE_ON_DELIVERY",
  "PAID",
  "REFUNDED",
  "PARTIALLY_REFUNDED"
] as const;

const deliveryStatuses = [
  "NOT_SCHEDULED",
  "SCHEDULED",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "CANCELLED"
] as const;

const orderViews = ["needsAction", "unfinished", "hasBalance", "scheduledDelivery", "all"] as const;

function formatDate(value: Date | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function formatInputDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value));
}

function formatOptionalInputDate(value: Date | null) {
  return value ? formatInputDate(value) : "";
}

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function uuid(value: string | undefined) {
  const trimmed = clean(value);
  return trimmed &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      trimmed
    )
    ? trimmed
    : undefined;
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function enumValue<T extends readonly string[]>(values: T, value: string | undefined) {
  return values.includes(value ?? "") ? (value as T[number]) : undefined;
}

function jsonString(value: unknown, key: string) {
  if (value && typeof value === "object" && key in value) {
    const raw = (value as Record<string, unknown>)[key];
    return typeof raw === "string" && raw.trim() ? raw : null;
  }

  return null;
}

function contactLine(value: unknown) {
  const type = jsonString(value, "type");
  const label = jsonString(value, "label");
  const contactValue = jsonString(value, "value");

  if (!contactValue) {
    return null;
  }

  return [label ?? type?.replaceAll("_", " ").toLowerCase(), contactValue].filter(Boolean).join(": ");
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

  return parts.filter(Boolean).join(" · ") || null;
}

function dateRangeWhere(from: Date | undefined, to: Date | undefined) {
  return from || to
    ? {
        gte: from,
        lte: to
      }
    : undefined;
}

function ordersHref(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined> = {}
) {
  const next = new URLSearchParams();

  for (const [paramKey, paramValue] of Object.entries(params)) {
    if (paramValue && paramKey !== "page") {
      next.set(paramKey, paramValue);
    }
  }

  for (const [paramKey, paramValue] of Object.entries(updates)) {
    if (paramValue) {
      next.set(paramKey, paramValue);
    } else {
      next.delete(paramKey);
    }
  }

  const query = next.toString();
  return query ? `/orders?${query}` : "/orders";
}

function searchWhere(
  query: string | undefined,
  canViewPayments: boolean,
  canViewDeliveries: boolean
): Prisma.OrderWhereInput[] | undefined {
  if (!query) {
    return undefined;
  }

  const clauses: Prisma.OrderWhereInput[] = [
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
          OR: [
            { itemName: { contains: query, mode: "insensitive" } },
            { snapshotProductCode: { contains: query, mode: "insensitive" } }
          ]
        }
      }
    },
    {
      inquiry: {
        sourceReference: { contains: query, mode: "insensitive" }
      }
    }
  ];

  if (canViewPayments) {
    clauses.push({
      payments: {
        some: {
          referenceNumber: { contains: query, mode: "insensitive" }
        }
      }
    });
  }

  if (canViewDeliveries) {
    clauses.push({
      deliveries: {
        some: {
          OR: [
            { deliveryProviderName: { contains: query, mode: "insensitive" } },
            { deliveryProviderReference: { contains: query, mode: "insensitive" } }
          ]
        }
      }
    });
  }

  return clauses;
}

function scheduledDeliveryWhere(value: string | undefined): Prisma.OrderWhereInput | undefined {
  if (value === "yes") {
    return {
      deliveries: {
        some: {
          scheduledDate: {
            not: null
          },
          status: {
            notIn: ["DELIVERED", "FAILED", "CANCELLED"]
          }
        }
      }
    };
  }

  if (value === "no") {
    return {
      deliveries: {
        none: {
          scheduledDate: {
            not: null
          },
          status: {
            notIn: ["DELIVERED", "FAILED", "CANCELLED"]
          }
        }
      }
    };
  }

  return undefined;
}

function unfinishedWhere(enabled: boolean): Prisma.OrderWhereInput | undefined {
  if (!enabled) {
    return undefined;
  }

  return {
    status: {
      not: "CANCELLED"
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
          notIn: ["DELIVERED", "CANCELLED"]
        }
      },
      {
        status: {
          in: [
            "DRAFT",
            "CONFIRMED",
            "PARTIALLY_PAID",
            "SCHEDULED_FOR_DELIVERY",
            "PARTIALLY_DELIVERED"
          ]
        }
      },
      {
        deliveries: {
          some: {
            scheduledDate: {
              not: null
            },
            status: {
              notIn: ["DELIVERED", "FAILED", "CANCELLED"]
            }
          }
        }
      }
    ]
  };
}

function needsActionWhere(
  enabled: boolean,
  canViewPayments: boolean,
  canViewDeliveries: boolean,
  canExportDocuments: boolean
): Prisma.OrderWhereInput | undefined {
  if (!enabled) {
    return undefined;
  }

  const clauses: Prisma.OrderWhereInput[] = [];

  if (canViewPayments) {
    clauses.push(
      {
        balanceAmount: {
          gt: 0
        }
      },
      {
        paymentStatus: {
          not: "PAID"
        }
      }
    );
  }

  if (canViewDeliveries) {
    clauses.push(
      {
        deliveryStatus: {
          in: ["NOT_SCHEDULED", "SCHEDULED", "PARTIALLY_DELIVERED"]
        }
      },
      {
        deliveries: {
          some: {
            scheduledDate: {
              not: null
            },
            status: {
              notIn: ["DELIVERED", "FAILED", "CANCELLED"]
            }
          }
        }
      }
    );
  }

  if (canExportDocuments) {
    clauses.push({
      documents: {
        none: {
          documentType: "INVOICE"
        }
      },
      salesInvoiceRequested: true
    });
  }

  if (clauses.length === 0) {
    return {
      id: "00000000-0000-0000-0000-000000000000"
    };
  }

  return {
    status: {
      not: "CANCELLED"
    },
    OR: clauses
  };
}

function orderViewWhere(
  view: (typeof orderViews)[number],
  canViewPayments: boolean,
  canViewDeliveries: boolean,
  canExportDocuments: boolean
): Prisma.OrderWhereInput | undefined {
  if (view === "needsAction") {
    return needsActionWhere(true, canViewPayments, canViewDeliveries, canExportDocuments);
  }

  if (view === "unfinished") {
    return unfinishedWhere(true);
  }

  if (view === "hasBalance" && canViewPayments) {
    return {
      status: {
        not: "CANCELLED"
      },
      balanceAmount: {
        gt: 0
      }
    };
  }

  if (view === "scheduledDelivery" && canViewDeliveries) {
    return {
      status: {
        not: "CANCELLED"
      },
      deliveries: {
        some: {
          scheduledDate: {
            not: null
          },
          status: {
            notIn: ["DELIVERED", "FAILED", "CANCELLED"]
          }
        }
      }
    };
  }

  return undefined;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const user = await requirePermission("ORDERS", "VIEW");
  const params = (await searchParams) ?? {};
  const query = clean(params.q);
  const orderStatus = enumValue(orderStatuses, params.orderStatus);
  const requestedPaymentStatus = enumValue(paymentStatuses, params.paymentStatus);
  const requestedDeliveryStatus = enumValue(deliveryStatuses, params.deliveryStatus);
  const assignedStaffId = uuid(params.assignedStaffId);
  const selectedOrderId = uuid(params.orderId);
  const from = parseDate(params.from);
  const to = parseDate(params.to, true);
  const hasBalance = params.hasBalance === "yes" || params.hasBalance === "no" ? params.hasBalance : undefined;
  const hasScheduledDelivery =
    params.hasScheduledDelivery === "yes" || params.hasScheduledDelivery === "no"
      ? params.hasScheduledDelivery
      : undefined;
  const legacyView =
    params.needsAction === "true"
      ? "needsAction"
      : params.unfinished === "true"
        ? "unfinished"
        : hasBalance === "yes"
          ? "hasBalance"
          : hasScheduledDelivery === "yes"
            ? "scheduledDelivery"
            : undefined;
  const requestedView = enumValue(orderViews, params.view) ?? legacyView ?? "needsAction";
  const page = Math.max(Number(params.page ?? 1) || 1, 1);

  const canCreateOrders = hasPermission(user, "ORDERS", "CREATE");
  const canUpdateOrders = hasPermission(user, "ORDERS", "UPDATE");
  const canViewPayments = hasPermission(user, "PAYMENTS", "VIEW");
  const canCreatePayments = hasPermission(user, "PAYMENTS", "CREATE");
  const canViewDeliveries = hasPermission(user, "DELIVERIES", "VIEW");
  const canCreateDeliveries = hasPermission(user, "DELIVERIES", "CREATE");
  const canUpdateDeliveries = hasPermission(user, "DELIVERIES", "UPDATE");
  const canExportDocuments = hasPermission(user, "DOCUMENTS", "EXPORT");
  const paymentStatus = canViewPayments ? requestedPaymentStatus : undefined;
  const deliveryStatus = canViewDeliveries ? requestedDeliveryStatus : undefined;
  const visibleBalanceFilter = canViewPayments ? hasBalance : undefined;
  const visibleScheduledDeliveryFilter = canViewDeliveries ? hasScheduledDelivery : undefined;
  const selectedView = selectedOrderId
    ? "all"
    : (requestedView === "hasBalance" && !canViewPayments) ||
        (requestedView === "scheduledDelivery" && !canViewDeliveries)
      ? "needsAction"
      : requestedView;

  const orderWhere: Prisma.OrderWhereInput = selectedOrderId
    ? {
        id: selectedOrderId
      }
    : {
        status: orderStatus,
        paymentStatus,
        deliveryStatus,
        createdAt: dateRangeWhere(from, to),
        ...(visibleBalanceFilter === "yes"
          ? {
              balanceAmount: {
                gt: 0
              }
            }
          : {}),
        ...(visibleBalanceFilter === "no"
          ? {
              balanceAmount: 0
            }
          : {}),
        ...(assignedStaffId
          ? {
              OR: [
                { createdById: assignedStaffId },
                { updatedById: assignedStaffId },
                {
                  customer: {
                    assignedStaffId
                  }
                },
                {
                  deliveries: {
                    some: {
                      assignedStaffId
                    }
                  }
                }
              ]
            }
          : {}),
        AND: [
          { OR: searchWhere(query, canViewPayments, canViewDeliveries) },
          scheduledDeliveryWhere(visibleScheduledDeliveryFilter),
          orderViewWhere(selectedView, canViewPayments, canViewDeliveries, canExportDocuments)
        ].filter(Boolean) as Prisma.OrderWhereInput[]
      };

  const [staff, orderCount, orders] = await Promise.all([
    timeQuery("orders:staff-options", prisma.userProfile.findMany({
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
    })),
    timeQuery("orders:count", prisma.order.count({
      where: orderWhere
    })),
    timeQuery("orders:list", prisma.order.findMany({
      where: orderWhere,
      orderBy: {
        updatedAt: "desc"
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        orderNumber: true,
        customerDisplayNameSnapshot: true,
        companyNameSnapshot: true,
        contactPersonNameSnapshot: true,
        primaryContactSnapshot: true,
        deliveryAddressSnapshot: true,
        sourceType: true,
        status: true,
        paymentStatus: true,
        paymentDueTiming: true,
        paymentDueDate: true,
        deliveryStatus: true,
        needsAssembly: true,
        salesInvoiceRequested: true,
        modeOfDelivery: true,
        deliveryMethod: true,
        paymentTerms: true,
        specialInstructions: true,
        totalAmount: true,
        paidAmount: true,
        balanceAmount: true,
        subtotalAmount: true,
        itemDiscountTotal: true,
        orderDiscountAmount: true,
        totalCostAmount: true,
        grossProfitAmount: true,
        customerNotes: true,
        internalNotes: true,
        createdAt: true,
        updatedAt: true,
        lastPaymentAt: true,
        customer: {
          select: {
            contacts: {
              orderBy: [
                {
                  isPrimary: "desc"
                },
                {
                  createdAt: "asc"
                }
              ],
              take: 1,
              select: {
                type: true,
                label: true,
                value: true
              }
            },
            assignedStaff: {
              select: {
                displayName: true
              }
            }
          }
        },
        quotation: {
          select: {
            id: true,
            quotationNumber: true,
            status: true
          }
        },
        inquiry: {
          select: {
            id: true,
            subject: true,
            source: true,
            sourceReference: true
          }
        },
        createdBy: {
          select: {
            displayName: true
          }
        },
        items: {
          orderBy: {
            sortOrder: "asc"
          },
          select: {
            id: true,
            itemName: true,
            quantity: true,
            unitPrice: true,
            unitCostSnapshot: true,
            lineCostTotal: true,
            lineProfit: true,
            lineTotal: true,
            discountAmount: true,
            customerNotes: true,
            internalNotes: true,
            deliveryItems: {
              where: {
                delivery: {
                  status: {
                    notIn: ["CANCELLED", "FAILED"]
                  }
                }
              },
              select: {
                quantityPlanned: true,
                quantityDelivered: true
              }
            }
          }
        },
        payments: canViewPayments
          ? {
              orderBy: {
                paymentDate: "desc"
              },
              take: 8,
              select: {
                id: true,
                paymentNumber: true,
                paymentDate: true,
                amount: true,
                paymentType: true,
                method: true,
                status: true,
                referenceNumber: true,
                payerName: true,
                receiptGenerated: true,
                documents: {
                  where: {
                    documentType: "PAYMENT_RECEIPT"
                  },
                  select: {
                    id: true
                  },
                  take: 1
                }
              }
            }
          : false,
        deliveries: canViewDeliveries
          ? {
              orderBy: [
                {
                  scheduledDate: "asc"
                },
                {
                  createdAt: "desc"
                }
              ],
              take: 8,
              select: {
                id: true,
                deliveryNumber: true,
                status: true,
                scheduledDate: true,
                scheduledTimeWindow: true,
                deliveryProviderType: true,
                deliveryProviderName: true,
                deliveryProviderReference: true,
                recipientName: true,
                recipientPhone: true,
                deliveryAddressSnapshot: true,
                items: {
                  select: {
                    id: true,
                    quantityPlanned: true,
                    quantityDelivered: true,
                    orderItem: {
                      select: {
                        itemName: true
                      }
                    }
                  }
                },
                documents: {
                  where: {
                    documentType: "DELIVERY_RECEIPT"
                  },
                  select: {
                    id: true
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
            }
          : false,
        documents: canExportDocuments
          ? {
              orderBy: {
                createdAt: "desc"
              },
              take: 8,
              select: {
                id: true,
                documentType: true,
                title: true,
                status: true,
                paymentId: true,
                deliveryId: true
              }
            }
          : false
      }
    }))
  ]);
  const totalPages = Math.max(Math.ceil(orderCount / pageSize), 1);
  const pageParams = {
    q: params.q,
    view: selectedView === "needsAction" ? undefined : selectedView,
    orderStatus,
    paymentStatus,
    deliveryStatus,
    assignedStaffId,
    from: params.from,
    to: params.to,
    hasBalance: canViewPayments ? hasBalance : undefined,
    hasScheduledDelivery: canViewDeliveries ? hasScheduledDelivery : undefined
  };
  const moreFiltersOpen = Boolean(
    orderStatus ||
      paymentStatus ||
      deliveryStatus ||
      assignedStaffId ||
      params.from ||
      params.to ||
      (canViewPayments && params.hasBalance) ||
      (canViewDeliveries && params.hasScheduledDelivery)
  );
  const hasActiveFilters = selectedOrderId ? true : Object.values(pageParams).some(Boolean);
  const queueViews = [
    { value: "needsAction", label: "Needs action", visible: true },
    { value: "unfinished", label: "Unfinished", visible: true },
    { value: "hasBalance", label: "Has balance", visible: canViewPayments },
    { value: "scheduledDelivery", label: "Scheduled delivery", visible: canViewDeliveries },
    { value: "all", label: "All", visible: true }
  ].filter((view) => view.visible) as Array<{
    value: (typeof orderViews)[number];
    label: string;
    visible: boolean;
  }>;

  return (
    <>
      <PageHeader
        title="Orders"
        description="Scan open orders, balances, delivery schedules, documents, and the next staff action."
      >
        <NewOrderLauncher
          canCreateOrders={canCreateOrders}
          canViewPayments={canViewPayments}
        />
      </PageHeader>
      <form className="mb-5 space-y-3 rounded-lg border border-border bg-panel p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto]">
          <Input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search orders, customers, phone, item..."
            aria-label="Search orders"
          />
          <Select name="view" defaultValue={selectedView} aria-label="View orders" className="lg:hidden">
            <option value="needsAction">Needs action</option>
            <option value="unfinished">Unfinished</option>
            {canViewPayments ? <option value="hasBalance">Has balance</option> : null}
            {canViewDeliveries ? <option value="scheduledDelivery">Scheduled delivery</option> : null}
            <option value="all">All</option>
          </Select>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
          {hasActiveFilters ? (
            <Link
              href="/orders"
              className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted/60"
            >
              Clear
            </Link>
          ) : null}
        </div>

        <nav className="hidden items-center gap-2 overflow-x-auto lg:flex" aria-label="Order queue views">
          {queueViews.map((view) => {
            const active = selectedView === view.value;

            return (
              <Link
                key={view.value}
                href={ordersHref(pageParams, {
                  view: view.value === "needsAction" ? undefined : view.value,
                  hasBalance: undefined,
                  hasScheduledDelivery: undefined
                })}
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

        <details open={moreFiltersOpen} className="border-t border-border pt-3">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">More filters</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Select name="orderStatus" defaultValue={orderStatus ?? ""} aria-label="Order status">
              <option value="">Any order status</option>
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {readableLabel(status)}
                </option>
              ))}
            </Select>
            {canViewPayments ? (
              <Select name="paymentStatus" defaultValue={paymentStatus ?? ""} aria-label="Payment status">
                <option value="">Any payment status</option>
                {paymentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {readableLabel(status)}
                  </option>
                ))}
              </Select>
            ) : null}
            {canViewDeliveries ? (
              <Select name="deliveryStatus" defaultValue={deliveryStatus ?? ""} aria-label="Delivery status">
                <option value="">Any delivery status</option>
                {deliveryStatuses.map((status) => (
                  <option key={status} value={status}>
                    {readableLabel(status)}
                  </option>
                ))}
              </Select>
            ) : null}
            <Select name="assignedStaffId" defaultValue={assignedStaffId ?? ""}>
              <option value="">All staff</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </Select>
            <Input name="from" type="date" defaultValue={params.from ?? ""} aria-label="Created from" />
            <Input name="to" type="date" defaultValue={params.to ?? ""} aria-label="Created to" />
            {canViewPayments ? (
              <Select name="hasBalance" defaultValue={hasBalance ?? ""}>
                <option value="">Any balance</option>
                <option value="yes">Has balance</option>
                <option value="no">No balance</option>
              </Select>
            ) : null}
            {canViewDeliveries ? (
              <Select name="hasScheduledDelivery" defaultValue={hasScheduledDelivery ?? ""}>
                <option value="">Any schedule</option>
                <option value="yes">Scheduled delivery</option>
                <option value="no">Not scheduled</option>
              </Select>
            ) : null}
          </div>
        </details>
      </form>
      <OrderWorkspace
        canUpdateOrders={canUpdateOrders}
        canViewPayments={canViewPayments}
        canCreatePayments={canCreatePayments}
        canViewDeliveries={canViewDeliveries}
        canCreateDeliveries={canCreateDeliveries}
        canUpdateDeliveries={canUpdateDeliveries}
        canExportDocuments={canExportDocuments}
        initialSelectedOrderId={selectedOrderId}
        orders={orders.map((order) => {
          const payments = (
            canViewPayments && "payments" in order ? order.payments : []
          ) as unknown as OrderListPayment[];
          const deliveries = (
            canViewDeliveries && "deliveries" in order ? order.deliveries : []
          ) as unknown as OrderListDelivery[];
          const documents = (
            canExportDocuments && "documents" in order ? order.documents : []
          ) as OrderListDocument[];
          const activeDelivery = deliveries.find(
            (delivery) =>
              delivery.scheduledDate && !["DELIVERED", "FAILED", "CANCELLED"].includes(delivery.status)
          );
          const assignedStaff =
            order.customer.assignedStaff?.displayName ??
            deliveries.find((delivery) => delivery.assignedStaff)?.assignedStaff?.displayName ??
            order.createdBy?.displayName ??
            null;
          const orderItemsForDeliveryState = order.items.map((item) => ({
            quantity: item.quantity,
            deliveryItems: item.deliveryItems.map((deliveryItem) => ({
              quantityPlanned: deliveryItem.quantityPlanned
            }))
          }));
          const canScheduleDelivery = canScheduleOrderDelivery({
            status: order.status,
            paymentStatus: order.paymentStatus,
            balanceAmount: order.balanceAmount,
            paymentDueTiming: order.paymentDueTiming,
            deliveryStatus: order.deliveryStatus,
            items: orderItemsForDeliveryState
          });
          const canCompleteOrder = canCompleteOrderWorkflow({
            status: order.status,
            paymentStatus: order.paymentStatus,
            balanceAmount: order.balanceAmount,
            paymentDueTiming: order.paymentDueTiming,
            deliveryStatus: order.deliveryStatus
          });

          return {
            id: order.id,
            displayId: order.orderNumber ?? "Not assigned",
            customerName: order.customerDisplayNameSnapshot,
            companyName: order.companyNameSnapshot,
            contactPersonName: order.contactPersonNameSnapshot,
            contactSnapshot: contactLine(order.primaryContactSnapshot) ?? contactLine(order.customer.contacts[0] ?? null),
            deliveryAddressSnapshot: canViewDeliveries ? addressLine(order.deliveryAddressSnapshot) : null,
            assignedStaff,
            sourceType: order.sourceType,
            status: order.status,
            paymentStatus: order.paymentStatus,
            paymentDueTiming: order.paymentDueTiming,
            paymentDueDate: formatOptionalInputDate(order.paymentDueDate),
            deliveryStatus: order.deliveryStatus,
            canScheduleDelivery,
            canCompleteOrder,
            needsAssembly: order.needsAssembly,
            salesInvoiceRequested: order.salesInvoiceRequested,
            modeOfDelivery: order.modeOfDelivery,
            deliveryMethod: order.deliveryMethod,
            paymentTerms: order.paymentTerms,
            specialInstructions: order.specialInstructions,
            totalAmount: canViewPayments ? formatMoney(order.totalAmount) : "Restricted",
            totalAmountValue: canViewPayments ? Number(order.totalAmount) : 0,
            paidAmount: canViewPayments ? formatMoney(order.paidAmount) : "Restricted",
            paidAmountValue: canViewPayments ? Number(order.paidAmount) : 0,
            balanceAmount: canViewPayments ? formatMoney(order.balanceAmount) : "Restricted",
            balanceAmountValue: canViewPayments ? Number(order.balanceAmount) : 0,
            subtotalAmount: canViewPayments ? formatMoney(order.subtotalAmount) : "Restricted",
            itemDiscountTotal: canViewPayments ? formatMoney(order.itemDiscountTotal) : "Restricted",
            orderDiscountAmount: canViewPayments ? formatMoney(order.orderDiscountAmount) : "Restricted",
            totalCostAmount: canViewPayments ? formatMoney(order.totalCostAmount) : "Restricted",
            grossProfitAmount: canViewPayments ? formatMoney(order.grossProfitAmount) : "Restricted",
            customerNotes: order.customerNotes,
            internalNotes: order.internalNotes,
            relatedQuotationId: order.quotation?.id ?? null,
            relatedQuotationNumber: order.quotation?.quotationNumber ?? null,
            relatedQuotationStatus: order.quotation?.status ?? null,
            relatedInquiryId: order.inquiry?.id ?? null,
            relatedInquiryLabel: order.inquiry
              ? [order.inquiry.subject, order.inquiry.sourceReference].filter(Boolean).join(" · ")
              : null,
            createdAt: formatDateTime(order.createdAt),
            updatedAt: formatDateTime(order.updatedAt),
            lastPaymentDate: canViewPayments ? formatDate(order.lastPaymentAt) : null,
            nextDeliveryDate: canViewDeliveries ? formatDate(activeDelivery?.scheduledDate ?? null) : null,
            nextDeliveryProvider: canViewDeliveries
              ? activeDelivery?.deliveryProviderName ?? activeDelivery?.deliveryProviderType ?? null
              : null,
            items: order.items.map((item) => {
              const deliveryItems =
                (canViewDeliveries && "deliveryItems" in item ? item.deliveryItems : []) as OrderListDeliveryItem[];
              const plannedQuantity = deliveryItems.reduce(
                (sum, deliveryItem) => sum + Number(deliveryItem.quantityPlanned),
                0
              );

              return {
                id: item.id,
                itemName: item.itemName,
                quantity: Number(item.quantity),
                plannedQuantity,
                remainingQuantity: canViewDeliveries
                  ? Math.max(Number(item.quantity) - plannedQuantity, 0)
                  : 0,
                unitPrice: canViewPayments ? formatMoney(item.unitPrice) : "Restricted",
                unitCostSnapshot: canViewPayments ? formatMoney(item.unitCostSnapshot) : "Restricted",
                lineCostTotal: canViewPayments ? formatMoney(item.lineCostTotal) : "Restricted",
                lineProfit: canViewPayments ? formatMoney(item.lineProfit) : "Restricted",
                lineTotal: canViewPayments ? formatMoney(item.lineTotal) : "Restricted",
                deliveredQuantity: canViewDeliveries
                  ? deliveryItems.reduce(
                      (sum, deliveryItem) => sum + Number(deliveryItem.quantityDelivered),
                      0
                    )
                  : 0,
                discountAmount: canViewPayments ? formatMoney(item.discountAmount) : "Restricted",
                customerNotes: item.customerNotes,
                internalNotes: item.internalNotes
              };
            }),
            payments: canViewPayments ? payments.map((payment) => ({
              id: payment.id,
              paymentNumber: payment.paymentNumber,
              paymentDate: formatDate(payment.paymentDate) ?? "",
              amount: formatMoney(payment.amount),
              paymentType: payment.paymentType,
              method: payment.method,
              status: payment.status,
              referenceNumber: payment.referenceNumber,
              payerName: payment.payerName,
              receiptGenerated: payment.receiptGenerated || payment.documents.length > 0
            })) : [],
            deliveries: canViewDeliveries ? deliveries.map((delivery) => ({
              id: delivery.id,
              deliveryNumber: delivery.deliveryNumber,
              status: delivery.status,
              scheduledDate: delivery.scheduledDate ? formatInputDate(delivery.scheduledDate) : null,
              scheduledDateLabel: formatDate(delivery.scheduledDate),
              scheduledTimeWindow: delivery.scheduledTimeWindow,
              deliveryProviderType: delivery.deliveryProviderType,
              deliveryProviderName: delivery.deliveryProviderName,
              deliveryProviderReference: delivery.deliveryProviderReference,
              recipientName: delivery.recipientName,
              recipientPhone: delivery.recipientPhone,
              addressLine: addressLine(delivery.deliveryAddressSnapshot),
              receiptGenerated: delivery.documents.length > 0,
              itemCount: delivery._count.items,
              assignedStaff: delivery.assignedStaff?.displayName ?? null,
              items: delivery.items.map((item) => ({
                id: item.id,
                itemName: item.orderItem.itemName,
                quantityPlanned: Number(item.quantityPlanned),
                quantityDelivered: Number(item.quantityDelivered)
              }))
            })) : [],
            documents: documents.map((document) => ({
              id: document.id,
              documentType: document.documentType,
              title: document.title,
              status: document.status,
              paymentId: canViewPayments ? document.paymentId : null,
              deliveryId: canViewDeliveries ? document.deliveryId : null
            }))
          };
        })}
      />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-panel px-4 py-3 text-sm text-muted-foreground">
        <span>
          Showing {orders.length} of {orderCount} order(s), page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <span className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-md border border-border bg-panel px-4 text-sm font-medium opacity-60">
              Previous
            </span>
          ) : (
            <Link
              href={ordersHref(pageParams, { page: String(page - 1) })}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-panel px-4 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Previous
            </Link>
          )}
          {page >= totalPages ? (
            <span className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-md border border-border bg-panel px-4 text-sm font-medium opacity-60">
              Next
            </span>
          ) : (
            <Link
              href={ordersHref(pageParams, { page: String(page + 1) })}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-panel px-4 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
