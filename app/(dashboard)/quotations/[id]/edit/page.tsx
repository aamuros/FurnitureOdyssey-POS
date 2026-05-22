import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { QuotationBuilder } from "@/components/dashboard/quotation-workspace";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

type EditQuotationPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditQuotationPage({ params }: EditQuotationPageProps) {
  const user = await requirePermission("QUOTATIONS", "UPDATE");
  const { id } = await params;
  const canCreateCustomers = hasPermission(user, "CUSTOMERS", "CREATE");

  const [quotation, customers, products] = await Promise.all([
    prisma.quotation.findUnique({
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
    }),
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

  if (!quotation) {
    notFound();
  }

  if (!["DRAFT", "SENT"].includes(quotation.status)) {
    redirect(`/quotations/${quotation.id}`);
  }

  const primaryContact = quotation.customer.contacts[0];
  const inferredAdditionalFees = Math.max(
    Number(quotation.totalAmount) -
      (Number(quotation.subtotalAmount) -
        Number(quotation.itemDiscountTotal) -
        Number(quotation.quotationDiscountAmount) +
        Number(quotation.assemblyFeeTotal) +
        Number(quotation.salesInvoiceFeeTotal)),
    0
  );

  return (
    <>
      <PageHeader
        title={`Edit ${quotation.quotationNumber ?? "quotation"}`}
        description="Draft and sent quotations can be updated before they are accepted, declined, or cancelled."
      />
      <QuotationBuilder
        mode="edit"
        backHref={`/quotations/${quotation.id}`}
        backLabel="Back to quotation"
        canCreateCustomers={canCreateCustomers}
        canUpdateQuotations
        persistenceUserKey={user.id}
        initialQuotation={{
          id: quotation.id,
          status: quotation.status,
          customer: {
            id: quotation.customer.id,
            displayName: quotation.customer.displayName,
            detail: [
              quotation.customer.companyName,
              primaryContact
                ? `${primaryContact.type.replaceAll("_", " ").toLowerCase()}: ${primaryContact.value}`
                : null
            ]
              .filter(Boolean)
              .join(" - ") || null
          },
          quotationDiscountValue: Number(quotation.quotationDiscountValue ?? 0),
          additionalFees: inferredAdditionalFees,
          needsAssembly: quotation.needsAssembly,
          salesInvoiceRequested: quotation.salesInvoiceRequested,
          modeOfDelivery: quotation.modeOfDelivery ?? "",
          deliveryMethod: quotation.deliveryMethod ?? "",
          paymentTerms: quotation.paymentTerms ?? "",
          specialInstructions: quotation.specialInstructions ?? "",
          customerNotes: quotation.customerNotes ?? "",
          internalNotes: quotation.internalNotes ?? "",
          items: quotation.items.map((item) => ({
            productId: item.productId ?? undefined,
            itemType: item.itemType,
            sortOrder: item.sortOrder,
            snapshotProductCode: item.snapshotProductCode ?? undefined,
            itemName: item.itemName,
            description: item.description ?? "",
            specifications: item.specifications ?? "",
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            unitCostSnapshot: Number(item.unitCostSnapshot ?? 0),
            requiresAssembly: item.requiresAssembly,
            discountValue: Number(item.discountValue ?? item.discountAmount ?? 0),
            customerNotes: item.customerNotes ?? "",
            internalNotes: item.internalNotes ?? "",
            images: item.images.map((image) => ({
              sourceProductImageId: image.sourceProductImageId ?? undefined,
              cloudinaryPublicId: image.cloudinaryPublicId,
              secureUrl: image.secureUrl,
              resourceType: image.resourceType,
              format: image.format ?? undefined,
              width: image.width ?? undefined,
              height: image.height ?? undefined,
              bytes: image.bytes ?? undefined,
              altText: image.altText ?? undefined,
              sortOrder: image.sortOrder,
              isPrimary: image.isPrimary
            }))
          }))
        }}
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
            referencePrice: product.referencePrice !== null ? Number(product.referencePrice) : null,
            referenceCost: product.referenceCost !== null ? Number(product.referenceCost) : null,
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
