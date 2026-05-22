import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date) {
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

function paymentTypeLabel(value: string) {
  return readableStatus(value);
}

function readableStatus(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function paymentDisplayNumber(payment: { paymentNumber: string | null }) {
  return payment.paymentNumber ?? "Not assigned";
}

function paymentSubtitle(payment: { paymentDate: Date; paymentType: string }) {
  return `${formatDate(payment.paymentDate)} · ${paymentTypeLabel(payment.paymentType)}`;
}

function customerSubtitle(customer: {
  companyName: string | null;
  contactPersonName: string | null;
}) {
  return customer.companyName ?? customer.contactPersonName;
}

function orderHref(orderNumber: string | null) {
  if (!orderNumber) {
    return "/orders";
  }

  const params = new URLSearchParams({ q: orderNumber });
  return `/orders?${params.toString()}`;
}

function amountSubtitle(payment: { method: string | null; referenceNumber: string | null }) {
  const method = payment.method ?? "Method not set";
  return payment.referenceNumber ? `${method} · Ref: ${payment.referenceNumber}` : method;
}

function receiptLabel(payment: { receiptGenerated: boolean }, receipt: { secureUrl: string | null } | undefined) {
  if (receipt?.secureUrl) {
    return "Download";
  }

  return payment.receiptGenerated ? "Generated" : "Not generated";
}

function openBalanceSummary(
  customerBalances: Array<{
    orders: Array<{
      balanceAmount: unknown;
    }>;
  }>
) {
  return customerBalances.reduce(
    (summary, customer) => {
      summary.openBalanceTotal += customer.orders.reduce(
        (sum, order) => sum + Number(order.balanceAmount),
        0
      );
      summary.openBalanceOrders += customer.orders.length;
      return summary;
    },
    {
      openBalanceTotal: 0,
      customersWithBalance: customerBalances.length,
      openBalanceOrders: 0
    }
  );
}

function statusTone(status: string) {
  if (["RECORDED", "GENERATED", "PAID"].includes(status)) {
    return "success" as const;
  }

  if (["DOWNPAYMENT_PAID", "PARTIALLY_PAID", "BALANCE_DUE_ON_DELIVERY"].includes(status)) {
    return "warning" as const;
  }

  if (["VOIDED", "REFUNDED", "CANCELLED"].includes(status)) {
    return "danger" as const;
  }

  return "neutral" as const;
}

export default async function PaymentsPage() {
  await requirePermission("PAYMENTS", "VIEW");

  const [payments, customerBalances] = await Promise.all([
    prisma.payment.findMany({
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
            companyName: true,
            contactPersonName: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
            paymentStatus: true
          }
        },
        receivedBy: {
          select: {
            displayName: true
          }
        },
        documents: {
          where: {
            documentType: "PAYMENT_RECEIPT"
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            id: true,
            title: true,
            secureUrl: true
          }
        }
      }
    }),
    prisma.customer.findMany({
      where: {
        orders: {
          some: {
            balanceAmount: {
              gt: 0
            }
          }
        }
      },
      orderBy: {
        displayName: "asc"
      },
      take: 40,
      select: {
        id: true,
        displayName: true,
        orders: {
          where: {
            balanceAmount: {
              gt: 0
            }
          },
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
            paymentStatus: true
          }
        }
      }
    })
  ]);

  const balanceSummary = openBalanceSummary(customerBalances);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Track recorded payments, receipts, and remaining order balances."
      />

      <section className="studio-card">
        <div className="grid gap-px border-b border-border bg-border sm:grid-cols-3">
          <div className="bg-panel px-5 py-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Open balance total</p>
            <p className="mt-1 text-sm font-semibold">{formatMoney(balanceSummary.openBalanceTotal)}</p>
          </div>
          <div className="bg-panel px-5 py-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Customers with balance</p>
            <p className="mt-1 text-sm font-semibold">{balanceSummary.customersWithBalance}</p>
          </div>
          <div className="bg-panel px-5 py-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Open balance orders</p>
            <p className="mt-1 text-sm font-semibold">{balanceSummary.openBalanceOrders}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="studio-table w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Payment</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Receipt</th>
                <th className="px-5 py-3 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((payment) => {
                const receipt = payment.documents[0];
                const customerDetail = customerSubtitle(payment.customer);

                return (
                  <tr key={payment.id}>
                    <td className="px-5 py-3 align-top">
                      <div className="font-medium">{paymentDisplayNumber(payment)}</div>
                      <div className="text-xs text-muted-foreground">{paymentSubtitle(payment)}</div>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className="font-medium">{payment.customer.displayName}</div>
                      {customerDetail ? (
                        <div className="text-xs text-muted-foreground">{customerDetail}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 align-top">
                      {payment.order.orderNumber ? (
                        <Link
                          href={orderHref(payment.order.orderNumber)}
                          className="font-medium text-primary hover:underline"
                        >
                          {payment.order.orderNumber}
                        </Link>
                      ) : (
                        <span className="font-medium">Not assigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className="font-medium">{formatMoney(payment.amount)}</div>
                      <div className="text-xs text-muted-foreground">{amountSubtitle(payment)}</div>
                    </td>
                    <td className="px-5 py-3 align-top">
                      {receipt?.secureUrl ? (
                        <a className="font-medium text-primary hover:underline" href={receipt.secureUrl}>
                          {receiptLabel(payment, receipt)}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">{receiptLabel(payment, receipt)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className="font-medium">{formatMoney(payment.order.balanceAmount)}</div>
                      <div className="mt-1">
                        <StatusPill tone={statusTone(payment.order.paymentStatus)}>
                          {readableStatus(payment.order.paymentStatus)}
                        </StatusPill>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {payments.length === 0 ? (
          <div className="studio-empty m-5 px-4 py-4 text-sm">
            No payments found. Recorded payments and receipt links will appear here.
          </div>
        ) : null}
      </section>
    </>
  );
}
