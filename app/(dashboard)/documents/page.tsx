import Link from "next/link";
import { DocumentStatus, DocumentType, Prisma } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

type DocumentsPageProps = {
  searchParams?: Promise<{
    q?: string;
    documentType?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
};

const pageSize = 50;

const documentTypes = [
  "QUOTATION_PDF",
  "ORDER_CONFIRMATION",
  "INVOICE",
  "PAYMENT_RECEIPT",
  "OFFICIAL_RECEIPT",
  "ACKNOWLEDGEMENT_RECEIPT",
  "DELIVERY_RECEIPT",
  "FINAL_ORDER_SUMMARY",
  "OTHER"
] as const satisfies readonly DocumentType[];

const documentStatuses = ["DRAFT", "GENERATED", "VOIDED"] as const satisfies readonly DocumentStatus[];

const apiDocumentKinds: Partial<Record<DocumentType, string>> = {
  QUOTATION_PDF: "quotation",
  INVOICE: "invoice",
  PAYMENT_RECEIPT: "payment-receipt",
  DELIVERY_RECEIPT: "delivery-receipt",
  FINAL_ORDER_SUMMARY: "final-order-summary"
};

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function enumValue<T extends readonly string[]>(values: T, value: string | undefined) {
  return values.includes(value ?? "") ? (value as T[number]) : undefined;
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateRangeWhere(from: Date | undefined, to: Date | undefined) {
  return from || to
    ? {
        gte: from,
        lte: to
      }
    : undefined;
}

function labelFromEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "Not generated";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function statusTone(status: DocumentStatus) {
  if (status === "GENERATED") {
    return "success" as const;
  }

  if (status === "VOIDED") {
    return "danger" as const;
  }

  return "neutral" as const;
}

function searchWhere(query: string | undefined): Prisma.OrderDocumentWhereInput[] | undefined {
  if (!query) {
    return undefined;
  }

  return [
    { documentNumber: { contains: query, mode: "insensitive" } },
    { title: { contains: query, mode: "insensitive" } },
    {
      order: {
        OR: [
          { orderNumber: { contains: query, mode: "insensitive" } },
          { customerDisplayNameSnapshot: { contains: query, mode: "insensitive" } }
        ]
      }
    },
    {
      quotation: {
        quotationNumber: { contains: query, mode: "insensitive" }
      }
    },
    {
      payment: {
        paymentNumber: { contains: query, mode: "insensitive" }
      }
    },
    {
      delivery: {
        deliveryNumber: { contains: query, mode: "insensitive" }
      }
    }
  ];
}

function addParam(params: Record<string, string | undefined>, key: string, value: string) {
  const next = new URLSearchParams();

  for (const [paramKey, paramValue] of Object.entries(params)) {
    if (paramValue && paramKey !== "page") {
      next.set(paramKey, paramValue);
    }
  }

  next.set(key, value);
  return `/documents?${next.toString()}`;
}

function moduleLink(route: string, query: string | null | undefined) {
  if (!query) {
    return route;
  }

  const params = new URLSearchParams({ q: query });
  return `${route}?${params.toString()}`;
}

type DocumentRecord = Prisma.OrderDocumentGetPayload<{
  include: {
    order: {
      select: {
        id: true;
        orderNumber: true;
        customerDisplayNameSnapshot: true;
      };
    };
    quotation: {
      select: {
        id: true;
        quotationNumber: true;
      };
    };
    payment: {
      select: {
        id: true;
        paymentNumber: true;
      };
    };
    delivery: {
      select: {
        id: true;
        deliveryNumber: true;
      };
    };
    generatedBy: {
      select: {
        displayName: true;
      };
    };
  };
}>;

function downloadTarget(document: DocumentRecord) {
  const kind = apiDocumentKinds[document.documentType];

  if (!kind) {
    return null;
  }

  if (document.secureUrl) {
    return document.secureUrl;
  }

  if (document.documentType === "QUOTATION_PDF" && document.quotationId) {
    return `/api/documents/${kind}/${document.quotationId}`;
  }

  if (
    (document.documentType === "INVOICE" || document.documentType === "FINAL_ORDER_SUMMARY") &&
    document.orderId
  ) {
    return `/api/documents/${kind}/${document.orderId}`;
  }

  if (document.documentType === "PAYMENT_RECEIPT" && document.paymentId) {
    return `/api/documents/${kind}/${document.paymentId}`;
  }

  if (document.documentType === "DELIVERY_RECEIPT" && document.deliveryId) {
    return `/api/documents/${kind}/${document.deliveryId}`;
  }

  return null;
}

function canDownloadDocument(
  document: DocumentRecord,
  permissions: {
    canExportDocuments: boolean;
    canViewQuotations: boolean;
    canViewOrders: boolean;
    canViewPayments: boolean;
    canViewDeliveries: boolean;
  }
) {
  if (!permissions.canExportDocuments) {
    return false;
  }

  if (document.documentType === "QUOTATION_PDF") {
    return permissions.canViewQuotations;
  }

  if (document.documentType === "INVOICE" || document.documentType === "FINAL_ORDER_SUMMARY") {
    return permissions.canViewOrders;
  }

  if (document.documentType === "PAYMENT_RECEIPT") {
    return permissions.canViewPayments;
  }

  if (document.documentType === "DELIVERY_RECEIPT") {
    return permissions.canViewDeliveries;
  }

  return Boolean(document.secureUrl);
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const user = await requirePermission("DOCUMENTS", "VIEW");
  const params = (await searchParams) ?? {};
  const query = clean(params.q);
  const documentType = enumValue(documentTypes, params.documentType);
  const status = enumValue(documentStatuses, params.status);
  const from = parseDate(params.from);
  const to = parseDate(params.to, true);
  const page = Math.max(Number(params.page ?? 1) || 1, 1);

  const permissions = {
    canExportDocuments: hasPermission(user, "DOCUMENTS", "EXPORT"),
    canViewQuotations: hasPermission(user, "QUOTATIONS", "VIEW"),
    canViewOrders: hasPermission(user, "ORDERS", "VIEW"),
    canViewPayments: hasPermission(user, "PAYMENTS", "VIEW"),
    canViewDeliveries: hasPermission(user, "DELIVERIES", "VIEW")
  };

  const where: Prisma.OrderDocumentWhereInput = {
    documentType,
    status,
    generatedAt: dateRangeWhere(from, to),
    OR: searchWhere(query)
  };

  const [documentCount, documents] = await Promise.all([
    prisma.orderDocument.count({
      where
    }),
    prisma.orderDocument.findMany({
      where,
      orderBy: [
        {
          generatedAt: "desc"
        },
        {
          createdAt: "desc"
        }
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerDisplayNameSnapshot: true
          }
        },
        quotation: {
          select: {
            id: true,
            quotationNumber: true
          }
        },
        payment: {
          select: {
            id: true,
            paymentNumber: true
          }
        },
        delivery: {
          select: {
            id: true,
            deliveryNumber: true
          }
        },
        generatedBy: {
          select: {
            displayName: true
          }
        }
      }
    })
  ]);
  const totalPages = Math.max(Math.ceil(documentCount / pageSize), 1);
  const pageParams = {
    q: params.q,
    documentType: params.documentType,
    status: params.status,
    from: params.from,
    to: params.to
  };

  return (
    <>
      <PageHeader
        title="Documents"
        description="Generated operational document registry for quotations, invoices, receipts, delivery receipts, and final order summaries."
      />

      <form className="mb-6 grid gap-3 rounded-lg border border-border bg-panel p-4 lg:grid-cols-[1.4fr_0.9fr_0.8fr_0.7fr_0.7fr_auto]">
        <Input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search document, title, order, customer, quotation, payment, delivery"
        />
        <Select name="documentType" defaultValue={params.documentType ?? ""}>
          <option value="">Any document</option>
          {documentTypes.map((type) => (
            <option key={type} value={type}>
              {labelFromEnum(type)}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={params.status ?? ""}>
          <option value="">Any status</option>
          {documentStatuses.map((documentStatus) => (
            <option key={documentStatus} value={documentStatus}>
              {labelFromEnum(documentStatus)}
            </option>
          ))}
        </Select>
        <Input name="from" type="date" defaultValue={params.from ?? ""} aria-label="Generated from" />
        <Input name="to" type="date" defaultValue={params.to ?? ""} aria-label="Generated to" />
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      <section className="studio-card">
        <div className="studio-card-header">
          <p className="studio-kicker">Document Library</p>
          <h2 className="text-sm font-semibold">Document Registry</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent generated documents and stored document references linked to operational records.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="studio-table w-full min-w-[1380px] text-left text-sm">
            <thead className="border-b border-border bg-background text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Document number</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Quotation</th>
                <th className="px-5 py-3 font-medium">Payment</th>
                <th className="px-5 py-3 font-medium">Delivery</th>
                <th className="px-5 py-3 font-medium">Generated by</th>
                <th className="px-5 py-3 font-medium">Generated at</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((document) => {
                const downloadHref = downloadTarget(document);
                const canDownload = canDownloadDocument(document, permissions);

                return (
                  <tr key={document.id}>
                    <td className="px-5 py-3 font-medium">{document.documentNumber ?? "Not assigned"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{labelFromEnum(document.documentType)}</td>
                    <td className="px-5 py-3">
                      <div className="max-w-[280px] font-medium text-foreground">{document.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {document.secureUrl ? "Stored document" : "Generated on demand"}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill tone={statusTone(document.status)}>
                        {labelFromEnum(document.status)}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {document.order.customerDisplayNameSnapshot || "No customer"}
                    </td>
                    <td className="px-5 py-3">
                      {permissions.canViewOrders ? (
                        <Link
                          href={moduleLink("/orders", document.order.orderNumber)}
                          className="font-medium text-primary hover:underline"
                        >
                          {document.order.orderNumber ?? "Not assigned"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          {document.order.orderNumber ?? "Not assigned"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {document.quotation ? (
                        permissions.canViewQuotations ? (
                          <Link
                            href={moduleLink("/quotations", document.quotation.quotationNumber)}
                            className="font-medium text-primary hover:underline"
                          >
                            {document.quotation.quotationNumber ?? "Not assigned"}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">
                            {document.quotation.quotationNumber ?? "Not assigned"}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">No related record</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {document.payment ? (
                        permissions.canViewPayments ? (
                          <Link href="/payments" className="font-medium text-primary hover:underline">
                            {document.payment.paymentNumber ?? "Not assigned"}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">
                            {document.payment.paymentNumber ?? "Not assigned"}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">No related record</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {document.delivery ? (
                        permissions.canViewDeliveries ? (
                          <Link href="/deliveries" className="font-medium text-primary hover:underline">
                            {document.delivery.deliveryNumber ?? "Not assigned"}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">
                            {document.delivery.deliveryNumber ?? "Not assigned"}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">No related record</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {document.generatedBy?.displayName ?? "Not assigned"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatDateTime(document.generatedAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {canDownload && downloadHref ? (
                          <a href={downloadHref} className="font-medium text-primary hover:underline">
                            Download PDF
                          </a>
                        ) : (
                          <span className="text-muted-foreground">
                            {apiDocumentKinds[document.documentType] ? "Not available" : "No download route"}
                          </span>
                        )}
                        {permissions.canViewOrders ? (
                          <Link
                            href={moduleLink("/orders", document.order.orderNumber)}
                            className="text-xs text-primary hover:underline"
                          >
                            Open order
                          </Link>
                        ) : null}
                        {permissions.canViewQuotations && document.quotation ? (
                          <Link
                            href={moduleLink("/quotations", document.quotation.quotationNumber)}
                            className="text-xs text-primary hover:underline"
                          >
                            Open quotation
                          </Link>
                        ) : null}
                        {permissions.canViewPayments && document.payment ? (
                          <Link href="/payments" className="text-xs text-primary hover:underline">
                            Open payment
                          </Link>
                        ) : null}
                        {permissions.canViewDeliveries && document.delivery ? (
                          <Link href="/deliveries" className="text-xs text-primary hover:underline">
                            Open delivery
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {documents.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            Generated quotation, invoice, receipt, delivery receipt, and final summary records will appear here.
          </div>
        ) : null}
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-panel px-4 py-3 text-sm text-muted-foreground">
        <span>
          Showing {documents.length} of {documentCount} document(s), page {page} of {totalPages}
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
