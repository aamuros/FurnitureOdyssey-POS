import { PageHeader } from "@/components/dashboard/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date | null) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

function deliveryAddressLine(value: unknown) {
  if (value && typeof value === "object" && "addressLine" in value) {
    const addressLine = (value as { addressLine?: unknown }).addressLine;
    return typeof addressLine === "string" ? addressLine : null;
  }

  return null;
}

function labelFromEnum(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function providerLabel(type: string | null, name: string | null) {
  return name ?? labelFromEnum(type) ?? "No provider";
}

function statusTone(status: string) {
  if (["DELIVERED"].includes(status)) {
    return "success" as const;
  }

  if (["SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED"].includes(status)) {
    return "warning" as const;
  }

  if (["CANCELLED", "FAILED"].includes(status)) {
    return "danger" as const;
  }

  return "neutral" as const;
}

export default async function DeliveriesPage() {
  await requirePermission("DELIVERIES", "VIEW");

  const deliveries = await prisma.delivery.findMany({
    orderBy: [
      {
        scheduledDate: "asc"
      },
      {
        createdAt: "desc"
      }
    ],
    take: 50,
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerDisplayNameSnapshot: true,
          deliveryStatus: true
        }
      },
      items: {
        include: {
          orderItem: {
            select: {
              itemName: true
            }
          }
        }
      },
      documents: {
        where: {
          documentType: "DELIVERY_RECEIPT"
        },
        select: {
          id: true
        }
      }
    }
  });

  return (
    <>
      <PageHeader
        title="Deliveries"
        description="Internal delivery schedules, partial delivery quantities, provider notes, and delivery receipt readiness."
      />

      <section className="overflow-hidden rounded-lg border border-border bg-panel">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Scheduled deliveries</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Delivery records are created from order details and can include partial item quantities.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-border bg-background text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">DR no.</th>
                <th className="px-5 py-3 font-medium">Schedule</th>
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Provider</th>
                <th className="px-5 py-3 font-medium">Recipient</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deliveries.map((delivery) => {
                const addressLine = deliveryAddressLine(delivery.deliveryAddressSnapshot);

                return (
                  <tr key={delivery.id}>
                    <td className="px-5 py-3 font-medium">{delivery.deliveryNumber ?? "Not assigned"}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium">{formatDate(delivery.scheduledDate)}</div>
                      <div className="text-xs text-muted-foreground">
                        {delivery.scheduledTimeWindow ?? "No time window"}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {delivery.order.orderNumber ?? "Not assigned"}
                    </td>
                    <td className="px-5 py-3 font-medium">
                      {delivery.order.customerDisplayNameSnapshot}
                    </td>
                    <td className="px-5 py-3">
                      <div>{providerLabel(delivery.deliveryProviderType, delivery.deliveryProviderName)}</div>
                      <div className="text-xs text-muted-foreground">
                        {delivery.deliveryProviderReference ?? "No reference"}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div>{delivery.recipientName ?? "No recipient"}</div>
                      <div className="text-xs text-muted-foreground">
                        {[delivery.recipientPhone, addressLine].filter(Boolean).join(" · ") ||
                          "No address"}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {delivery.items.map((item) => (
                        <div key={item.id}>
                          {item.orderItem.itemName}: {Number(item.quantityDelivered)}/
                          {Number(item.quantityPlanned)}
                        </div>
                      ))}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill tone={statusTone(delivery.status)}>{delivery.status}</StatusPill>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {delivery.documents.length > 0 ? "Generated" : "Not generated"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {deliveries.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            No deliveries have been scheduled yet.
          </div>
        ) : null}
      </section>
    </>
  );
}
