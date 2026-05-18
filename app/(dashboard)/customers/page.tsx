import { PageHeader } from "@/components/dashboard/page-header";
import { CustomerWorkspace } from "@/components/dashboard/customer-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";

type CustomersPageProps = {
  searchParams?: Promise<{
    q?: string;
    type?: string;
    assignedStaffId?: string;
    source?: string;
    archived?: string;
  }>;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
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

  const [customers, staff] = await Promise.all([
    prisma.customer.findMany({
      where: {
        archivedAt: showArchived ? { not: null } : null,
        customerType,
        assignedStaffId: assignedStaffId || undefined,
        inquiries: source
          ? {
              some: {
                source: source as never
              }
            }
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
      },
      orderBy: {
        updatedAt: "desc"
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
    })
  ]);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Central records for individual buyers and company clients from marketplace, Messenger, Viber, and manual staff intake."
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
          latestInquirySource: customer.inquiries[0]?.source ?? null,
          latestInquiryStatus: customer.inquiries[0]?.status ?? null,
          assignedStaff: customer.assignedStaff?.displayName ?? null,
          updatedAt: formatDate(customer.updatedAt)
        }))}
      />
    </>
  );
}
