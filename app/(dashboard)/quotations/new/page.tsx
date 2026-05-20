import { PageHeader } from "@/components/dashboard/page-header";
import { QuotationBuilder } from "@/components/dashboard/quotation-workspace";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { hasPermission } from "@/lib/auth/permissions";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NewQuotationPage() {
  const user = await requirePermission("QUOTATIONS", "CREATE");
  const canCreateCustomers = hasPermission(user, "CUSTOMERS", "CREATE");
  const canUpdateQuotations = hasPermission(user, "QUOTATIONS", "UPDATE");

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: {
        archivedAt: null
      },
      orderBy: {
        displayName: "asc"
      },
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
    }),
    prisma.product.findMany({
      where: {
        status: "ACTIVE"
      },
      orderBy: {
        name: "asc"
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
          ],
          take: 1
        }
      }
    })
  ]);

  return (
    <>
      <PageHeader
        title="New quotation"
        description="Build a simple quotation cart for a customer using products, custom items, quantities, fixed discounts, and totals."
      >
        <Link
          href="/quotations"
          className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-lg border border-border bg-soft-accent/70 px-4 text-sm font-semibold text-foreground transition hover:bg-soft-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to quotations
        </Link>
      </PageHeader>
      <QuotationBuilder
        canCreateCustomers={canCreateCustomers}
        canUpdateQuotations={canUpdateQuotations}
        customers={customers.map((customer) => ({
          id: customer.id,
          displayName: customer.displayName,
          companyName: customer.companyName,
          primaryContact: customer.contacts[0]
            ? `${customer.contacts[0].type.replaceAll("_", " ").toLowerCase()}: ${customer.contacts[0].value}`
            : null
        }))}
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
            primaryImage: primaryImage
              ? {
                  id: primaryImage.id,
                  cloudinaryPublicId: primaryImage.cloudinaryPublicId,
                  secureUrl: primaryImage.secureUrl,
                  resourceType: primaryImage.resourceType,
                  format: primaryImage.format,
                  width: primaryImage.width,
                  height: primaryImage.height,
                  bytes: primaryImage.bytes,
                  altText: primaryImage.altText
                }
              : null
          };
        })}
      />
    </>
  );
}
