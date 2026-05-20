import Link from "next/link";
import { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { CustomerWorkspace } from "@/components/dashboard/customer-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { timeQuery } from "@/lib/query-timing";

type CustomersPageProps = {
  searchParams?: Promise<{
    q?: string;
    type?: string;
    assignedStaffId?: string;
    source?: string;
    archived?: string;
    page?: string;
  }>;
};

const pageSize = 25;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

function customersHref(
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
  return query ? `/customers?${query}` : "/customers";
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  await requirePermission("CUSTOMERS", "VIEW");
  const params = (await searchParams) ?? {};
  const query = params.q?.trim();
  const customerType =
    params.type === "INDIVIDUAL" || params.type === "COMPANY" ? params.type : undefined;
  const source = params.source?.trim() || undefined;
  const assignedStaffId = params.assignedStaffId?.trim() || undefined;
  const showArchived = params.archived === "true";
  const page = Math.max(Number(params.page ?? 1) || 1, 1);
  const customerWhere: Prisma.CustomerWhereInput = {
    archivedAt: showArchived ? { not: null } : null,
    customerType,
    assignedStaffId: assignedStaffId || undefined,
    AND: source
      ? [
          {
            OR: [
              { source: source as never },
              {
                inquiries: {
                  some: {
                    source: source as never
                  }
                }
              }
            ]
          }
        ]
      : undefined,
    OR: query
      ? [
          { displayName: { contains: query, mode: "insensitive" } },
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
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

  const [customers, customerCount, staff] = await Promise.all([
    timeQuery("customers:list", prisma.customer.findMany({
      where: customerWhere,
      orderBy: {
        updatedAt: "desc"
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        displayName: true,
        customerType: true,
        companyName: true,
        contactPersonName: true,
        source: true,
        updatedAt: true,
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
        },
        assignedStaff: {
          select: {
            displayName: true
          }
        },
        inquiries: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            source: true,
            status: true
          }
        }
      }
    })),
    timeQuery("customers:count", prisma.customer.count({
      where: customerWhere
    })),
    timeQuery("customers:staff-options", prisma.userProfile.findMany({
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
    }))
  ]);
  const totalPages = Math.max(Math.ceil(customerCount / pageSize), 1);
  const pageParams = {
    q: params.q,
    type: params.type,
    assignedStaffId: params.assignedStaffId,
    source: params.source,
    archived: params.archived
  };

  return (
    <>
      <PageHeader
        title="Customer Directory"
        description="Buyer records for contact reuse, address reuse, sales history, and repeat-customer context."
      />
      <form className="mb-6 grid gap-3 rounded-lg border border-border bg-panel p-4 md:grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr_auto]">
        <Input name="q" defaultValue={params.q ?? ""} placeholder="Search name, company, phone, Viber, Facebook, or email" />
        <Select name="type" defaultValue={params.type ?? ""}>
          <option value="">All types</option>
          <option value="INDIVIDUAL">Individual</option>
          <option value="COMPANY">Company</option>
        </Select>
        <Select name="assignedStaffId" defaultValue={params.assignedStaffId ?? ""}>
          <option value="">All staff</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </Select>
        <Select name="source" defaultValue={params.source ?? ""}>
          <option value="">Any source</option>
          <option value="FACEBOOK_MARKETPLACE">Facebook Marketplace</option>
          <option value="FACEBOOK_PAGE">Facebook Page</option>
          <option value="MESSENGER">Messenger</option>
          <option value="VIBER">Viber</option>
          <option value="WALK_IN">Walk-in</option>
          <option value="PHONE">Phone</option>
          <option value="REFERRAL">Referral</option>
          <option value="OTHER">Other</option>
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      <CustomerWorkspace
        staff={staff}
        customers={customers.map((customer) => ({
          id: customer.id,
          displayName: customer.displayName,
          customerType: customer.customerType,
          companyName: customer.companyName,
          contactPersonName: customer.contactPersonName,
          primaryContact: customer.contacts[0]
            ? `${customer.contacts[0].type.replaceAll("_", " ").toLowerCase()}: ${customer.contacts[0].value}`
            : null,
          source: customer.source ?? customer.inquiries[0]?.source ?? null,
          assignedStaff: customer.assignedStaff?.displayName ?? null,
          updatedAt: formatDate(customer.updatedAt)
        }))}
      />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-panel px-4 py-3 text-sm text-muted-foreground">
        <span>
          Showing {customers.length} of {customerCount} customer(s), page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <span className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-md border border-border bg-panel px-4 text-sm font-medium opacity-60">
              Previous
            </span>
          ) : (
            <Link
              href={customersHref(pageParams, { page: String(page - 1) })}
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
              href={customersHref(pageParams, { page: String(page + 1) })}
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
