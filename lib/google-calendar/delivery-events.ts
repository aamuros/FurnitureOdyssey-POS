import type { CalendarSyncStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getGoogleCalendarClientForUser,
  googleCalendarEventsUrl
} from "@/lib/google-calendar/client";

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
  googleCalendarEventId: true,
  googleCalendarId: true,
  calendarSyncedUserId: true,
  order: {
    select: {
      orderNumber: true,
      customerDisplayNameSnapshot: true,
      primaryContactSnapshot: true,
      deliveryAddressSnapshot: true
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

export type DeliveryCalendarSyncResult =
  | {
      ok: true;
      status: CalendarSyncStatus;
      eventId: string | null;
      calendarId: string | null;
    }
  | {
      ok: false;
      status: CalendarSyncStatus;
      code: "DELIVERY_NOT_FOUND" | "NO_ASSIGNED_USER" | "NOT_CONNECTED" | "GOOGLE_API_ERROR";
      message: string;
    };

type GoogleCalendarEventResponse = {
  id?: string;
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
  const description = [
    line("Delivery date", formatDateTime(startDate)),
    line("Delivery time", delivery.scheduledTimeWindow),
    line("Delivery address", location),
    line("Customer", customerName),
    line("Customer contact", customerContact(delivery)),
    line("Order number", delivery.order.orderNumber),
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

async function updateDeliverySyncState({
  deliveryId,
  eventId,
  calendarId,
  syncedUserId,
  status,
  error
}: {
  deliveryId: string;
  eventId?: string | null;
  calendarId?: string | null;
  syncedUserId?: string | null;
  status: CalendarSyncStatus;
  error?: string | null;
}) {
  await prisma.delivery.update({
    where: {
      id: deliveryId
    },
    data: {
      googleCalendarEventId: eventId,
      googleCalendarId: calendarId,
      calendarSyncedUserId: syncedUserId,
      calendarSyncedAt: new Date(),
      calendarSyncStatus: status,
      calendarSyncError: error ?? null
    }
  });
}

async function findDelivery(deliveryId: string) {
  return prisma.delivery.findUnique({
    where: {
      id: deliveryId
    },
    select: deliveryEventSelect
  });
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

async function deleteExistingEventForReassignment(delivery: DeliveryCalendarPayloadInput) {
  if (!delivery.googleCalendarEventId || !delivery.googleCalendarId || !delivery.calendarSyncedUserId) {
    return null;
  }

  if (delivery.calendarSyncedUserId === delivery.assignedStaffId) {
    return null;
  }

  const oldClient = await getGoogleCalendarClientForUser(delivery.calendarSyncedUserId);

  if (!oldClient.ok) {
    return oldClient.message;
  }

  try {
    await deleteGoogleEvent({
      calendarId: delivery.googleCalendarId,
      eventId: delivery.googleCalendarEventId,
      accessToken: oldClient.accessToken
    });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Could not delete old Google Calendar event.";
  }
}

async function syncDeliveryEvent(deliveryId: string, action: "create" | "update"): Promise<DeliveryCalendarSyncResult> {
  const delivery = await findDelivery(deliveryId);

  if (!delivery) {
    return {
      ok: false,
      status: "FAILED",
      code: "DELIVERY_NOT_FOUND",
      message: "Delivery was not found."
    };
  }

  if (!delivery.assignedStaffId) {
    await updateDeliverySyncState({
      deliveryId,
      eventId: delivery.googleCalendarEventId,
      calendarId: delivery.googleCalendarId,
      syncedUserId: null,
      status: "DISABLED",
      error: "Delivery has no assigned staff for calendar sync."
    });

    return {
      ok: false,
      status: "DISABLED",
      code: "NO_ASSIGNED_USER",
      message: "Delivery has no assigned staff for calendar sync."
    };
  }

  const client = await getGoogleCalendarClientForUser(delivery.assignedStaffId);

  if (!client.ok) {
    await updateDeliverySyncState({
      deliveryId,
      eventId: delivery.googleCalendarEventId,
      calendarId: delivery.googleCalendarId,
      syncedUserId: delivery.assignedStaffId,
      status: "DISABLED",
      error: client.message
    });

    return {
      ok: false,
      status: "DISABLED",
      code: "NOT_CONNECTED",
      message: client.message
    };
  }

  try {
    const reassignmentDeleteError = action === "update" ? await deleteExistingEventForReassignment(delivery) : null;
    if (reassignmentDeleteError) {
      throw new Error(`Could not delete previous Google Calendar event: ${reassignmentDeleteError}`);
    }
    const payload = buildDeliveryCalendarEventPayload(delivery);
    const canUpdateExistingEvent =
      action === "update" &&
      delivery.googleCalendarEventId &&
      delivery.calendarSyncedUserId === delivery.assignedStaffId;
    const googleAction = canUpdateExistingEvent ? "update" : "create";
    const eventId = await writeGoogleEvent({
      action: googleAction,
      calendarId: client.calendarId,
      accessToken: client.accessToken,
      payload,
      eventId: googleAction === "update" ? delivery.googleCalendarEventId ?? undefined : undefined
    });

    await updateDeliverySyncState({
      deliveryId,
      eventId,
      calendarId: client.calendarId,
      syncedUserId: client.userId,
      status: "SYNCED"
    });

    return {
      ok: true,
      status: "SYNCED",
      eventId,
      calendarId: client.calendarId
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar event sync failed.";
    await updateDeliverySyncState({
      deliveryId,
      eventId: delivery.googleCalendarEventId,
      calendarId: delivery.googleCalendarId,
      syncedUserId: delivery.assignedStaffId,
      status: "FAILED",
      error: message
    });

    return {
      ok: false,
      status: "FAILED",
      code: "GOOGLE_API_ERROR",
      message
    };
  }
}

export function createDeliveryCalendarEvent(deliveryId: string) {
  return syncDeliveryEvent(deliveryId, "create");
}

export function updateDeliveryCalendarEvent(deliveryId: string) {
  return syncDeliveryEvent(deliveryId, "update");
}

export async function deleteDeliveryCalendarEvent(deliveryId: string): Promise<DeliveryCalendarSyncResult> {
  const delivery = await findDelivery(deliveryId);

  if (!delivery) {
    return {
      ok: false,
      status: "FAILED",
      code: "DELIVERY_NOT_FOUND",
      message: "Delivery was not found."
    };
  }

  if (!delivery.googleCalendarEventId || !delivery.googleCalendarId || !delivery.calendarSyncedUserId) {
    await updateDeliverySyncState({
      deliveryId,
      eventId: null,
      calendarId: delivery.googleCalendarId,
      syncedUserId: delivery.calendarSyncedUserId,
      status: "NOT_SYNCED"
    });

    return {
      ok: true,
      status: "NOT_SYNCED",
      eventId: null,
      calendarId: delivery.googleCalendarId
    };
  }

  const client = await getGoogleCalendarClientForUser(delivery.calendarSyncedUserId);

  if (!client.ok) {
    await updateDeliverySyncState({
      deliveryId,
      eventId: delivery.googleCalendarEventId,
      calendarId: delivery.googleCalendarId,
      syncedUserId: delivery.calendarSyncedUserId,
      status: "DISABLED",
      error: client.message
    });

    return {
      ok: false,
      status: "DISABLED",
      code: "NOT_CONNECTED",
      message: client.message
    };
  }

  try {
    await deleteGoogleEvent({
      calendarId: delivery.googleCalendarId,
      eventId: delivery.googleCalendarEventId,
      accessToken: client.accessToken
    });

    await updateDeliverySyncState({
      deliveryId,
      eventId: null,
      calendarId: delivery.googleCalendarId,
      syncedUserId: delivery.calendarSyncedUserId,
      status: "NOT_SYNCED"
    });

    return {
      ok: true,
      status: "NOT_SYNCED",
      eventId: null,
      calendarId: delivery.googleCalendarId
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar event delete failed.";
    await updateDeliverySyncState({
      deliveryId,
      eventId: delivery.googleCalendarEventId,
      calendarId: delivery.googleCalendarId,
      syncedUserId: delivery.calendarSyncedUserId,
      status: "FAILED",
      error: message
    });

    return {
      ok: false,
      status: "FAILED",
      code: "GOOGLE_API_ERROR",
      message
    };
  }
}
