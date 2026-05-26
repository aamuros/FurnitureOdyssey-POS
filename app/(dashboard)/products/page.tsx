import Link from "next/link";
import { Prisma } from "@prisma/client";
import { ProductWorkspace } from "@/components/dashboard/product-workspace";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { timeQuery } from "@/lib/query-timing";

type ProductsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    category?: string;
    page?: string;
  }>;
};

const pageSize = 25;
const productCategoryOptions = ["Chair", "Table", "Others"];

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

function productsHref(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined> = {}
) {
  const next = new URLSearchParams();

  for (const [paramKey, paramValue] of Object.entries(params)) {
    if (paramValue && paramKey !== "page") {
      next.set(paramKey, paramValue);
    }
  }

  for (const [paramKey, paramValue] of Object.entries(updates)) {
    if (paramValue) {
      next.set(paramKey, paramValue);
    } else {
      next.delete(paramKey);
    }
  }

  const query = next.toString();
  return query ? `/products?${query}` : "/products";
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const user = await requirePermission("PRODUCTS", "VIEW");
  const canViewProductCost = hasPermission(user, "PAYMENTS", "VIEW");
  const params = (await searchParams) ?? {};
  const query = params.q?.trim();
  const status =
    params.status === "ACTIVE" || params.status === "INACTIVE" ? params.status : undefined;
  const category = params.category?.trim() || undefined;
  const page = Math.max(Number(params.page ?? 1) || 1, 1);
  const hasActiveFilters = Boolean(query || status || category);
  const productWhere: Prisma.ProductWhereInput = {
    status,
    category,
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

  const [products, productCount] = await Promise.all([
    timeQuery("products:list", prisma.product.findMany({
      where: productWhere,
      orderBy: [
        {
          updatedAt: "desc"
        }
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        description: true,
        specifications: true,
        referencePrice: true,
        referenceCost: canViewProductCost,
        currency: true,
        status: true,
        isWebsiteVisible: true,
        websiteSortOrder: true,
        websitePages: true,
        updatedAt: true,
        images: {
          orderBy: [
            {
              isPrimary: "desc"
            },
            {
              sortOrder: "asc"
            },
            {
              createdAt: "asc"
            }
          ],
          take: 1,
          select: {
            secureUrl: true,
            altText: true
          }
        }
      }
    })),
    timeQuery("products:count", prisma.product.count({
      where: productWhere
    }))
  ]);
  const totalPages = Math.max(Math.ceil(productCount / pageSize), 1);
  const pageParams = {
    q: params.q,
    status: params.status,
    category: params.category
  };

  return (
    <>
      <PageHeader
        title="Products"
        description="Reusable product references for quotations and orders."
      />
      <form className="mb-6 grid gap-3 rounded-lg border border-border bg-panel p-4 md:grid-cols-[1.4fr_0.75fr_0.9fr_auto]">
        <Input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search name, code, category, or details"
        />
        <Select name="status" defaultValue={params.status ?? ""}>
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
        <Select name="category" defaultValue={params.category ?? ""}>
          <option value="">All categories</option>
          {productCategoryOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary">
            Filter
          </Button>
          <Link href="/products" className="text-sm font-medium text-accent transition hover:text-accent/80">
            Reset filters
          </Link>
        </div>
      </form>
      <ProductWorkspace
        canCreate={hasPermission(user, "PRODUCTS", "CREATE")}
        canUpdate={hasPermission(user, "PRODUCTS", "UPDATE")}
        canDelete={hasPermission(user, "PRODUCTS", "DELETE")}
        canViewProductCost={canViewProductCost}
        hasActiveFilters={hasActiveFilters}
        persistenceUserKey={user.id}
        products={products.map((product) => {
          const primaryImage = product.images[0] ?? null;

          return {
            id: product.id,
            code: product.code,
            name: product.name,
            category: product.category,
            description: product.description,
            specifications: product.specifications,
            referencePrice: product.referencePrice ? Number(product.referencePrice) : null,
            referenceCost:
              canViewProductCost && "referenceCost" in product && product.referenceCost
                ? Number(product.referenceCost)
                : null,
            currency: product.currency,
            status: product.status,
            isWebsiteVisible: product.isWebsiteVisible,
            websiteSortOrder: product.websiteSortOrder,
            websitePages: product.websitePages,
            primaryImage: primaryImage
              ? {
                  secureUrl: primaryImage.secureUrl,
                  altText: primaryImage.altText
                }
              : null,
            updatedAt: formatDate(product.updatedAt)
          };
        })}
      />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-panel px-4 py-3 text-sm text-muted-foreground">
        <span>
          Showing {products.length} of {productCount} product(s), page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <span className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-md border border-border bg-panel px-4 text-sm font-medium opacity-60">
              Previous
            </span>
          ) : (
            <Link
              href={productsHref(pageParams, { page: String(page - 1) })}
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
              href={productsHref(pageParams, { page: String(page + 1) })}
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
