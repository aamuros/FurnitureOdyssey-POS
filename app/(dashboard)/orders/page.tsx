import { OrderWorkspace } from "@/components/dashboard/order-workspace";
import { PageHeader } from "@/components/dashboard/page-header";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
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

function deliveryAddressLine(value: unknown) {
  if (value && typeof value === "object" && "addressLine" in value) {
    const addressLine = (value as { addressLine?: unknown }).addressLine;
    return typeof addressLine === "string" ? addressLine : null;
  }

  return null;
}

export default async function OrdersPage() {
  await requirePermission("ORDERS", "VIEW");

  const [customers, products, approvedQuotations, orders] = await Promise.all([
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
    prisma.order.findMany({
      orderBy: {
        updatedAt: "desc"
      },
      take: 20,
      include: {
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
          take: 8
        },
        deliveries: {
          orderBy: {
            createdAt: "desc"
          },
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

  return (
    <>
      <PageHeader
        title="Orders"
        description="Internal order records for approved quotation conversion, manual orders, payments, delivery scheduling, documents, and sales history."
      />
      <OrderWorkspace
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
        orders={orders.map((order) => ({
          id: order.id,
          displayId: order.orderNumber ?? order.id.slice(0, 8),
          customerName: order.customerDisplayNameSnapshot,
          sourceType: order.sourceType,
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentDueTiming: order.paymentDueTiming,
          paymentDueDate: formatOptionalInputDate(order.paymentDueDate),
          deliveryStatus: order.deliveryStatus,
          totalAmount: formatMoney(order.totalAmount),
          totalAmountValue: Number(order.totalAmount),
          paidAmount: formatMoney(order.paidAmount),
          paidAmountValue: Number(order.paidAmount),
          balanceAmount: formatMoney(order.balanceAmount),
          balanceAmountValue: Number(order.balanceAmount),
          updatedAt: formatDate(order.updatedAt),
          items: order.items.map((item) => ({
            id: item.id,
            itemName: item.itemName,
            quantity: Number(item.quantity),
            plannedQuantity: item.deliveryItems.reduce(
              (sum, deliveryItem) => sum + Number(deliveryItem.quantityPlanned),
              0
            ),
            remainingQuantity: Math.max(
              Number(item.quantity) -
                item.deliveryItems.reduce(
                  (sum, deliveryItem) => sum + Number(deliveryItem.quantityPlanned),
                  0
                ),
              0
            ),
            unitPrice: formatMoney(item.unitPrice),
            lineTotal: formatMoney(item.lineTotal),
            deliveredQuantity: item.deliveryItems.reduce(
              (sum, deliveryItem) => sum + Number(deliveryItem.quantityDelivered),
              0
            )
          })),
          payments: order.payments.map((payment) => ({
            id: payment.id,
            paymentDate: formatDate(payment.paymentDate),
            amount: formatMoney(payment.amount),
            paymentType: payment.paymentType,
            method: payment.method,
            status: payment.status,
            referenceNumber: payment.referenceNumber,
            payerName: payment.payerName,
            receiptGenerated: payment.receiptGenerated
          })),
          deliveries: order.deliveries.map((delivery) => ({
            id: delivery.id,
            status: delivery.status,
            scheduledDate: delivery.scheduledDate ? formatInputDate(delivery.scheduledDate) : null,
            scheduledTimeWindow: delivery.scheduledTimeWindow,
            deliveryProviderType: delivery.deliveryProviderType,
            deliveryProviderName: delivery.deliveryProviderName,
            deliveryProviderReference: delivery.deliveryProviderReference,
            recipientName: delivery.recipientName,
            recipientPhone: delivery.recipientPhone,
            addressLine: deliveryAddressLine(delivery.deliveryAddressSnapshot),
            receiptGenerated: delivery.documents.length > 0,
            itemCount: delivery._count.items,
            items: delivery.items.map((item) => ({
              id: item.id,
              itemName: item.orderItem.itemName,
              quantityPlanned: Number(item.quantityPlanned),
              quantityDelivered: Number(item.quantityDelivered)
            }))
          })),
          documents: order.documents.map((document) => ({
            id: document.id,
            documentType: document.documentType,
            title: document.title,
            status: document.status,
            paymentId: document.paymentId,
            deliveryId: document.deliveryId
          }))
        }))}
      />
    </>
  );
}
