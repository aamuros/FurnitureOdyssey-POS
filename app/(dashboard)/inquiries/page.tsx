import { PageHeader } from "@/components/dashboard/page-header";
import { InquiryWorkspace } from "@/components/dashboard/inquiry-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";

type InquiriesPageProps = {
  searchParams?: Promise<{
    q?: string;
    source?: string;
    status?: string;
    assignedStaffId?: string;
  }>;
};

function formatDate(value: Date | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

export default async function InquiriesPage({ searchParams }: InquiriesPageProps) {
  await requirePermission("INQUIRIES", "VIEW");
  const params = (await searchParams) ?? {};
  const query = params.q?.trim();
  const source = params.source?.trim() || undefined;
  const status = params.status?.trim() || undefined;
  const assignedStaffId = params.assignedStaffId?.trim() || undefined;

  const [inquiries, customers, staff] = await Promise.all([
    prisma.inquiry.findMany({
      where: {
        source: source ? (source as never) : undefined,
        status: status ? (status as never) : undefined,
        assignedStaffId: assignedStaffId || undefined,
        OR: query
          ? [
              { subject: { contains: query, mode: "insensitive" } },
              { requestedItems: { contains: query, mode: "insensitive" } },
              { messageSummary: { contains: query, mode: "insensitive" } },
              { sourceReference: { contains: query, mode: "insensitive" } },
              {
                customer: {
                  OR: [
                    { displayName: { contains: query, mode: "insensitive" } },
                    { companyName: { contains: query, mode: "insensitive" } }
                  ]
                }
              }
            ]
          : undefined
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        customer: {
          select: {
            displayName: true
          }
        },
        assignedStaff: {
          select: {
            displayName: true
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
      select: {
        id: true,
        displayName: true,
        companyName: true
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
        title="Inquiries"
        description="Structured manual intake for customer requests before quotation, order, payment, or delivery work begins."
      />
      <form className="mb-6 grid gap-3 rounded-lg border border-border bg-panel p-4 md:grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_auto]">
        <Input name="q" defaultValue={params.q ?? ""} placeholder="Search customer, source reference, or requested item" />
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
        <Select name="status" defaultValue={params.status ?? ""}>
          <option value="">Any status</option>
          <option value="NEW">New</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="WAITING_FOR_CUSTOMER">Waiting for customer</option>
          <option value="QUOTED">Quoted</option>
          <option value="CONVERTED_TO_ORDER">Converted to order</option>
          <option value="CLOSED">Closed</option>
          <option value="LOST">Lost</option>
        </Select>
        <Select name="assignedStaffId" defaultValue={params.assignedStaffId ?? ""}>
          <option value="">All staff</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      <InquiryWorkspace
        staff={staff}
        customers={customers}
        inquiries={inquiries.map((inquiry) => ({
          id: inquiry.id,
          subject: inquiry.subject,
          customerName: inquiry.customer.displayName,
          source: inquiry.source,
          status: inquiry.status,
          priority: inquiry.priority,
          requestedItems: inquiry.requestedItems,
          assignedStaff: inquiry.assignedStaff?.displayName ?? null,
          followUpAt: formatDate(inquiry.followUpAt),
          createdAt: formatDate(inquiry.createdAt) ?? ""
        }))}
      />
    </>
  );
}
