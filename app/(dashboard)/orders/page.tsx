import Link from "next/link";
import { Prisma } from "@prisma/client";
import { OrderWorkspace } from "@/components/dashboard/order-workspace";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { readableLabel } from "@/lib/orders/status-labels";

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
    page?: string;
  }>;
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

function addParam(params: Record<string, string | undefined>, key: string, value: string) {
  const next = new URLSearchParams();

  for (const [paramKey, paramValue] of Object.entries(params)) {
    if (paramValue && paramKey !== "page") {
      next.set(paramKey, paramValue);
    }
  }

  next.set(key, value);
  return `/orders?${next.toString()}`;
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

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const user = await requirePermission("ORDERS", "VIEW");
  const params = (await searchParams) ?? {};
  const query = clean(params.q);
  const orderStatus = enumValue(orderStatuses, params.orderStatus);
  const paymentStatus = enumValue(paymentStatuses, params.paymentStatus);
  const deliveryStatus = enumValue(deliveryStatuses, params.deliveryStatus);
  const assignedStaffId = clean(params.assignedStaffId);
  const from = parseDate(params.from);
  const to = parseDate(params.to, true);
  const hasBalance = params.hasBalance === "yes" || params.hasBalance === "no" ? params.hasBalance : undefined;
  const hasScheduledDelivery =
    params.hasScheduledDelivery === "yes" || params.hasScheduledDelivery === "no"
      ? params.hasScheduledDelivery
      : undefined;
  const unfinished = params.unfinished === "true";
  const page = Math.max(Number(params.page ?? 1) || 1, 1);

  const canCreateOrders = hasPermission(user, "ORDERS", "CREATE");
  const canUpdateOrders = hasPermission(user, "ORDERS", "UPDATE");
  const canViewPayments = hasPermission(user, "PAYMENTS", "VIEW");
  const canCreatePayments = hasPermission(user, "PAYMENTS", "CREATE");
  const canViewDeliveries = hasPermission(user, "DELIVERIES", "VIEW");
  const canCreateDeliveries = hasPermission(user, "DELIVERIES", "CREATE");
  const canCreateDocuments = hasPermission(user, "DOCUMENTS", "CREATE");
  const canExportDocuments = hasPermission(user, "DOCUMENTS", "EXPORT");

  const orderWhere: Prisma.OrderWhereInput = {
    status: orderStatus,
    paymentStatus,
    deliveryStatus,
    createdAt: dateRangeWhere(from, to),
    ...(hasBalance === "yes"
      ? {
          balanceAmount: {
            gt: 0
          }
        }
      : {}),
    ...(hasBalance === "no"
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
      scheduledDeliveryWhere(hasScheduledDelivery),
      unfinishedWhere(unfinished)
    ].filter(Boolean) as Prisma.OrderWhereInput[]
  };

  const [customers, products, approvedQuotations, staff, orderCount, orders] = await Promise.all([
    prisma.customer.findMany({
      where: {
        archivedAt: null
      },
      orderBy: {
        displayName: "asc"
      },
      select: {
        id: true,
        displayName: true,
        companyName: true
      }
    }),
    prisma.product.findMany({
      where: {
        status: "ACTIVE"
      },
      orderBy: {
        name: "asc"
      },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        description: true,
        specifications: true,
        referencePrice: true
      }
    }),
    prisma.quotation.findMany({
      where: {
        status: "ACCEPTED",
        order: null
      },
      orderBy: {
        updatedAt: "desc"
      },
      include: {
        customer: {
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
    }),
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
    prisma.order.count({
      where: orderWhere
    }),
    prisma.order.findMany({
      where: orderWhere,
      orderBy: {
        updatedAt: "desc"
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: {
          include: {
            contacts: {
              orderBy: [
                {
                  isPrimary: "desc"
                },
                {
                  createdAt: "asc"
                }
              ],
              take: 3
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
          include: {
            deliveryItems: {
              where: {
                delivery: {
                  status: {
                    notIn: ["CANCELLED", "FAILED"]
                  }
                }
              }
            }
          }
        },
        payments: {
          orderBy: {
            paymentDate: "desc"
          },
          take: 8,
          include: {
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
        },
        deliveries: {
          orderBy: [
            {
              scheduledDate: "asc"
            },
            {
              createdAt: "desc"
            }
          ],
          take: 8,
          include: {
            items: {
              include: {
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
        },
        documents: {
          orderBy: {
            createdAt: "desc"
          },
          take: 8
        }
      }
    })
  ]);
  const totalPages = Math.max(Math.ceil(orderCount / pageSize), 1);
  const pageParams = {
    q: params.q,
    orderStatus: params.orderStatus,
    paymentStatus: params.paymentStatus,
    deliveryStatus: params.deliveryStatus,
    assignedStaffId: params.assignedStaffId,
    from: params.from,
    to: params.to,
    hasBalance: params.hasBalance,
    hasScheduledDelivery: params.hasScheduledDelivery,
    unfinished: params.unfinished
  };

  return (
    <>
      <PageHeader
        title="Orders"
        description="Internal order records for approved quotation conversion, manual orders, payments, delivery scheduling, documents, and sales history."
      />
      <form className="mb-6 grid gap-3 rounded-lg border border-border bg-panel p-4 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.9fr_0.7fr_0.7fr_0.8fr_0.8fr_auto]">
        <Input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search order, customer, company, contact, item, provider, reference"
        />
        <Select name="orderStatus" defaultValue={params.orderStatus ?? ""}>
          <option value="">Any order</option>
          {orderStatuses.map((status) => (
            <option key={status} value={status}>
              {readableLabel(status)}
            </option>
          ))}
        </Select>
        <Select name="paymentStatus" defaultValue={params.paymentStatus ?? ""}>
          <option value="">Any payment</option>
          {paymentStatuses.map((status) => (
            <option key={status} value={status}>
              {readableLabel(status)}
            </option>
          ))}
        </Select>
        <Select name="deliveryStatus" defaultValue={params.deliveryStatus ?? ""}>
          <option value="">Any delivery</option>
          {deliveryStatuses.map((status) => (
            <option key={status} value={status}>
              {readableLabel(status)}
            </option>
          ))}
        </Select>
        <Select name="assignedStaffId" defaultValue={params.assignedStaffId ?? ""}>
          <option value="">All staff</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </Select>
        <Input name="from" type="date" defaultValue={params.from ?? ""} aria-label="Created from" />
        <Input name="to" type="date" defaultValue={params.to ?? ""} aria-label="Created to" />
        <Select name="hasBalance" defaultValue={params.hasBalance ?? ""}>
          <option value="">Any balance</option>
          <option value="yes">Has balance</option>
          <option value="no">No balance</option>
        </Select>
        <Select name="hasScheduledDelivery" defaultValue={params.hasScheduledDelivery ?? ""}>
          <option value="">Any schedule</option>
          <option value="yes">Scheduled delivery</option>
          <option value="no">No scheduled delivery</option>
        </Select>
        <div className="flex gap-2">
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
            <input name="unfinished" type="checkbox" value="true" defaultChecked={unfinished} />
            Unfinished
          </label>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </div>
      </form>
      <OrderWorkspace
        canCreateOrders={canCreateOrders}
        canUpdateOrders={canUpdateOrders}
        canViewPayments={canViewPayments}
        canCreatePayments={canCreatePayments}
        canViewDeliveries={canViewDeliveries}
        canCreateDeliveries={canCreateDeliveries}
        canCreateDocuments={canCreateDocuments}
        canExportDocuments={canExportDocuments}
        customers={customers}
        products={products.map((product) => ({
          ...product,
          referencePrice: product.referencePrice ? Number(product.referencePrice) : null
        }))}
        approvedQuotations={approvedQuotations.map((quotation) => ({
          id: quotation.id,
          customerName: quotation.customer.displayName,
          totalAmount: formatMoney(quotation.totalAmount),
          itemCount: quotation._count.items
        }))}
        orders={orders.map((order) => {
          const activeDelivery = order.deliveries.find(
            (delivery) =>
              delivery.scheduledDate && !["DELIVERED", "FAILED", "CANCELLED"].includes(delivery.status)
          );
          const assignedStaff =
            order.customer.assignedStaff?.displayName ??
            order.deliveries.find((delivery) => delivery.assignedStaff)?.assignedStaff?.displayName ??
            order.createdBy?.displayName ??
            null;

          return {
            id: order.id,
            displayId: order.orderNumber ?? order.id.slice(0, 8),
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
            customerNotes: order.customerNotes,
            internalNotes: order.internalNotes,
            relatedQuotationId: order.quotation?.id ?? null,
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
            items: order.items.map((item) => ({
              id: item.id,
              itemName: item.itemName,
              quantity: Number(item.quantity),
              plannedQuantity: canViewDeliveries
                ? item.deliveryItems.reduce((sum, deliveryItem) => sum + Number(deliveryItem.quantityPlanned), 0)
                : 0,
              remainingQuantity: canViewDeliveries
                ? Math.max(
                    Number(item.quantity) -
                      item.deliveryItems.reduce(
                        (sum, deliveryItem) => sum + Number(deliveryItem.quantityPlanned),
                        0
                      ),
                    0
                  )
                : 0,
              unitPrice: canViewPayments ? formatMoney(item.unitPrice) : "Restricted",
              lineTotal: canViewPayments ? formatMoney(item.lineTotal) : "Restricted",
              deliveredQuantity: canViewDeliveries
                ? item.deliveryItems.reduce((sum, deliveryItem) => sum + Number(deliveryItem.quantityDelivered), 0)
                : 0,
              discountAmount: canViewPayments ? formatMoney(item.discountAmount) : "Restricted",
              customerNotes: item.customerNotes,
              internalNotes: item.internalNotes
            })),
            payments: canViewPayments ? order.payments.map((payment) => ({
              id: payment.id,
              paymentDate: formatDate(payment.paymentDate) ?? "",
              amount: formatMoney(payment.amount),
              paymentType: payment.paymentType,
              method: payment.method,
              status: payment.status,
              referenceNumber: payment.referenceNumber,
              payerName: payment.payerName,
              receiptGenerated: payment.receiptGenerated || payment.documents.length > 0
            })) : [],
            deliveries: canViewDeliveries ? order.deliveries.map((delivery) => ({
              id: delivery.id,
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
            documents: order.documents.map((document) => ({
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
              href={addParam(pageParams, "page", String(page - 1))}
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
              href={addParam(pageParams, "page", String(page + 1))}
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
