import type { CalendarSyncStatus, CalendarTargetType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getGoogleCalendarClientForUser,
  googleCalendarEventsUrl
} from "@/lib/google-calendar/client";
import { getGoogleCalendarOwnerEmail } from "@/lib/google-calendar/config";

const defaultEventDurationMs = 60 * 60 * 1000;

const deliveryEventSelect = {
  id: true,
  deliveryNumber: true,
  status: true,
  scheduledDate: true,
  scheduledTimeWindow: true,
  deliveryAddressSnapshot: true,
  recipientName: true,
  recipientPhone: true,
  deliveryNotes: true,
  internalNotes: true,
  assignedStaffId: true,
  createdById: true,
  googleCalendarEventId: true,
  googleCalendarId: true,
  calendarSyncedUserId: true,
  order: {
    select: {
      orderNumber: true,
      customerDisplayNameSnapshot: true,
      primaryContactSnapshot: true,
      deliveryAddressSnapshot: true,
      quotation: {
        select: {
          quotationNumber: true,
          createdById: true
        }
      }
    }
  },
  assignedStaff: {
    select: {
      displayName: true,
      email: true
    }
  },
  items: {
    select: {
      quantityPlanned: true,
      orderItem: {
        select: {
          itemName: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  },
  calendarEvents: {
    select: {
      id: true,
      userId: true,
      targetType: true,
      googleCalendarId: true,
      googleCalendarEventId: true,
      syncStatus: true
    }
  }
} satisfies Prisma.DeliverySelect;

type DeliveryCalendarPayloadInput = Prisma.DeliveryGetPayload<{
  select: typeof deliveryEventSelect;
}>;

export type GoogleCalendarEventPayload = {
  summary: string;
  location?: string;
  description: string;
  start: {
    dateTime: string;
  };
  end: {
    dateTime: string;
  };
};

export type CalendarTargetResult = {
  targetType: CalendarTargetType;
  userId: string;
  syncStatus: CalendarSyncStatus;
  eventId: string | null;
  calendarId: string | null;
  error?: string;
};

export type DeliveryCalendarSyncResult = {
  targets: CalendarTargetResult[];
};

type GoogleCalendarEventResponse = {
  id?: string;
};

type ResolvedTarget = {
  targetType: CalendarTargetType;
  userId: string;
};

function valueFromJsonSnapshot(snapshot: Prisma.JsonValue | null | undefined, keys: string[]) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  for (const key of keys) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function addressFromSnapshot(snapshot: Prisma.JsonValue | null | undefined) {
  if (typeof snapshot === "string" && snapshot.trim()) {
    return snapshot.trim();
  }

  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const parts = [
    valueFromJsonSnapshot(snapshot, ["addressLine", "addressLine1", "street"]),
    valueFromJsonSnapshot(snapshot, ["city"]),
    valueFromJsonSnapshot(snapshot, ["province", "state"]),
    valueFromJsonSnapshot(snapshot, ["postalCode", "zip"])
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

function customerContact(delivery: DeliveryCalendarPayloadInput) {
  return (
    delivery.recipientPhone ??
    valueFromJsonSnapshot(delivery.order.primaryContactSnapshot, ["value", "phone", "email", "label"])
  );
}

function formatDateTime(value: Date) {
  return value.toISOString();
}

function itemSummary(delivery: DeliveryCalendarPayloadInput) {
  const items = delivery.items
    .map((item) => {
      const quantity = item.quantityPlanned.toString();
      const name = item.orderItem.itemName.trim();
      return name ? `${quantity} x ${name}` : null;
    })
    .filter(Boolean);

  return items.length ? items.join(", ") : null;
}

function line(label: string, value: string | null | undefined) {
  return value ? `${label}: ${value}` : null;
}

export function buildDeliveryCalendarEventPayload(delivery: DeliveryCalendarPayloadInput): GoogleCalendarEventPayload {
  if (!delivery.scheduledDate) {
    throw new Error("Delivery does not have a scheduled date.");
  }

  const reference = delivery.order.orderNumber ?? delivery.deliveryNumber ?? delivery.id;
  const customerName = delivery.order.customerDisplayNameSnapshot;
  const location =
    addressFromSnapshot(delivery.deliveryAddressSnapshot) ??
    addressFromSnapshot(delivery.order.deliveryAddressSnapshot) ??
    undefined;
  const startDate = delivery.scheduledDate;
  const endDate = new Date(startDate.getTime() + defaultEventDurationMs);
  const assignedStaff = delivery.assignedStaff
    ? delivery.assignedStaff.displayName ?? delivery.assignedStaff.email
    : null;
  const quotationNumber = delivery.order.quotation?.quotationNumber ?? null;
  const description = [
    line("Delivery date", formatDateTime(startDate)),
    line("Delivery time", delivery.scheduledTimeWindow),
    line("Delivery address", location),
    line("Customer", customerName),
    line("Customer contact", customerContact(delivery)),
    line("Order number", delivery.order.orderNumber),
    line("Quotation number", quotationNumber),
    line("Delivery reference", delivery.deliveryNumber),
    line("Delivery status", delivery.status),
    line("Assigned staff", assignedStaff),
    line("Items", itemSummary(delivery)),
    line("Delivery notes", delivery.deliveryNotes)
  ].filter(Boolean);

  return {
    summary: `Delivery: ${reference} - ${customerName}`,
    location,
    description: description.join("\n"),
    start: {
      dateTime: startDate.toISOString()
    },
    end: {
      dateTime: endDate.toISOString()
    }
  };
}

function googleApiErrorMessage(action: string, response: Response) {
  return `Google Calendar ${action} failed with status ${response.status}.`;
}

async function writeGoogleEvent({
  action,
  calendarId,
  accessToken,
  payload,
  eventId
}: {
  action: "create" | "update";
  calendarId: string;
  accessToken: string;
  payload: GoogleCalendarEventPayload;
  eventId?: string;
}) {
  const response = await fetch(googleCalendarEventsUrl(calendarId, eventId), {
    method: action === "create" ? "POST" : "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(googleApiErrorMessage(action, response));
  }

  const data = (await response.json()) as GoogleCalendarEventResponse;
  if (!data.id) {
    throw new Error("Google Calendar did not return an event id.");
  }

  return data.id;
}

async function deleteGoogleEvent({
  calendarId,
  eventId,
  accessToken
}: {
  calendarId: string;
  eventId: string;
  accessToken: string;
}) {
  const response = await fetch(googleCalendarEventsUrl(calendarId, eventId), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error(googleApiErrorMessage("delete", response));
  }
}

async function findDelivery(deliveryId: string) {
  return prisma.delivery.findUnique({
    where: {
      id: deliveryId
    },
    select: deliveryEventSelect
  });
}

async function resolveOwnerUserId(): Promise<{ userId: string | null; skipReason: string | null }> {
  const ownerEmail = getGoogleCalendarOwnerEmail();

  if (!ownerEmail) {
    return {
      userId: null,
      skipReason: "GOOGLE_CALENDAR_OWNER_EMAIL is not configured."
    };
  }

  const ownerUser = await prisma.userProfile.findUnique({
    where: { email: ownerEmail },
    select: { id: true }
  });

  if (!ownerUser) {
    return {
      userId: null,
      skipReason: `Owner user with email "${ownerEmail}" was not found.`
    };
  }

  return { userId: ownerUser.id, skipReason: null };
}

function resolveStaffCreatorUserId(delivery: DeliveryCalendarPayloadInput): string | null {
  return delivery.order.quotation?.createdById ?? delivery.createdById ?? null;
}

async function resolveCalendarTargets(delivery: DeliveryCalendarPayloadInput): Promise<{
  targets: ResolvedTarget[];
  skipped: CalendarTargetResult[];
}> {
  const targets: ResolvedTarget[] = [];
  const skipped: CalendarTargetResult[] = [];

  const staffUserId = resolveStaffCreatorUserId(delivery);
  const ownerResult = await resolveOwnerUserId();

  const ownerUserId = ownerResult.userId;
  const staffAndOwnerAreSame = staffUserId && ownerUserId && staffUserId === ownerUserId;

  if (ownerUserId) {
    targets.push({ targetType: "OWNER", userId: ownerUserId });
  } else {
    skipped.push({
      targetType: "OWNER",
      userId: "",
      syncStatus: "SKIPPED",
      eventId: null,
      calendarId: null,
      error: ownerResult.skipReason ?? "Owner not resolved."
    });
  }

  if (staffUserId && !staffAndOwnerAreSame) {
    targets.push({ targetType: "STAFF_CREATOR", userId: staffUserId });
  } else if (!staffUserId) {
    skipped.push({
      targetType: "STAFF_CREATOR",
      userId: "",
      syncStatus: "SKIPPED",
      eventId: null,
      calendarId: null,
      error: "No quotation creator or delivery creator found."
    });
  }

  return { targets, skipped };
}

async function upsertCalendarEventRecord({
  deliveryId,
  userId,
  targetType,
  connectionId,
  calendarId,
  eventId,
  syncStatus,
  syncError
}: {
  deliveryId: string;
  userId: string;
  targetType: CalendarTargetType;
  connectionId?: string | null;
  calendarId?: string | null;
  eventId?: string | null;
  syncStatus: CalendarSyncStatus;
  syncError?: string | null;
}) {
  await prisma.deliveryCalendarEvent.upsert({
    where: {
      deliveryId_userId_targetType: {
        deliveryId,
        userId,
        targetType
      }
    },
    create: {
      deliveryId,
      userId,
      targetType,
      googleCalendarConnectionId: connectionId ?? null,
      googleCalendarId: calendarId ?? null,
      googleCalendarEventId: eventId ?? null,
      syncStatus,
      syncError: syncError ?? null,
      syncedAt: new Date()
    },
    update: {
      googleCalendarConnectionId: connectionId ?? undefined,
      googleCalendarId: calendarId ?? null,
      googleCalendarEventId: eventId ?? null,
      syncStatus,
      syncError: syncError ?? null,
      syncedAt: new Date()
    }
  });
}

async function syncTargetEvent({
  delivery,
  target,
  payload,
  action
}: {
  delivery: DeliveryCalendarPayloadInput;
  target: ResolvedTarget;
  payload: GoogleCalendarEventPayload;
  action: "create" | "update";
}): Promise<CalendarTargetResult> {
  const client = await getGoogleCalendarClientForUser(target.userId);

  if (!client.ok) {
    await upsertCalendarEventRecord({
      deliveryId: delivery.id,
      userId: target.userId,
      targetType: target.targetType,
      syncStatus: "SKIPPED",
      syncError: client.message
    });

    return {
      targetType: target.targetType,
      userId: target.userId,
      syncStatus: "SKIPPED",
      eventId: null,
      calendarId: null,
      error: client.message
    };
  }

  try {
    const existingEvent = delivery.calendarEvents.find(
      (event) => event.userId === target.userId && event.targetType === target.targetType
    );
    const canUpdate =
      action === "update" &&
      existingEvent?.googleCalendarEventId &&
      existingEvent.syncStatus === "SYNCED";

    const googleAction = canUpdate ? "update" : "create";
    const eventId = await writeGoogleEvent({
      action: googleAction,
      calendarId: client.calendarId,
      accessToken: client.accessToken,
      payload,
      eventId: googleAction === "update" ? existingEvent!.googleCalendarEventId! : undefined
    });

    await upsertCalendarEventRecord({
      deliveryId: delivery.id,
      userId: target.userId,
      targetType: target.targetType,
      calendarId: client.calendarId,
      eventId,
      syncStatus: "SYNCED"
    });

    return {
      targetType: target.targetType,
      userId: target.userId,
      syncStatus: "SYNCED",
      eventId,
      calendarId: client.calendarId
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar event sync failed.";
    await upsertCalendarEventRecord({
      deliveryId: delivery.id,
      userId: target.userId,
      targetType: target.targetType,
      syncStatus: "FAILED",
      syncError: message
    });

    return {
      targetType: target.targetType,
      userId: target.userId,
      syncStatus: "FAILED",
      eventId: null,
      calendarId: null,
      error: message
    };
  }
}

async function cleanupStaleTargets(
  delivery: DeliveryCalendarPayloadInput,
  currentTargets: ResolvedTarget[]
) {
  const currentKeys = new Set(
    currentTargets.map((target) => `${target.userId}:${target.targetType}`)
  );

  const staleEvents = delivery.calendarEvents.filter(
    (event) =>
      !currentKeys.has(`${event.userId}:${event.targetType}`) &&
      event.syncStatus !== "DELETED"
  );

  for (const staleEvent of staleEvents) {
    if (staleEvent.googleCalendarEventId && staleEvent.googleCalendarId) {
      const client = await getGoogleCalendarClientForUser(staleEvent.userId);

      if (client.ok) {
        try {
          await deleteGoogleEvent({
            calendarId: staleEvent.googleCalendarId,
            eventId: staleEvent.googleCalendarEventId,
            accessToken: client.accessToken
          });
        } catch {
          // Best-effort deletion of stale events; continue even if it fails
        }
      }
    }

    await prisma.deliveryCalendarEvent.update({
      where: { id: staleEvent.id },
      data: {
        syncStatus: "DELETED",
        syncError: null,
        syncedAt: new Date()
      }
    });
  }
}

async function syncDeliveryEvent(
  deliveryId: string,
  action: "create" | "update"
): Promise<DeliveryCalendarSyncResult> {
  const delivery = await findDelivery(deliveryId);

  if (!delivery) {
    return {
      targets: []
    };
  }

  const { targets, skipped } = await resolveCalendarTargets(delivery);
  const results: CalendarTargetResult[] = [...skipped];

  if (targets.length === 0) {
    return { targets: results };
  }

  const payload = buildDeliveryCalendarEventPayload(delivery);

  if (action === "update") {
    await cleanupStaleTargets(delivery, targets);
  }

  for (const target of targets) {
    const result = await syncTargetEvent({ delivery, target, payload, action });
    results.push(result);
  }

  return { targets: results };
}

export function createDeliveryCalendarEvent(deliveryId: string) {
  return syncDeliveryEvent(deliveryId, "create");
}

export function updateDeliveryCalendarEvent(deliveryId: string) {
  return syncDeliveryEvent(deliveryId, "update");
}

export async function deleteDeliveryCalendarEvent(
  deliveryId: string
): Promise<DeliveryCalendarSyncResult> {
  const events = await prisma.deliveryCalendarEvent.findMany({
    where: { deliveryId },
    select: {
      id: true,
      userId: true,
      targetType: true,
      googleCalendarId: true,
      googleCalendarEventId: true,
      syncStatus: true
    }
  });

  if (events.length === 0) {
    return { targets: [] };
  }

  const results: CalendarTargetResult[] = [];

  for (const event of events) {
    if (
      event.googleCalendarEventId &&
      event.googleCalendarId &&
      event.syncStatus === "SYNCED"
    ) {
      const client = await getGoogleCalendarClientForUser(event.userId);

      if (client.ok) {
        try {
          await deleteGoogleEvent({
            calendarId: event.googleCalendarId,
            eventId: event.googleCalendarEventId,
            accessToken: client.accessToken
          });
        } catch {
          // Best-effort deletion; record is marked DELETED regardless
        }
      }
    }

    await prisma.deliveryCalendarEvent.update({
      where: { id: event.id },
      data: {
        syncStatus: "DELETED",
        syncError: null,
        syncedAt: new Date()
      }
    });

    results.push({
      targetType: event.targetType,
      userId: event.userId,
      syncStatus: "DELETED",
      eventId: null,
      calendarId: event.googleCalendarId
    });
  }

  return { targets: results };
}
