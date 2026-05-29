import assert from "node:assert/strict";
import test from "node:test";
import { calculateDeliverySummary } from "@/lib/deliveries/calculations";
import { prepareDeliveryProgressUpdate } from "@/lib/deliveries/progress";
import { createDeliverySchema } from "@/lib/validation/orders";

const deliveryItems = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    quantityPlanned: 2,
    quantityDelivered: 0
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    quantityPlanned: 1,
    quantityDelivered: 0
  }
];

test("createDeliverySchema ignores arbitrary client delivery status", () => {
  const parsed = createDeliverySchema.parse({
    orderId: "33333333-3333-4333-8333-333333333333",
    status: "DELIVERED",
    scheduledDate: "2026-05-19",
    items: [
      {
        orderItemId: "44444444-4444-4444-8444-444444444444",
        quantityPlanned: 1
      }
    ]
  });

  assert.equal("status" in parsed, false);
});

test("createDeliverySchema requires a scheduled date", () => {
  const parsed = createDeliverySchema.safeParse({
    orderId: "33333333-3333-4333-8333-333333333333",
    items: [
      {
        orderItemId: "44444444-4444-4444-8444-444444444444",
        quantityPlanned: 1
      }
    ]
  });

  assert.equal(parsed.success, false);
});

test("createDeliverySchema accepts a single exact delivery start time", () => {
  const parsed = createDeliverySchema.safeParse({
    orderId: "33333333-3333-4333-8333-333333333333",
    scheduledDate: "2026-05-19",
    scheduledStartTime: "15:00",
    items: [
      {
        orderItemId: "44444444-4444-4444-8444-444444444444",
        quantityPlanned: 1
      }
    ]
  });

  assert.equal(parsed.success, true);
  assert.equal(parsed.data.scheduledEndTime, undefined);
});

test("createDeliverySchema normalizes nullable delivery PDF details", () => {
  const parsed = createDeliverySchema.safeParse({
    orderId: "33333333-3333-4333-8333-333333333333",
    scheduledDate: "2026-05-19",
    scheduledStartTime: "15:00",
    recipientPhone: null,
    deliveryNotes: null,
    pdfDetails: JSON.stringify([
      { id: null, label: "PO", value: 1234 },
      { id: null, label: null, value: null }
    ]),
    items: [
      {
        orderItemId: "44444444-4444-4444-8444-444444444444",
        quantityPlanned: 1
      }
    ]
  });

  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data.pdfDetails, [{ id: "row-1", label: "PO", value: "1234" }]);
  assert.equal(parsed.data.recipientPhone, undefined);
  assert.equal(parsed.data.deliveryNotes, undefined);
});

test("createDeliverySchema rejects half-filled delivery PDF details with a field path", () => {
  const parsed = createDeliverySchema.safeParse({
    orderId: "33333333-3333-4333-8333-333333333333",
    scheduledDate: "2026-05-19",
    scheduledStartTime: "15:00",
    pdfDetails: JSON.stringify([{ id: null, label: "PO", value: null }]),
    items: [
      {
        orderItemId: "44444444-4444-4444-8444-444444444444",
        quantityPlanned: 1
      }
    ]
  });

  assert.equal(parsed.success, false);

  if (!parsed.success) {
    assert.deepEqual(parsed.error.issues[0]?.path, ["pdfDetails", 0, "value"]);
  }
});

test("prepareDeliveryProgressUpdate supports scheduled to in transit to partial to delivered", () => {
  const inTransit = prepareDeliveryProgressUpdate({
    currentStatus: "SCHEDULED",
    nextStatus: "IN_TRANSIT",
    existingItems: deliveryItems,
    itemInputs: []
  });

  assert.equal(inTransit.status, "IN_TRANSIT");
  assert.equal(inTransit.items[0].quantityDelivered, 0);

  const partial = prepareDeliveryProgressUpdate({
    currentStatus: "IN_TRANSIT",
    nextStatus: "DELIVERED",
    existingItems: inTransit.items,
    itemInputs: [
      {
        deliveryItemId: deliveryItems[0].id,
        quantityDelivered: 1
      }
    ]
  });

  assert.equal(partial.status, "PARTIALLY_DELIVERED");
  assert.equal(partial.items[0].quantityDelivered, 1);

  const delivered = prepareDeliveryProgressUpdate({
    currentStatus: "PARTIALLY_DELIVERED",
    nextStatus: "DELIVERED",
    existingItems: partial.items,
    itemInputs: [],
    markAllDelivered: true
  });

  assert.equal(delivered.status, "DELIVERED");
  assert.deepEqual(
    delivered.items.map((item) => item.quantityDelivered),
    [2, 1]
  );
});

test("prepareDeliveryProgressUpdate rejects delivered action without delivered quantities", () => {
  assert.throws(
    () =>
      prepareDeliveryProgressUpdate({
        currentStatus: "SCHEDULED",
        nextStatus: "DELIVERED",
        existingItems: deliveryItems,
        itemInputs: []
      }),
    /Enter delivered quantities/
  );
});

test("prepareDeliveryProgressUpdate rejects cancelled delivery updates", () => {
  assert.throws(
    () =>
      prepareDeliveryProgressUpdate({
        currentStatus: "CANCELLED",
        nextStatus: "CANCELLED",
        existingItems: deliveryItems,
        itemInputs: []
      }),
    /Cancelled deliveries cannot be updated/
  );
});

test("prepareDeliveryProgressUpdate blocks delivered quantity above planned quantity", () => {
  assert.throws(
    () =>
      prepareDeliveryProgressUpdate({
        currentStatus: "IN_TRANSIT",
        nextStatus: "PARTIALLY_DELIVERED",
        existingItems: deliveryItems,
        itemInputs: [
          {
            deliveryItemId: deliveryItems[0].id,
            quantityDelivered: 2.01
          }
        ]
      }),
    /Delivered quantity cannot exceed planned quantity/
  );
});

test("delivery summary reflects progress item updates", () => {
  const partial = prepareDeliveryProgressUpdate({
    currentStatus: "IN_TRANSIT",
    nextStatus: "DELIVERED",
    existingItems: deliveryItems,
    itemInputs: [
      {
        deliveryItemId: deliveryItems[0].id,
        quantityDelivered: 1
      }
    ]
  });

  const partialSummary = calculateDeliverySummary({
    orderItems: [
      {
        id: "order-item-1",
        quantity: 2,
        deliveryItems: [{ quantityDelivered: partial.items[0].quantityDelivered, delivery: { status: "PARTIALLY_DELIVERED" } }]
      },
      {
        id: "order-item-2",
        quantity: 1,
        deliveryItems: [{ quantityDelivered: partial.items[1].quantityDelivered, delivery: { status: "PARTIALLY_DELIVERED" } }]
      }
    ],
    deliveries: [{ status: "PARTIALLY_DELIVERED" }]
  });

  assert.equal(partialSummary.deliveryStatus, "PARTIALLY_DELIVERED");

  const delivered = prepareDeliveryProgressUpdate({
    currentStatus: "PARTIALLY_DELIVERED",
    nextStatus: "DELIVERED",
    existingItems: partial.items,
    itemInputs: [],
    markAllDelivered: true
  });

  const deliveredSummary = calculateDeliverySummary({
    orderItems: [
      {
        id: "order-item-1",
        quantity: 2,
        deliveryItems: [{ quantityDelivered: delivered.items[0].quantityDelivered, delivery: { status: "DELIVERED" } }]
      },
      {
        id: "order-item-2",
        quantity: 1,
        deliveryItems: [{ quantityDelivered: delivered.items[1].quantityDelivered, delivery: { status: "DELIVERED" } }]
      }
    ],
    deliveries: [{ status: "DELIVERED" }]
  });

  assert.equal(deliveredSummary.deliveryStatus, "DELIVERED");
  assert.equal(deliveredSummary.progressPercentage, 100);
});
