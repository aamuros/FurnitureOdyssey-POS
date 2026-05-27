import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImagePlus } from "lucide-react";
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

const quotationDetailItemGridClass =
  "md:grid-cols-[64px_minmax(110px,150px)_96px_minmax(0,1fr)_44px_88px_80px_96px]";

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

function itemDescription(item: {
  description: string | null;
  specifications: string | null;
  snapshotVariantName: string | null;
}) {
  return [
    item.snapshotVariantName ? `Variant: ${item.snapshotVariantName}` : null,
    item.description,
    item.specifications
  ]
    .filter(Boolean)
    .join("\n");
}

function quotationItemImage(item: {
  itemName: string;
  snapshotVariantName: string | null;
  images: Array<{
    secureUrl: string;
    altText: string | null;
  }>;
}) {
  const image = item.images[0];
  const altText = image?.altText ?? [item.itemName, item.snapshotVariantName].filter(Boolean).join(" - ");

  return {
    secureUrl: image?.secureUrl ?? null,
    altText
  };
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
        },
        include: {
          images: {
            orderBy: [
              {
                isPrimary: "desc"
              },
              {
                sortOrder: "asc"
              }
            ]
          }
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

      <div className="grid min-w-0 max-w-full gap-5 overflow-x-hidden xl:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] xl:items-start">
        <section className="min-w-0 space-y-6">
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
            <div className="min-w-0 max-w-full">
              <div
                className={`hidden gap-3 border-b border-border px-4 py-3 text-xs font-medium uppercase text-muted-foreground md:grid ${quotationDetailItemGridClass}`}
              >
                <span>Image</span>
                <span>Item</span>
                <span>Product code</span>
                <span>Description / specs</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit price</span>
                <span className="text-right">Discount</span>
                <span className="text-right">Line total</span>
              </div>
              <div className="divide-y divide-border">
                {quotation.items.map((item) => {
                  const image = quotationItemImage(item);

                  return (
                    <div
                      key={item.id}
                      className={`grid min-w-0 grid-cols-[56px_minmax(0,1fr)] gap-3 px-4 py-4 text-sm md:items-start ${quotationDetailItemGridClass}`}
                    >
                      <div
                        role={image.secureUrl ? "img" : undefined}
                        aria-label={image.secureUrl ? image.altText : undefined}
                        className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-soft-accent/40 bg-contain bg-center bg-no-repeat text-muted-foreground"
                        style={image.secureUrl ? { backgroundImage: `url("${image.secureUrl}")` } : undefined}
                      >
                        {!image.secureUrl ? <ImagePlus className="h-4 w-4" /> : null}
                      </div>
                      <div className="min-w-0 font-medium">
                        <span className="block max-w-full whitespace-normal break-words">{item.itemName}</span>
                        {quotation.needsAssembly ? (
                          <span className="mt-1 block text-xs font-normal text-muted-foreground md:hidden">
                            Assemble: {item.requiresAssembly ? "Yes" : "No"}
                          </span>
                        ) : null}
                      </div>
                      <div className="col-span-2 min-w-0 text-muted-foreground md:col-span-1">
                        <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground md:hidden">
                          Product code
                        </span>
                        <span className="block max-w-full whitespace-normal break-words">
                          {item.snapshotProductCode ?? "Custom"}
                        </span>
                      </div>
                      <div className="col-span-2 min-w-0 text-muted-foreground md:col-span-1">
                        <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground md:hidden">
                          Description / specs
                        </span>
                        <span className="block max-w-full whitespace-pre-wrap break-words">
                          {itemDescription(item) || "No description"}
                        </span>
                      </div>
                      <div className="text-right tabular-nums">
                        <span className="block text-xs font-semibold uppercase text-muted-foreground md:hidden">
                          Qty
                        </span>
                        <span className="whitespace-nowrap">{formatQuantity(item.quantity)}</span>
                      </div>
                      <div className="text-right tabular-nums">
                        <span className="block text-xs font-semibold uppercase text-muted-foreground md:hidden">
                          Unit
                        </span>
                        <span className="whitespace-nowrap">{formatMoney(item.unitPrice)}</span>
                      </div>
                      <div className="text-right tabular-nums">
                        <span className="block text-xs font-semibold uppercase text-muted-foreground md:hidden">
                          Discount
                        </span>
                        <span className="whitespace-nowrap">{formatMoney(item.discountAmount)}</span>
                      </div>
                      <div className="text-right font-medium tabular-nums">
                        <span className="block text-xs font-semibold uppercase text-muted-foreground md:hidden">
                          Total
                        </span>
                        <span className="whitespace-nowrap">{formatMoney(item.lineTotal)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
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

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-6 xl:self-start">
          <section className="studio-card">
            <div className="studio-card-header">
              <p className="studio-kicker">Actions</p>
              <h2 className="text-sm font-semibold">Workflow</h2>
            </div>
            <div className="p-4">
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
            <div className="space-y-3 p-4 text-sm">
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
