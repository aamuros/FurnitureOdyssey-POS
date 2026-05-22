import assert from "node:assert/strict";
import test from "node:test";
import {
  canCompleteOrder,
  canScheduleDeliveryByPaymentState,
  canScheduleOrderDelivery
} from "@/lib/orders/status";

const itemWithOneRemaining = {
  quantity: 3,
  deliveryItems: [
    {
      quantityPlanned: 2,
      delivery: {
        status: "SCHEDULED"
      }
    }
  ]
};

test("delivery scheduling does not require payment completion or due timing", () => {
  assert.equal(
    canScheduleDeliveryByPaymentState({
      paymentStatus: "UNPAID",
      balanceAmount: 1000,
      paymentDueTiming: null
    }),
    true
  );

  assert.equal(
    canScheduleDeliveryByPaymentState({
      paymentStatus: "PARTIALLY_PAID",
      balanceAmount: 1000,
      paymentDueTiming: "BEFORE_DELIVERY"
    }),
    true
  );

  assert.equal(
    canScheduleDeliveryByPaymentState({
      paymentStatus: "PAID",
      balanceAmount: 0,
      paymentDueTiming: "BEFORE_DELIVERY"
    }),
    true
  );
});

test("delivery scheduling uses remaining active delivery quantity", () => {
  assert.equal(
    canScheduleOrderDelivery({
      status: "PARTIALLY_DELIVERED",
      paymentStatus: "UNPAID",
      balanceAmount: 1000,
      paymentDueTiming: null,
      deliveryStatus: "PARTIALLY_DELIVERED",
      items: [itemWithOneRemaining]
    }),
    true
  );

  assert.equal(
    canScheduleOrderDelivery({
      status: "SCHEDULED_FOR_DELIVERY",
      paymentStatus: "PAID",
      balanceAmount: 0,
      paymentDueTiming: "BEFORE_DELIVERY",
      deliveryStatus: "SCHEDULED",
      items: [
        {
          quantity: 3,
          deliveryItems: [
            {
              quantityPlanned: 3,
              delivery: {
                status: "SCHEDULED"
              }
            }
          ]
        }
      ]
    }),
    false
  );
});

test("order completion requires paid and delivered non-terminal order", () => {
  assert.equal(
    canCompleteOrder({
      status: "DELIVERED",
      paymentStatus: "PAID",
      balanceAmount: 0,
      paymentDueTiming: "BEFORE_DELIVERY",
      deliveryStatus: "DELIVERED"
    }),
    true
  );

  assert.equal(
    canCompleteOrder({
      status: "DELIVERED",
      paymentStatus: "PARTIALLY_PAID",
      balanceAmount: 1,
      paymentDueTiming: "UPON_DELIVERY",
      deliveryStatus: "DELIVERED"
    }),
    false
  );

  assert.equal(
    canCompleteOrder({
      status: "PAID",
      paymentStatus: "PAID",
      balanceAmount: 0,
      paymentDueTiming: "BEFORE_DELIVERY",
      deliveryStatus: "DELIVERED"
    }),
    false
  );
});
