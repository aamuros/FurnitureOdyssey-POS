import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { timeQuery } from "@/lib/query-timing";

export const runtime = "nodejs";

const optionLimit = 25;

function formatMoney(value: unknown) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value));
}

function searchQuery(request: NextRequest) {
  return request.nextUrl.searchParams.get("q")?.trim() || undefined;
}

async function customerOptions(query: string | undefined) {
  const where: Prisma.CustomerWhereInput = {
    archivedAt: null,
    OR: query
      ? [
          { displayName: { contains: query, mode: "insensitive" } },
          { companyName: { contains: query, mode: "insensitive" } },
          { contactPersonName: { contains: query, mode: "insensitive" } },
          {
            contacts: {
              some: {
                value: { contains: query, mode: "insensitive" }
              }
            }
          }
        ]
      : undefined
  };

  const [items, count] = await Promise.all([
    timeQuery("orders:create-options:customers", prisma.customer.findMany({
      where,
      orderBy: {
        displayName: "asc"
      },
      take: optionLimit,
      select: {
        id: true,
        displayName: true,
        companyName: true
      }
    })),
    timeQuery("orders:create-options:customers-count", prisma.customer.count({ where }))
  ]);

  return { items, count };
}

async function productOptions(query: string | undefined, canViewPayments: boolean) {
  const where: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    OR: query
      ? [
          { name: { contains: query, mode: "insensitive" } },
          { code: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { specifications: { contains: query, mode: "insensitive" } }
        ]
      : undefined
  };

  const [items, count] = await Promise.all([
    timeQuery("orders:create-options:products", prisma.product.findMany({
      where,
      orderBy: {
        name: "asc"
      },
      take: optionLimit,
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        description: true,
        specifications: true,
        referencePrice: true,
        referenceCost: canViewPayments
      }
    })),
    timeQuery("orders:create-options:products-count", prisma.product.count({ where }))
  ]);

  return {
    count,
    items: items.map((product) => ({
      ...product,
      referencePrice: product.referencePrice ? Number(product.referencePrice) : null,
      referenceCost:
        canViewPayments && "referenceCost" in product && product.referenceCost
          ? Number(product.referenceCost)
          : null
    }))
  };
}

async function quotationOptions(query: string | undefined) {
  const where: Prisma.QuotationWhereInput = {
    status: "ACCEPTED",
    order: null,
    OR: query
      ? [
          { quotationNumber: { contains: query, mode: "insensitive" } },
          {
            customer: {
              OR: [
                { displayName: { contains: query, mode: "insensitive" } },
                { companyName: { contains: query, mode: "insensitive" } },
                { contactPersonName: { contains: query, mode: "insensitive" } }
              ]
            }
          }
        ]
      : undefined
  };

  const [items, count] = await Promise.all([
    timeQuery("orders:create-options:quotations", prisma.quotation.findMany({
      where,
      orderBy: {
        updatedAt: "desc"
      },
      take: optionLimit,
      select: {
        id: true,
        quotationNumber: true,
        totalAmount: true,
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
    })),
    timeQuery("orders:create-options:quotations-count", prisma.quotation.count({ where }))
  ]);

  return {
    count,
    items: items.map((quotation) => ({
      id: quotation.id,
      quotationNumber: quotation.quotationNumber,
      customerName: quotation.customer.displayName,
      totalAmount: formatMoney(quotation.totalAmount),
      itemCount: quotation._count.items
    }))
  };
}

export async function GET(request: NextRequest) {
  const user = await requirePermission("ORDERS", "CREATE");
  const query = searchQuery(request);
  const kind = request.nextUrl.searchParams.get("kind");
  const canViewPayments = hasPermission(user, "PAYMENTS", "VIEW");

  if (kind === "customers") {
    return NextResponse.json(await customerOptions(query), {
      headers: {
        "Cache-Control": "private, no-store"
      }
    });
  }

  if (kind === "products") {
    return NextResponse.json(await productOptions(query, canViewPayments), {
      headers: {
        "Cache-Control": "private, no-store"
      }
    });
  }

  if (kind === "quotations") {
    return NextResponse.json(await quotationOptions(query), {
      headers: {
        "Cache-Control": "private, no-store"
      }
    });
  }

  return NextResponse.json(
    {
      error: "Unsupported option type."
    },
    {
      status: 400
    }
  );
}
