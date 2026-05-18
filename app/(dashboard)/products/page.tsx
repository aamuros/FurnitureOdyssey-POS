import { ProductWorkspace } from "@/components/dashboard/product-workspace";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

type ProductsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    category?: string;
    website?: string;
  }>;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const user = await requirePermission("PRODUCTS", "VIEW");
  const params = (await searchParams) ?? {};
  const query = params.q?.trim();
  const status =
    params.status === "ACTIVE" || params.status === "INACTIVE" ? params.status : undefined;
  const category = params.category?.trim() || undefined;
  const website =
    params.website === "visible" ? true : params.website === "hidden" ? false : undefined;

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        status,
        category,
        isWebsiteVisible: website,
        OR: query
          ? [
              { name: { contains: query, mode: "insensitive" } },
              { code: { contains: query, mode: "insensitive" } },
              { category: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { specifications: { contains: query, mode: "insensitive" } }
            ]
          : undefined
      },
      orderBy: [
        {
          updatedAt: "desc"
        }
      ],
      include: {
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
          ]
        }
      }
    }),
    prisma.product.findMany({
      where: {
        category: {
          not: null
        }
      },
      distinct: ["category"],
      orderBy: {
        category: "asc"
      },
      select: {
        category: true
      }
    })
  ]);

  return (
    <>
      <PageHeader
        title="Products"
        description="Admin catalog records used by internal quotations and orders, with image metadata and future website visibility controls."
      />
      <form className="mb-6 grid gap-3 rounded-lg border border-border bg-panel p-4 md:grid-cols-[1.4fr_0.75fr_0.9fr_0.9fr_auto]">
        <Input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search name, code, category, description, or specifications"
        />
        <Select name="status" defaultValue={params.status ?? ""}>
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
        <Select name="category" defaultValue={params.category ?? ""}>
          <option value="">All categories</option>
          {categories.map((item) =>
            item.category ? (
              <option key={item.category} value={item.category}>
                {item.category}
              </option>
            ) : null
          )}
        </Select>
        <Select name="website" defaultValue={params.website ?? ""}>
          <option value="">Any website visibility</option>
          <option value="visible">Website visible</option>
          <option value="hidden">Website hidden</option>
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      <ProductWorkspace
        canCreate={hasPermission(user, "PRODUCTS", "CREATE")}
        canUpdate={hasPermission(user, "PRODUCTS", "UPDATE")}
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
            referenceCost: product.referenceCost ? Number(product.referenceCost) : null,
            currency: product.currency,
            status: product.status,
            isWebsiteVisible: product.isWebsiteVisible,
            websiteSortOrder: product.websiteSortOrder,
            internalNotes: product.internalNotes,
            primaryImage: primaryImage
              ? {
                  secureUrl: primaryImage.secureUrl,
                  altText: primaryImage.altText
                }
              : null,
            images: product.images.map((image) => ({
              id: image.id,
              cloudinaryPublicId: image.cloudinaryPublicId,
              secureUrl: image.secureUrl,
              altText: image.altText ?? "",
              sortOrder: image.sortOrder,
              isPrimary: image.isPrimary
            })),
            updatedAt: formatDate(product.updatedAt)
          };
        })}
      />
    </>
  );
}
