import { PageHeader } from "@/components/dashboard/page-header";
import { QuotationWorkspace } from "@/components/dashboard/quotation-workspace";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { hasPermission } from "@/lib/auth/permissions";

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
  const user = await requirePermission("QUOTATIONS", "VIEW");
  const params = (await searchParams) ?? {};
  const query = params.q?.trim();
  const status = params.status?.trim() || undefined;
  const canCreateCustomers = hasPermission(user, "CUSTOMERS", "CREATE");

  const [customers, staff, products, quotations] = await Promise.all([
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
    prisma.userProfile.findMany({
      where: {
        status: "ACTIVE"
      },
      orderBy: {
        displayName: "asc"
      },
      select: {
        id: true,
        displayName: true
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
    }),
    prisma.quotation.findMany({
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
    })
  ]);

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Create a quotation for a serious buyer with catalog snapshots, custom items, negotiated pricing, discounts, notes, and PDF-ready data."
      />
      <QuotationWorkspace
        canCreateCustomers={canCreateCustomers}
        staff={staff}
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
        quotations={quotations.map((quotation) => ({
          id: quotation.id,
          quotationNumber: quotation.quotationNumber,
          customerName: quotation.customer.displayName,
          status: quotation.status,
          needsAssembly: quotation.needsAssembly,
          salesInvoiceRequested: quotation.salesInvoiceRequested,
          modeOfDelivery: quotation.modeOfDelivery,
          deliveryMethod: quotation.deliveryMethod,
          paymentTerms: quotation.paymentTerms,
          specialInstructions: quotation.specialInstructions,
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
