import Link from "next/link";
import { OrderDeliveryStatus, OrderPaymentStatus, OrderStatus, Prisma } from "@prisma/client";
import { OrderFilters } from "@/components/dashboard/order-filters";
import { OrderWorkspace } from "@/components/dashboard/order-workspace";
import { PageHeader } from "@/components/dashboard/page-header";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import {
  canCompleteOrder as canCompleteOrderWorkflow,
  canScheduleOrderDelivery
} from "@/lib/orders/status";
import { timeQuery } from "@/lib/query-timing";

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
  pdfDetails: unknown;
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

const orderViews = ["all", "needsAction", "unfinished", "hasBalance", "scheduledDelivery"] as const;

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

function normalizeIntegerQuantity(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function activeDeliveryRank(status: string) {
  if (status === "IN_TRANSIT") {
    return 0;
  }

  if (status === "SCHEDULED") {
    return 1;
  }

  if (status === "PLANNED") {
    return 2;
  }

  return 3;
}

function findActiveDelivery(deliveries: OrderListDelivery[]) {
  return deliveries
    .filter((delivery) => delivery.scheduledDate && ["PLANNED", "SCHEDULED", "IN_TRANSIT"].includes(delivery.status))
    .sort((first, second) => {
      const statusRank = activeDeliveryRank(first.status) - activeDeliveryRank(second.status);

      if (statusRank !== 0) {
        return statusRank;
      }

      return Number(first.scheduledDate) - Number(second.scheduledDate);
    })[0] ?? null;
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

function normalizePdfDetailsRows(
  value: unknown,
  fallbackRows: Array<{ id: string; label: string; value: string }>
) {
  if (!Array.isArray(value)) {
    return fallbackRows;
  }

  const rows = value
    .slice(0, 12)
    .map((row, index) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const record = row as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim().slice(0, 80) : "";
      const rowValue = typeof record.value === "string" ? record.value.trim().slice(0, 200) : "";

      if (!label || !rowValue) {
        return null;
      }

      return {
        id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : `row-${index + 1}`,
        label,
        value: rowValue
      };
    })
    .filter((row): row is { id: string; label: string; value: string } => Boolean(row));

  return rows.length ? rows : fallbackRows;
}

function defaultDeliveryPdfDetails(
  orderNumber: string | null,
  delivery: Pick<OrderListDelivery, "deliveryNumber" | "scheduledDate" | "scheduledTimeWindow">
) {
  return [
    { id: "row-1", label: "Order", value: orderNumber ?? "Not assigned" },
    {
      id: "row-2",
      label: "Delivery receipt number",
      value: delivery.deliveryNumber ?? "Auto-generated after saving/export"
    },
    { id: "row-3", label: "Scheduled date", value: formatDate(delivery.scheduledDate) ?? "Not scheduled" },
    { id: "row-4", label: "Time window", value: delivery.scheduledTimeWindow ?? "Not set" }
  ];
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

function buildOrderWhere({
  selectedOrderId,
  orderStatus,
  paymentStatus,
  deliveryStatus,
  from,
  to,
  visibleBalanceFilter,
  assignedStaffId,
  query,
  canViewPayments,
  canViewDeliveries,
  visibleScheduledDeliveryFilter,
  selectedView,
  canExportDocuments
}: {
  selectedOrderId?: string;
  orderStatus?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  deliveryStatus?: OrderDeliveryStatus;
  from?: Date;
  to?: Date;
  visibleBalanceFilter?: "yes" | "no";
  assignedStaffId?: string;
  query?: string;
  canViewPayments: boolean;
  canViewDeliveries: boolean;
  visibleScheduledDeliveryFilter?: "yes" | "no";
  selectedView: (typeof orderViews)[number];
  canExportDocuments: boolean;
}): Prisma.OrderWhereInput {
  if (selectedOrderId) {
    return {
      id: selectedOrderId
    };
  }

  return {
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
  const requestedView = enumValue(orderViews, params.view) ?? "all";
  const page = Math.max(Number(params.page ?? 1) || 1, 1);

  const canUpdateOrders = hasPermission(user, "ORDERS", "UPDATE");
  const canDeleteOrders = hasPermission(user, "ORDERS", "DELETE");
  const canCreateCustomers = hasPermission(user, "CUSTOMERS", "CREATE");
  const canViewProducts = hasPermission(user, "PRODUCTS", "VIEW");
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
      ? "all"
      : requestedView;

  const orderWhere = buildOrderWhere({
    selectedOrderId,
    orderStatus,
    paymentStatus,
    deliveryStatus,
    from,
    to,
    visibleBalanceFilter,
    assignedStaffId,
    query,
    canViewPayments,
    canViewDeliveries,
    visibleScheduledDeliveryFilter,
    selectedView,
    canExportDocuments
  });

  const [staff, customerOptions, productOptions, orderCount, orderMetrics, orders] = await Promise.all([
    timeQuery("orders:staff-options", prisma.userProfile.findMany({
      where: {
        status: "ACTIVE",
        role: {
          in: ["ADMIN", "STAFF"]
        },
        OR: [
          { role: "ADMIN" },
          {
            permissions: {
              some: {
                module: "DELIVERIES",
                action: {
                  in: ["VIEW", "CREATE", "UPDATE"]
                },
                allowed: true
              }
            }
          }
        ]
      },
      orderBy: {
        displayName: "asc"
      },
      select: {
        id: true,
        displayName: true
      }
    })),
    timeQuery("orders:customer-options", prisma.customer.findMany({
      where: { archivedAt: null },
      orderBy: { displayName: "asc" },
      include: {
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 1
        }
      }
    })),
    timeQuery("orders:product-options", canViewProducts ? prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      include: {
        images: {
          where: { colorVariantId: null },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          take: 1
        },
        colorVariants: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: {
            images: {
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
              take: 1
            }
          }
        }
      }
    }) : Promise.resolve([])),
    timeQuery("orders:count", prisma.order.count({
      where: orderWhere
    })),
    timeQuery("orders:metrics", canViewPayments ? prisma.order.aggregate({
      where: orderWhere,
      _sum: {
        totalAmount: true,
        grossProfitAmount: true
      }
    }) : Promise.resolve(null)),
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
        customerId: true,
        customerDisplayNameSnapshot: true,
        customerTypeSnapshot: true,
        companyNameSnapshot: true,
        contactPersonNameSnapshot: true,
        primaryContactSnapshot: true,
        billingAddressSnapshot: true,
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
        orderDiscountValue: true,
        assemblyFeeTotal: true,
        salesInvoiceFeeTotal: true,
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
            productId: true,
            itemType: true,
            sortOrder: true,
            snapshotProductCode: true,
            itemName: true,
            description: true,
            specifications: true,
            quantity: true,
            unitPrice: true,
            unitCostSnapshot: true,
            discountType: true,
            discountValue: true,
            lineCostTotal: true,
            lineProfit: true,
            lineTotal: true,
            discountAmount: true,
            requiresAssembly: true,
            customerNotes: true,
            internalNotes: true,
            images: {
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
              select: {
                id: true,
                sourceQuotationItemImageId: true,
                sourceProductImageId: true,
                cloudinaryPublicId: true,
                secureUrl: true,
                resourceType: true,
                format: true,
                width: true,
                height: true,
                bytes: true,
                altText: true,
                sortOrder: true,
                isPrimary: true
              }
            },
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
                pdfDetails: true,
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
    view: selectedView === "all" ? undefined : selectedView,
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
  const queueViews = [
    { value: "all", label: "All", visible: true },
    { value: "needsAction", label: "Needs Action", visible: true },
    { value: "unfinished", label: "Unfinished", visible: true },
    { value: "hasBalance", label: "Has Balance", visible: canViewPayments },
    { value: "scheduledDelivery", label: "Scheduled delivery", visible: canViewDeliveries }
  ].filter((view) => view.visible) as Array<{
    value: (typeof orderViews)[number];
    label: string;
    visible: boolean;
  }>;
  const profitValue = canViewPayments ? formatMoney(orderMetrics?._sum.grossProfitAmount ?? 0) : "Restricted";
  const salesTotalValue = canViewPayments ? formatMoney(orderMetrics?._sum.totalAmount ?? 0) : "Restricted";

  return (
    <>
      <PageHeader
        title="Orders"
        description="Scan open orders, balances, delivery schedules, documents, and the next staff action."
      />
      <OrderFilters
        query={params.q ?? ""}
        selectedView={selectedView}
        orderStatus={orderStatus ?? ""}
        paymentStatus={paymentStatus ?? ""}
        deliveryStatus={deliveryStatus ?? ""}
        assignedStaffId={assignedStaffId ?? ""}
        from={params.from ?? ""}
        to={params.to ?? ""}
        hasBalance={hasBalance ?? ""}
        hasScheduledDelivery={hasScheduledDelivery ?? ""}
        canViewPayments={canViewPayments}
        canViewDeliveries={canViewDeliveries}
        moreFiltersOpen={moreFiltersOpen}
        orderStatuses={[...orderStatuses]}
        paymentStatuses={[...paymentStatuses]}
        deliveryStatuses={[...deliveryStatuses]}
        staff={staff}
        views={queueViews}
        profitValue={profitValue}
        salesTotalValue={salesTotalValue}
      />
      <OrderWorkspace
        canUpdateOrders={canUpdateOrders}
        canDeleteOrders={canDeleteOrders}
        canViewPayments={canViewPayments}
        canCreatePayments={canCreatePayments}
        canViewDeliveries={canViewDeliveries}
        canCreateDeliveries={canCreateDeliveries}
        canUpdateDeliveries={canUpdateDeliveries}
        canExportDocuments={canExportDocuments}
        canCreateCustomers={canCreateCustomers}
        canViewProducts={canViewProducts}
        initialSelectedOrderId={selectedOrderId}
        persistenceUserKey={user.id}
        customers={customerOptions.map((customer) => ({
          id: customer.id,
          displayName: customer.displayName,
          companyName: customer.companyName,
          primaryContact: customer.contacts[0]
            ? `${customer.contacts[0].type.replaceAll("_", " ").toLowerCase()}: ${customer.contacts[0].value}`
            : null
        }))}
        products={productOptions.map((product) => {
          const primaryImage = product.images[0] ?? null;

          return {
            id: product.id,
            code: product.code,
            name: product.name,
            category: product.category,
            description: product.description,
            specifications: product.specifications,
            referencePrice: product.referencePrice !== null ? Number(product.referencePrice) : null,
            referenceCost: product.referenceCost !== null ? Number(product.referenceCost) : null,
            primaryImage: primaryImage
              ? {
                  id: primaryImage.id,
                  cloudinaryPublicId: primaryImage.cloudinaryPublicId,
                  secureUrl: primaryImage.secureUrl,
                  resourceType: primaryImage.resourceType,
                  format: primaryImage.format,
                  width: primaryImage.width,
                  height: primaryImage.height,
                  bytes: primaryImage.bytes,
                  altText: primaryImage.altText
                }
              : null,
            colorVariants: product.colorVariants.map((variant) => {
              const variantImage = variant.images[0] ?? null;

              return {
                id: variant.id,
                name: variant.name,
                hex: variant.hex,
                image: variantImage
                  ? {
                      id: variantImage.id,
                      cloudinaryPublicId: variantImage.cloudinaryPublicId,
                      secureUrl: variantImage.secureUrl,
                      resourceType: variantImage.resourceType,
                      format: variantImage.format,
                      width: variantImage.width,
                      height: variantImage.height,
                      bytes: variantImage.bytes,
                      altText: variantImage.altText
                    }
                  : null
              };
            })
          };
        })}
        staffOptions={staff.map((member) => ({
          id: member.id,
          displayName: member.displayName
        }))}
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
          const activeDelivery = findActiveDelivery(deliveries);
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
            customerId: order.customerId,
            customerName: order.customerDisplayNameSnapshot,
            customerType: order.customerTypeSnapshot,
            companyName: order.companyNameSnapshot,
            contactPersonName: order.contactPersonNameSnapshot,
            contactSnapshot: contactLine(order.primaryContactSnapshot) ?? contactLine(order.customer.contacts[0] ?? null),
            billingAddressSnapshot: addressLine(order.billingAddressSnapshot),
            deliveryAddressSnapshot: canViewDeliveries ? addressLine(order.deliveryAddressSnapshot) : null,
            assignedStaff,
            sourceType: order.sourceType,
            status: order.status,
            paymentStatus: order.paymentStatus,
            paymentDueTiming: order.paymentDueTiming,
            paymentDueDate: formatOptionalInputDate(order.paymentDueDate),
            deliveryStatus: order.deliveryStatus,
            nextDeliveryStatus: canViewDeliveries ? activeDelivery?.status ?? null : null,
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
            orderDiscountValue: Number(order.orderDiscountValue ?? 0),
            assemblyFeeTotalValue: Number(order.assemblyFeeTotal ?? 0),
            salesInvoiceFeeTotalValue: Number(order.salesInvoiceFeeTotal ?? 0),
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
                (sum, deliveryItem) => sum + normalizeIntegerQuantity(deliveryItem.quantityPlanned),
                0
              );
              const deliveredQuantity = deliveryItems.reduce(
                (sum, deliveryItem) => sum + normalizeIntegerQuantity(deliveryItem.quantityDelivered),
                0
              );
              const openScheduledQuantity = Math.max(plannedQuantity - deliveredQuantity, 0);
              const quantity = normalizeIntegerQuantity(item.quantity);

              return {
                id: item.id,
                orderItemId: item.id,
                productId: item.productId,
                itemType: item.itemType,
                sortOrder: item.sortOrder,
                snapshotProductCode: item.snapshotProductCode,
                selectedVariantId: null,
                selectedVariantName: null,
                selectedVariantHex: null,
                itemName: item.itemName,
                description: item.description ?? "",
                specifications: item.specifications ?? "",
                quantity,
                unitPriceValue: Number(item.unitPrice),
                unitCostSnapshotValue: Number(item.unitCostSnapshot),
                discountType: item.discountType,
                discountValue: Number(item.discountValue ?? item.discountAmount ?? 0),
                requiresAssembly: item.requiresAssembly,
                plannedQuantity: openScheduledQuantity,
                remainingQuantity: canViewDeliveries
                  ? Math.max(quantity - plannedQuantity, 0)
                  : 0,
                unitPrice: canViewPayments ? formatMoney(item.unitPrice) : "Restricted",
                unitCostSnapshot: canViewPayments ? formatMoney(item.unitCostSnapshot) : "Restricted",
                lineCostTotal: canViewPayments ? formatMoney(item.lineCostTotal) : "Restricted",
                lineProfit: canViewPayments ? formatMoney(item.lineProfit) : "Restricted",
                lineTotal: canViewPayments ? formatMoney(item.lineTotal) : "Restricted",
                deliveredQuantity: canViewDeliveries ? deliveredQuantity : 0,
                discountAmount: canViewPayments ? formatMoney(item.discountAmount) : "Restricted",
                customerNotes: item.customerNotes,
                internalNotes: item.internalNotes,
                images: item.images.map((image, imageIndex) => ({
                  sourceQuotationItemImageId: image.sourceQuotationItemImageId ?? undefined,
                  sourceProductImageId: image.sourceProductImageId ?? undefined,
                  cloudinaryPublicId: image.cloudinaryPublicId,
                  secureUrl: image.secureUrl,
                  resourceType: image.resourceType,
                  format: image.format ?? undefined,
                  width: image.width ?? undefined,
                  height: image.height ?? undefined,
                  bytes: image.bytes ?? undefined,
                  altText: image.altText ?? undefined,
                  sortOrder: image.sortOrder ?? imageIndex,
                  isPrimary: image.isPrimary || imageIndex === 0
                }))
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
              pdfDetails: normalizePdfDetailsRows(
                delivery.pdfDetails,
                defaultDeliveryPdfDetails(order.orderNumber, delivery)
              ),
              addressLine: addressLine(delivery.deliveryAddressSnapshot),
              receiptGenerated: delivery.documents.length > 0,
              itemCount: delivery._count.items,
              assignedStaff: delivery.assignedStaff?.displayName ?? null,
              items: delivery.items.map((item) => ({
                id: item.id,
                itemName: item.orderItem.itemName,
                quantityPlanned: normalizeIntegerQuantity(item.quantityPlanned),
                quantityDelivered: normalizeIntegerQuantity(item.quantityDelivered)
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
