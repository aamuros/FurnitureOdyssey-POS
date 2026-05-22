import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { QuotationDetailActions } from "@/components/dashboard/quotation-workspace";
import { StatusPill } from "@/components/ui/status-pill";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

type QuotationDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatMoney(value: unknown) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value ?? 0));
}

function formatQuantity(value: unknown) {
  const parsed = Number(value ?? 0);
  const quantity = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;

  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 0
  }).format(quantity);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
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
  if (status === "ACCEPTED") {
    return "success" as const;
  }

  if (status === "DECLINED" || status === "CANCELLED") {
    return "danger" as const;
  }

  if (status === "SENT") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{value || "Not set"}</div>
    </div>
  );
}

export default async function QuotationDetailPage({ params }: QuotationDetailPageProps) {
  const user = await requirePermission("QUOTATIONS", "VIEW");
  const { id } = await params;

  const quotation = await prisma.quotation.findUnique({
    where: {
      id
    },
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
            take: 1
          }
        }
      },
      createdBy: {
        select: {
          displayName: true
        }
      },
      updatedBy: {
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
      items: {
        orderBy: {
          sortOrder: "asc"
        }
      }
    }
  });

  if (!quotation) {
    notFound();
  }

  const primaryContact = quotation.customer.contacts[0];
  const subtotalForItems = Math.max(
    Number(quotation.subtotalAmount) - Number(quotation.itemDiscountTotal),
    0
  );
  const additionalFees = Math.max(
    Number(quotation.totalAmount) -
      (Number(quotation.subtotalAmount) -
        Number(quotation.itemDiscountTotal) -
        Number(quotation.quotationDiscountAmount) +
        Number(quotation.assemblyFeeTotal) +
        Number(quotation.salesInvoiceFeeTotal)),
    0
  );
  const finalSubtotal = Math.max(Number(quotation.totalAmount) - Number(quotation.salesInvoiceFeeTotal), 0);

  return (
    <>
      <PageHeader
        title={quotation.quotationNumber ?? "Quotation"}
        description="Review quotation contents, totals, and allowed workflow actions."
      />
      <Link
        href="/quotations"
        className="mb-4 inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-lg border border-border bg-soft-accent/70 px-4 text-sm font-semibold text-foreground transition hover:bg-soft-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to quotations
      </Link>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <section className="studio-card">
            <div className="studio-card-header flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="studio-kicker">Quotation</p>
                <h2 className="text-sm font-semibold">{quotation.quotationNumber ?? quotation.id}</h2>
              </div>
              <StatusPill tone={statusTone(quotation.status)}>
                {labelFromEnum(quotation.status)}
              </StatusPill>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
              <DetailRow label="Customer" value={quotation.customer.displayName} />
              <DetailRow
                label="Contact"
                value={
                  primaryContact
                    ? `${labelFromEnum(primaryContact.type)}: ${primaryContact.value}`
                    : "Not set"
                }
              />
              <DetailRow label="Created by" value={quotation.createdBy?.displayName ?? "Unknown"} />
              <DetailRow label="Updated by" value={quotation.updatedBy?.displayName ?? "Unknown"} />
              <DetailRow label="Created" value={formatDate(quotation.createdAt)} />
              <DetailRow label="Updated" value={formatDate(quotation.updatedAt)} />
            </div>
          </section>

          <section className="studio-card">
            <div className="studio-card-header">
              <p className="studio-kicker">Items</p>
              <h2 className="text-sm font-semibold">Quoted items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="studio-table w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    {quotation.needsAssembly ? (
                      <th className="px-5 py-3 font-medium">Assemble</th>
                    ) : null}
                    <th className="px-5 py-3 font-medium">Item</th>
                    <th className="px-5 py-3 font-medium">Product code</th>
                    <th className="px-5 py-3 font-medium">Description / specs</th>
                    <th className="px-5 py-3 font-medium">Qty</th>
                    <th className="px-5 py-3 font-medium">Unit price</th>
                    <th className="px-5 py-3 font-medium">Discount</th>
                    <th className="px-5 py-3 font-medium">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quotation.items.map((item) => (
                    <tr key={item.id}>
                      {quotation.needsAssembly ? (
                        <td className="px-5 py-3 text-muted-foreground">
                          {item.requiresAssembly ? "Yes" : "No"}
                        </td>
                      ) : null}
                      <td className="px-5 py-3 font-medium">{item.itemName}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {item.snapshotProductCode ?? "Custom"}
                      </td>
                      <td className="max-w-[320px] px-5 py-3 text-muted-foreground">
                        {[item.description, item.specifications].filter(Boolean).join(" / ") ||
                          "No description"}
                      </td>
                      <td className="px-5 py-3">{formatQuantity(item.quantity)}</td>
                      <td className="px-5 py-3">{formatMoney(item.unitPrice)}</td>
                      <td className="px-5 py-3">{formatMoney(item.discountAmount)}</td>
                      <td className="px-5 py-3 font-medium">{formatMoney(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="studio-card">
            <div className="studio-card-header">
              <p className="studio-kicker">Notes</p>
              <h2 className="text-sm font-semibold">Quotation notes</h2>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2">
              <DetailRow
                label="Customer-facing notes"
                value={
                  quotation.customerNotes ? (
                    <p className="whitespace-pre-wrap break-words leading-6">
                      {quotation.customerNotes}
                    </p>
                  ) : (
                    "No notes added."
                  )
                }
              />
              <DetailRow
                label="Internal notes"
                value={
                  quotation.internalNotes ? (
                    <p className="whitespace-pre-wrap break-words leading-6">
                      {quotation.internalNotes}
                    </p>
                  ) : (
                    "No notes added."
                  )
                }
              />
            </div>
          </section>
        </section>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="studio-card">
            <div className="studio-card-header">
              <p className="studio-kicker">Actions</p>
              <h2 className="text-sm font-semibold">Workflow</h2>
            </div>
            <div className="p-5">
              <QuotationDetailActions
                quotationId={quotation.id}
                status={quotation.status}
                canExportDocuments={hasPermission(user, "DOCUMENTS", "EXPORT")}
                canUpdateQuotations={hasPermission(user, "QUOTATIONS", "UPDATE")}
                canApproveQuotations={hasPermission(user, "QUOTATIONS", "APPROVE")}
                canCreateOrders={hasPermission(user, "ORDERS", "CREATE")}
                order={quotation.order}
              />
            </div>
          </section>

          <section className="studio-card">
            <div className="studio-card-header">
              <p className="studio-kicker">Totals</p>
              <h2 className="text-sm font-semibold">Quotation total</h2>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Subtotal for Items</span>
                <span className="font-medium">{formatMoney(subtotalForItems)}</span>
              </div>
              <div className="flex justify-between gap-4 rounded-md bg-success/10 px-3 py-2 text-emerald-800">
                <span className="font-medium">Assemble Fee</span>
                <span className="font-medium">+{formatMoney(quotation.assemblyFeeTotal)}</span>
              </div>
              <div className="flex justify-between gap-4 rounded-md bg-success/10 px-3 py-2 text-emerald-800">
                <span className="font-medium">Additional Fees</span>
                <span className="font-medium">+{formatMoney(additionalFees)}</span>
              </div>
              <div className="flex justify-between gap-4 rounded-md bg-danger/10 px-3 py-2 text-danger">
                <span className="font-medium">Additional Discount</span>
                <span className="font-medium">-{formatMoney(quotation.quotationDiscountAmount)}</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-3">
                <span className="font-semibold">Final Subtotal</span>
                <span className="font-semibold">{formatMoney(finalSubtotal)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Sales Invoice Fee</span>
                <span className="font-medium">+{formatMoney(quotation.salesInvoiceFeeTotal)}</span>
              </div>
              <div className="flex justify-between gap-4 rounded-lg bg-soft-accent/70 px-3 py-3 text-base">
                <span className="font-semibold">Final Total</span>
                <span className="text-lg font-semibold">{formatMoney(quotation.totalAmount)}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
