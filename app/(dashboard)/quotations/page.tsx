import { PageHeader } from "@/components/dashboard/page-header";
import { QuotationRecordsList } from "@/components/dashboard/quotation-workspace";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { Plus } from "lucide-react";

type QuotationsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
  }>;
};

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

export default async function QuotationsPage({ searchParams }: QuotationsPageProps) {
  await requirePermission("QUOTATIONS", "VIEW");
  const params = (await searchParams) ?? {};
  const query = params.q?.trim();
  const status = params.status?.trim() || undefined;

  const quotations = await prisma.quotation.findMany({
    where: {
      status: status ? (status as never) : undefined,
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
      createdBy: {
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
  });

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Search, review, download, and update quotation records. Create new quotations in the focused builder."
      >
        <a
          href="/quotations/new"
          className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New quotation
        </a>
      </PageHeader>
      <QuotationRecordsList
        query={query ?? ""}
        status={status ?? ""}
        quotations={quotations.map((quotation) => ({
          id: quotation.id,
          quotationNumber: quotation.quotationNumber,
          customerName: quotation.customer.displayName,
          status: quotation.status,
          itemCount: quotation._count.items,
          subtotalAmount: formatMoney(quotation.subtotalAmount),
          totalAmount: formatMoney(quotation.totalAmount),
          createdBy: quotation.createdBy?.displayName ?? null,
          updatedAt: formatDate(quotation.updatedAt)
        }))}
      />
    </>
  );
}
