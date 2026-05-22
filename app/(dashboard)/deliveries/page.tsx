import Link from "next/link";
import { DeliveryStatus, Prisma } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

type DeliveriesPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    receiptStatus?: string;
  }>;
};

const deliveryStatuses = [
  "PLANNED",
  "SCHEDULED",
  "IN_TRANSIT",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "FAILED",
  "CANCELLED"
] as const satisfies readonly DeliveryStatus[];

const receiptStatuses = ["generated", "notGenerated"] as const;

type ReceiptStatus = (typeof receiptStatuses)[number];

type DeliveryRecord = Prisma.DeliveryGetPayload<{
  include: {
    order: {
      select: {
        id: true;
        orderNumber: true;
        customerDisplayNameSnapshot: true;
        deliveryStatus: true;
      };
    };
    items: {
      include: {
        orderItem: {
          select: {
            itemName: true;
          };
        };
      };
    };
    documents: {
      where: {
        documentType: "DELIVERY_RECEIPT";
      };
      select: {
        id: true;
      };
    };
  };
}>;

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

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function enumValue<T extends readonly string[]>(values: T, value: string | undefined) {
  return values.includes(value ?? "") ? (value as T[number]) : undefined;
}

function dateRangeWhere(from: Date | undefined, to: Date | undefined) {
  return from || to
    ? {
        gte: from,
        lte: to
      }
    : undefined;
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

function deliverySubtitle(delivery: DeliveryRecord) {
  return `${providerLabel(delivery.deliveryProviderType, delivery.deliveryProviderName)} · ${
    delivery.deliveryProviderReference ?? "No reference"
  }`;
}

function itemSummary(items: DeliveryRecord["items"]) {
  if (items.length === 0) {
    return "No items";
  }

  if (items.length === 1) {
    const [item] = items;
    return `${item.orderItem.itemName}: ${Number(item.quantityDelivered)}/${Number(item.quantityPlanned)}`;
  }

  return `${items.length} items`;
}

function recipientSubtitle(delivery: DeliveryRecord) {
  const addressLine = deliveryAddressLine(delivery.deliveryAddressSnapshot);
  return [delivery.recipientPhone, addressLine].filter(Boolean).join(" · ") || "No address";
}

function readableStatus(value: string) {
  return labelFromEnum(value) ?? value;
}

function statusTone(status: string) {
  if (["DELIVERED", "SCHEDULED", "SCHEDULED_FOR_DELIVERY"].includes(status)) {
    return "success" as const;
  }

  if (["IN_TRANSIT"].includes(status)) {
    return "teal" as const;
  }

  if (["PARTIALLY_DELIVERED"].includes(status)) {
    return "warning" as const;
  }

  if (["CANCELLED", "FAILED"].includes(status)) {
    return "danger" as const;
  }

  return "neutral" as const;
}

function searchWhere(query: string | undefined): Prisma.DeliveryWhereInput[] | undefined {
  if (!query) {
    return undefined;
  }

  return [
    { deliveryNumber: { contains: query, mode: "insensitive" } },
    { deliveryProviderName: { contains: query, mode: "insensitive" } },
    { deliveryProviderReference: { contains: query, mode: "insensitive" } },
    { recipientName: { contains: query, mode: "insensitive" } },
    { recipientPhone: { contains: query, mode: "insensitive" } },
    {
      order: {
        OR: [
          { orderNumber: { contains: query, mode: "insensitive" } },
          { customerDisplayNameSnapshot: { contains: query, mode: "insensitive" } }
        ]
      }
    }
  ];
}

function receiptStatusWhere(status: ReceiptStatus | undefined): Prisma.DeliveryWhereInput {
  if (status === "generated") {
    return {
      documents: {
        some: {
          documentType: "DELIVERY_RECEIPT"
        }
      }
    };
  }

  if (status === "notGenerated") {
    return {
      documents: {
        none: {
          documentType: "DELIVERY_RECEIPT"
        }
      }
    };
  }

  return {};
}

function deliveriesHref(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined> = {}
) {
  const next = new URLSearchParams();

  for (const [paramKey, paramValue] of Object.entries(params)) {
    if (paramValue) {
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
  return query ? `/deliveries?${query}` : "/deliveries";
}

function hasActiveFilters(params: Record<string, string | undefined>) {
  return Object.values(params).some(Boolean);
}

function orderSearchHref(orderNumber: string) {
  const params = new URLSearchParams({ q: orderNumber });
  return `/orders?${params.toString()}`;
}

export default async function DeliveriesPage({ searchParams }: DeliveriesPageProps) {
  await requirePermission("DELIVERIES", "VIEW");

  const params = (await searchParams) ?? {};
  const query = clean(params.q);
  const status = enumValue(deliveryStatuses, params.status);
  const from = parseDate(params.from);
  const to = parseDate(params.to, true);
  const selectedReceiptStatus = enumValue(receiptStatuses, params.receiptStatus);
  const pageParams = {
    q: params.q,
    status: params.status,
    from: params.from,
    to: params.to,
    receiptStatus: params.receiptStatus
  };
  const activeFilters = hasActiveFilters(pageParams);
  const moreFiltersOpen = Boolean(params.from || params.to || selectedReceiptStatus);
  const where: Prisma.DeliveryWhereInput = {
    status,
    scheduledDate: dateRangeWhere(from, to),
    OR: searchWhere(query),
    ...receiptStatusWhere(selectedReceiptStatus)
  };

  const deliveries = await prisma.delivery.findMany({
    where,
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
        description="Track scheduled deliveries, recipients, status, and receipt readiness."
      />

      <form className="mb-5 space-y-3 rounded-lg border border-border bg-panel p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_auto_auto]">
          <Input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search deliveries, orders, customers, recipients..."
            aria-label="Search deliveries"
          />
          <Select name="status" defaultValue={params.status ?? ""} aria-label="Delivery status">
            <option value="">Any status</option>
            {deliveryStatuses.map((deliveryStatus) => (
              <option key={deliveryStatus} value={deliveryStatus}>
                {readableStatus(deliveryStatus)}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
          {activeFilters ? (
            <Link
              href={deliveriesHref(pageParams, {
                q: undefined,
                status: undefined,
                from: undefined,
                to: undefined,
                receiptStatus: undefined
              })}
              className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted/60"
            >
              Clear
            </Link>
          ) : null}
        </div>

        <details open={moreFiltersOpen} className="border-t border-border pt-3">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">More filters</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Input name="from" type="date" defaultValue={params.from ?? ""} aria-label="Schedule from" />
            <Input name="to" type="date" defaultValue={params.to ?? ""} aria-label="Schedule to" />
            <Select
              name="receiptStatus"
              defaultValue={params.receiptStatus ?? ""}
              aria-label="Receipt status"
            >
              <option value="">Any receipt</option>
              <option value="generated">Generated</option>
              <option value="notGenerated">Not generated</option>
            </Select>
          </div>
        </details>
      </form>

      <section className="studio-card">
        <div className="overflow-x-auto">
          <table className="studio-table w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-background text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Delivery</th>
                <th className="px-4 py-3 font-medium">Schedule</th>
                <th className="px-4 py-3 font-medium">Customer / Order</th>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">
                      {delivery.deliveryNumber ?? "Not assigned"}
                    </div>
                    <div className="text-xs text-muted-foreground">{deliverySubtitle(delivery)}</div>
                    <div className="text-xs text-muted-foreground">{itemSummary(delivery.items)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{formatDate(delivery.scheduledDate)}</div>
                    <div className="text-xs text-muted-foreground">
                      {delivery.scheduledTimeWindow ?? "No time window"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">
                      {delivery.order.customerDisplayNameSnapshot}
                    </div>
                    {delivery.order.orderNumber ? (
                      <Link
                        href={orderSearchHref(delivery.order.orderNumber)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {delivery.order.orderNumber}
                      </Link>
                    ) : (
                      <div className="text-xs text-muted-foreground">Not assigned</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {delivery.recipientName ?? "No recipient"}
                    </div>
                    <div className="text-xs text-muted-foreground">{recipientSubtitle(delivery)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={statusTone(delivery.status)}>
                      {readableStatus(delivery.status)}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {deliveries.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            No deliveries found. Scheduled deliveries and receipt readiness will appear here.
          </div>
        ) : null}
      </section>
    </>
  );
}
