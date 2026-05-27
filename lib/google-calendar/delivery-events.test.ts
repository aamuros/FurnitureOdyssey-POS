import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  buildDeliveryCalendarEventPayload,
  resolveDeliveryCalendarTargetDescriptors
} from "@/lib/google-calendar/delivery-events";

test("builds a delivery calendar payload without sensitive payment or cost details", () => {
  const payload = buildDeliveryCalendarEventPayload({
    id: "delivery-1",
    deliveryNumber: "DR-1001",
    status: "SCHEDULED",
    scheduledDate: new Date("2026-06-01T00:00:00.000Z"),
    scheduledStartAt: new Date("2026-06-01T06:00:00.000Z"),
    scheduledEndAt: new Date("2026-06-01T06:30:00.000Z"),
    scheduledStartTime: "09:00",
    scheduledEndTime: "12:00",
    scheduledTimeWindow: "9 AM - 12 PM",
    deliveryAddressSnapshot: {
      addressLine: "123 Main Street",
      city: "Quezon City",
      province: "Metro Manila"
    },
    recipientName: "Maria Santos",
    recipientPhone: "09170000000",
    deliveryNotes: "Call before arrival.",
    internalNotes: "Gate pass ready.",
    assignedStaffId: "staff-1",
    createdById: "staff-1",
    googleCalendarEventId: null,
    googleCalendarId: null,
    calendarSyncedUserId: null,
    assignedStaff: {
      displayName: "Alex Staff",
      email: "alex@example.com"
    },
    order: {
      orderNumber: "ORD-1001",
      customerDisplayNameSnapshot: "Maria Santos",
      deliveryAddressSnapshot: null,
      primaryContactSnapshot: {
        value: "maria@example.com"
      },
      quotation: {
        quotationNumber: "QTN-1001",
        createdById: "staff-1"
      }
    },
    items: [
      {
        quantityPlanned: new Prisma.Decimal("2"),
        orderItem: {
          itemName: "Tolix Chair"
        }
      }
    ],
    calendarEvents: []
  });

  assert.equal(payload.summary, "Delivery: ORD-1001 - Maria Santos [SCHEDULED]");
  assert.equal(payload.location, "123 Main Street, Quezon City, Metro Manila");
  assert.equal(payload.start.dateTime, "2026-06-01T14:00:00+08:00");
  assert.equal(payload.end.dateTime, "2026-06-01T14:30:00+08:00");
  assert.equal(payload.start.timeZone, "Asia/Manila");
  assert.match(payload.description, /Delivery time: 9 AM - 12 PM/);
  assert.match(payload.description, /Customer contact: 09170000000/);
  assert.match(payload.description, /Assigned staff: Alex Staff/);
  assert.match(payload.description, /Items: 2 x Tolix Chair/);
  assert.match(payload.description, /Quotation number: QTN-1001/);
  assert.doesNotMatch(payload.description, /Gate pass ready/);
  assert.doesNotMatch(payload.description, /internal notes/i);
  assert.doesNotMatch(payload.description, /payment/i);
  assert.doesNotMatch(payload.description, /cost/i);
  assert.doesNotMatch(payload.description, /profit/i);
});

test("builds a delivery calendar payload without quotation", () => {
  const payload = buildDeliveryCalendarEventPayload({
    id: "delivery-2",
    deliveryNumber: "DR-1002",
    status: "SCHEDULED",
    scheduledDate: new Date("2026-06-02T14:00:00.000Z"),
    scheduledStartAt: null,
    scheduledEndAt: null,
    scheduledStartTime: null,
    scheduledEndTime: null,
    scheduledTimeWindow: null,
    deliveryAddressSnapshot: null,
    recipientName: null,
    recipientPhone: null,
    deliveryNotes: null,
    internalNotes: null,
    assignedStaffId: null,
    createdById: "staff-2",
    googleCalendarEventId: null,
    googleCalendarId: null,
    calendarSyncedUserId: null,
    assignedStaff: null,
    order: {
      orderNumber: "ORD-1002",
      customerDisplayNameSnapshot: "Juan Cruz",
      deliveryAddressSnapshot: null,
      primaryContactSnapshot: null,
      quotation: null
    },
    items: [],
    calendarEvents: []
  });

  assert.equal(payload.summary, "Delivery: ORD-1002 - Juan Cruz [SCHEDULED]");
  assert.equal(payload.start.date, "2026-06-02");
  assert.equal(payload.end.date, "2026-06-03");
  assert.doesNotMatch(payload.description, /Quotation number/);
});

test("targets owner and assigned staff calendars without duplicating the same user", () => {
  assert.deepEqual(
    resolveDeliveryCalendarTargetDescriptors(
      {
        assignedStaffId: "staff-1",
        createdById: "creator-1",
        order: {
          quotation: {
            createdById: "quote-creator-1"
          }
        }
      },
      "owner-1"
    ),
    [
      { targetType: "OWNER", userId: "owner-1" },
      { targetType: "ASSIGNED_STAFF", userId: "staff-1" }
    ]
  );

  assert.deepEqual(
    resolveDeliveryCalendarTargetDescriptors(
      {
        assignedStaffId: "owner-1",
        createdById: "creator-1",
        order: {
          quotation: {
            createdById: "quote-creator-1"
          }
        }
      },
      "owner-1"
    ),
    [{ targetType: "OWNER", userId: "owner-1" }]
  );
});

test("falls back to staff creator calendar when no delivery assignee is selected", () => {
  assert.deepEqual(
    resolveDeliveryCalendarTargetDescriptors(
      {
        assignedStaffId: null,
        createdById: "creator-1",
        order: {
          quotation: {
            createdById: "quote-creator-1"
          }
        }
      },
      "owner-1"
    ),
    [
      { targetType: "OWNER", userId: "owner-1" },
      { targetType: "STAFF_CREATOR", userId: "quote-creator-1" }
    ]
  );
});
