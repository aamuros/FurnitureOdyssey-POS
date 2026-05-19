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
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

  return (
    <>
      <PageHeader
        title="Payments"
        description="Manual payment history, customer balances, receipt links, and order balance tracking."
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="studio-card">
          <div className="studio-card-header">
            <p className="studio-kicker">Payment Ledger</p>
            <h2 className="text-sm font-semibold">Payment History</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent downpayments, partial payments, final payments, and delivery balance payments.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="studio-table w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Receipt no.</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-5 py-3 font-medium">Received by</th>
                  <th className="px-5 py-3 font-medium">Receipt</th>
                  <th className="px-5 py-3 font-medium">Order balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((payment) => {
                  const receipt = payment.documents[0];

                  return (
                    <tr key={payment.id}>
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(payment.paymentDate)}</td>
                      <td className="px-5 py-3 font-medium">{payment.paymentNumber ?? "Not assigned"}</td>
                      <td className="px-5 py-3">
                        <div className="font-medium">{payment.customer.displayName}</div>
                        <div className="text-xs text-muted-foreground">
                          {payment.customer.companyName ?? payment.customer.contactPersonName ?? ""}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Link href="/orders" className="font-medium text-primary hover:underline">
                          {payment.order.orderNumber ?? "Not assigned"}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {paymentTypeLabel(payment.paymentType)}
                      </td>
                      <td className="px-5 py-3 font-medium">{formatMoney(payment.amount)}</td>
                      <td className="px-5 py-3 text-muted-foreground">{payment.method ?? "Not set"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{payment.referenceNumber ?? "None"}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {payment.receivedBy?.displayName ?? "Not set"}
                      </td>
                      <td className="px-5 py-3">
                        {receipt?.secureUrl ? (
                          <a className="text-primary hover:underline" href={receipt.secureUrl}>
                            {receipt.title}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">
                            {payment.receiptGenerated ? "Generated" : "Not generated"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium">{formatMoney(payment.order.balanceAmount)}</div>
                        <StatusPill tone={statusTone(payment.order.paymentStatus)}>
                          {payment.order.paymentStatus}
                        </StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {payments.length === 0 ? (
            <div className="studio-empty m-5 px-4 py-4 text-sm">
              No payments have been recorded yet.
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <section className="studio-card">
            <div className="studio-card-header">
              <p className="studio-kicker">Open Balances</p>
              <h2 className="text-sm font-semibold">Customer Balances</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Customers with at least one order balance still open.
              </p>
            </div>
            <div className="divide-y divide-border">
              {customerBalances.map((customer) => {
                const balance = customer.orders.reduce(
                  (sum, order) => sum + Number(order.balanceAmount),
                  0
                );

                return (
                  <div key={customer.id} className="px-5 py-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{customer.displayName}</p>
                        <p className="text-muted-foreground">{customer.orders.length} open order(s)</p>
                      </div>
                      <p className="font-semibold">{formatMoney(balance)}</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {customer.orders.slice(0, 3).map((order) => (
                        <div key={order.id} className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            {order.orderNumber ?? "Not assigned"}
                          </span>
                          <StatusPill tone={statusTone(order.paymentStatus)}>
                            {order.paymentStatus}
                          </StatusPill>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {customerBalances.length === 0 ? (
              <div className="px-5 py-8 text-sm text-muted-foreground">
                No customer balances are currently open.
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </>
  );
}
