import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDeliveryPlanDoesNotExceedOrdered,
  calculateDeliverySummary
} from "@/lib/deliveries/calculations";

test("calculateDeliverySummary handles no delivery scheduled", () => {
  const summary = calculateDeliverySummary({
    orderItems: [{ id: "item-1", quantity: 2 }]
  });

  assert.equal(summary.totalQuantity, 2);
  assert.equal(summary.deliveredQuantity, 0);
  assert.equal(summary.progressPercentage, 0);
  assert.equal(summary.deliveryStatus, "NOT_SCHEDULED");
});

test("calculateDeliverySummary handles scheduled delivery without delivered quantities", () => {
  const summary = calculateDeliverySummary({
    orderItems: [{ id: "item-1", quantity: 2 }],
    deliveries: [{ status: "SCHEDULED" }]
  });

  assert.equal(summary.deliveryStatus, "SCHEDULED");
});

test("calculateDeliverySummary handles partial and full delivery across multiple items", () => {
  const partial = calculateDeliverySummary({
    orderItems: [
      {
        id: "item-1",
        quantity: 2,
        deliveryItems: [{ quantityDelivered: 1, delivery: { status: "DELIVERED" } }]
      },
      {
        id: "item-2",
        quantity: 3,
        deliveryItems: [{ quantityDelivered: 1, delivery: { status: "PARTIALLY_DELIVERED" } }]
      }
    ],
    deliveries: [{ status: "DELIVERED" }, { status: "PARTIALLY_DELIVERED" }]
  });

  assert.equal(partial.deliveredQuantity, 2);
  assert.equal(partial.progressPercentage, 40);
  assert.equal(partial.deliveryStatus, "PARTIALLY_DELIVERED");

  const delivered = calculateDeliverySummary({
    orderItems: [
      {
        id: "item-1",
        quantity: 2,
        deliveryItems: [{ quantityDelivered: 2, delivery: { status: "DELIVERED" } }]
      },
      {
        id: "item-2",
        quantity: 3,
        deliveryItems: [{ quantityDelivered: 3, delivery: { status: "DELIVERED" } }]
      }
    ],
    deliveries: [{ status: "DELIVERED" }]
  });

  assert.equal(delivered.progressPercentage, 100);
  assert.equal(delivered.deliveryStatus, "DELIVERED");
});

test("calculateDeliverySummary ignores cancelled and failed deliveries", () => {
  const summary = calculateDeliverySummary({
    orderItems: [
      {
        id: "item-1",
        quantity: 2,
        deliveryItems: [
          { quantityDelivered: 2, delivery: { status: "CANCELLED" } },
          { quantityDelivered: 1, delivery: { status: "FAILED" } }
        ]
      }
    ],
    deliveries: [{ status: "CANCELLED" }, { status: "FAILED" }]
  });

  assert.equal(summary.deliveredQuantity, 0);
  assert.equal(summary.deliveryStatus, "NOT_SCHEDULED");
});

test("assertDeliveryPlanDoesNotExceedOrdered blocks over-planned delivery quantities", () => {
  assert.doesNotThrow(() =>
    assertDeliveryPlanDoesNotExceedOrdered({
      orderItems: [
        {
          id: "item-1",
          itemName: "Dining table",
          quantity: 3,
          deliveryItems: [{ quantityPlanned: 1, quantityDelivered: 0, delivery: { status: "SCHEDULED" } }]
        }
      ],
      requestedItems: [{ orderItemId: "item-1", quantityPlanned: 2 }]
    })
  );

  assert.throws(
    () =>
      assertDeliveryPlanDoesNotExceedOrdered({
        orderItems: [
          {
            id: "item-1",
            itemName: "Dining table",
            quantity: 3,
            deliveryItems: [{ quantityPlanned: 1, quantityDelivered: 0, delivery: { status: "SCHEDULED" } }]
          }
        ],
        requestedItems: [{ orderItemId: "item-1", quantityPlanned: 2.01 }]
      }),
    /Delivery quantity exceeds/
  );
});
