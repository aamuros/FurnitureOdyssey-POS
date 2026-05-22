import { PageHeader } from "@/components/dashboard/page-header";
import { QuotationRecordsList } from "@/components/dashboard/quotation-workspace";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { hasPermission } from "@/lib/auth/permissions";
import { Plus } from "lucide-react";
import Link from "next/link";
import type { Prisma, QuotationStatus } from "@prisma/client";

type QuotationsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    view?: string;
    page?: string;
  }>;
};

const PAGE_SIZE = 25;
const QUOTATION_STATUS_FILTERS = ["DRAFT", "SENT", "ACCEPTED", "CANCELLED"] as const;
const QUOTATION_VIEW_FILTERS = ["active", "converted", "all"] as const;

function validStatusFilter(value: string | undefined) {
  const status = value?.trim();
  return QUOTATION_STATUS_FILTERS.find((option) => option === status);
}

function validViewFilter(value: string | undefined) {
  const view = value?.trim();
  return QUOTATION_VIEW_FILTERS.find((option) => option === view) ?? "active";
}

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

function normalizeIntegerQuantity(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function itemSummary(
  items: Array<{
    itemName: string;
    quantity: unknown;
  }>
) {
  if (items.length === 0) {
    return "No items";
  }

  if (items.length === 1) {
    const item = items[0];
    return `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(
      normalizeIntegerQuantity(item.quantity)
    )} x ${item.itemName}`;
  }

  const names = items
    .slice(0, 3)
    .map((item) => item.itemName)
    .join(", ");
  const remaining = items.length > 3 ? ` +${items.length - 3} more` : "";

  return `${items.length} items: ${names}${remaining}`;
}

export default async function QuotationsPage({ searchParams }: QuotationsPageProps) {
  const user = await requirePermission("QUOTATIONS", "VIEW");
  const params = (await searchParams) ?? {};
  const query = params.q?.trim();
  const status = validStatusFilter(params.status);
  const view = validViewFilter(params.view);
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const viewWhere: Prisma.QuotationWhereInput =
    view === "converted"
      ? {
          order: {
            isNot: null
          }
        }
      : view === "active"
        ? {
            order: {
              is: null
            },
            status: {
              notIn: ["DECLINED", "CANCELLED"]
            }
          }
        : {};

  const filters = [
    Object.keys(viewWhere).length ? viewWhere : undefined,
    status
      ? {
          status: status as QuotationStatus
        }
      : undefined
  ].filter(Boolean) as Prisma.QuotationWhereInput[];

  const where: Prisma.QuotationWhereInput = {
    AND: filters.length ? filters : undefined,
    OR: query
      ? [
          { quotationNumber: { contains: query, mode: "insensitive" } },
          {
            customer: {
              OR: [
                { displayName: { contains: query, mode: "insensitive" } },
                { companyName: { contains: query, mode: "insensitive" } }
              ]
            }
          },
          {
            items: {
              some: {
                OR: [
                  { itemName: { contains: query, mode: "insensitive" } },
                  { description: { contains: query, mode: "insensitive" } },
                  { specifications: { contains: query, mode: "insensitive" } }
                ]
              }
            }
          }
        ]
      : undefined
  };

  const [totalCount, quotations] = await Promise.all([
    prisma.quotation.count({
      where
    }),
    prisma.quotation.findMany({
      where,
      orderBy: {
        updatedAt: "desc"
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: {
          select: {
            displayName: true
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
            itemName: true,
            quantity: true
          },
          take: 4
        },
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        }
      }
    })
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const paginationPage = Math.min(page, totalPages);
  const from = totalCount === 0 ? 0 : (paginationPage - 1) * PAGE_SIZE + 1;
  const to = totalCount === 0 ? 0 : Math.min(paginationPage * PAGE_SIZE, totalCount);

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Search, review, download, and update quotation records. Create new quotations in the focused builder."
      >
        <Link
          href="/quotations/new"
          className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New quotation
        </Link>
      </PageHeader>
      <QuotationRecordsList
        query={query ?? ""}
        status={status ?? ""}
        view={view}
        pagination={{
          page: paginationPage,
          pageSize: PAGE_SIZE,
          totalCount,
          totalPages,
          from,
          to
        }}
        quotations={quotations.map((quotation) => ({
          id: quotation.id,
          quotationNumber: quotation.quotationNumber,
          customerName: quotation.customer.displayName,
          status: quotation.status,
          itemSummary: itemSummary(quotation.items),
          subtotalAmount: formatMoney(quotation.subtotalAmount),
          totalAmount: formatMoney(quotation.totalAmount),
          createdBy: quotation.createdBy?.displayName ?? null,
          updatedAt: formatDate(quotation.updatedAt),
          orderId: quotation.order?.id ?? null,
          orderNumber: quotation.order?.orderNumber ?? null
        }))}
        canExportDocuments={hasPermission(user, "DOCUMENTS", "EXPORT")}
        canUpdateQuotations={hasPermission(user, "QUOTATIONS", "UPDATE")}
        canApproveQuotations={hasPermission(user, "QUOTATIONS", "APPROVE")}
        canDeleteQuotations={hasPermission(user, "QUOTATIONS", "DELETE")}
      />
    </>
  );
}
