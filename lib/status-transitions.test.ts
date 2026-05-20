import assert from "node:assert/strict";
import test from "node:test";
import {
  assertValidStatusTransition,
  canTransitionStatus,
  getAllowedNextStatuses,
  isTerminalStatus,
  nextOrderStatusFromProgress
} from "@/lib/status-transitions";

test("allows quotation lifecycle transitions", () => {
  assert.equal(canTransitionStatus("quotation", "DRAFT", "SENT"), true);
  assert.equal(canTransitionStatus("quotation", "DRAFT", "ACCEPTED"), true);
  assert.equal(canTransitionStatus("quotation", "SENT", "DRAFT"), true);
  assert.equal(canTransitionStatus("quotation", "SENT", "ACCEPTED"), true);
  assert.equal(canTransitionStatus("quotation", "SENT", "DECLINED"), true);
  assert.equal(canTransitionStatus("quotation", "DRAFT", "CANCELLED"), true);
});

test("blocks invalid and terminal quotation transitions", () => {
  assert.equal(canTransitionStatus("quotation", "ACCEPTED", "SENT"), false);
  assert.throws(
    () => assertValidStatusTransition("quotation", "DECLINED", "ACCEPTED"),
    /Invalid quotation status transition/
  );
  assert.equal(isTerminalStatus("quotation", "CANCELLED"), true);
});

test("allows order lifecycle transitions", () => {
  assert.equal(canTransitionStatus("order", "CONFIRMED", "PARTIALLY_PAID"), true);
  assert.equal(canTransitionStatus("order", "PARTIALLY_PAID", "PAID"), true);
  assert.equal(canTransitionStatus("order", "PAID", "SCHEDULED_FOR_DELIVERY"), true);
  assert.equal(canTransitionStatus("order", "SCHEDULED_FOR_DELIVERY", "PARTIALLY_DELIVERED"), true);
  assert.equal(canTransitionStatus("order", "PARTIALLY_DELIVERED", "DELIVERED"), true);
  assert.equal(canTransitionStatus("order", "DELIVERED", "COMPLETED"), true);
});

test("blocks invalid order lifecycle transitions", () => {
  assert.equal(canTransitionStatus("order", "DELIVERED", "PARTIALLY_PAID"), false);
  assert.throws(
    () => assertValidStatusTransition("order", "COMPLETED", "CANCELLED"),
    /Invalid order status transition: COMPLETED cannot move to CANCELLED/
  );
  assert.equal(isTerminalStatus("order", "CANCELLED"), true);
});

test("allows delivery lifecycle transitions", () => {
  assert.equal(canTransitionStatus("delivery", "PLANNED", "SCHEDULED"), true);
  assert.equal(canTransitionStatus("delivery", "SCHEDULED", "IN_TRANSIT"), true);
  assert.equal(canTransitionStatus("delivery", "IN_TRANSIT", "PARTIALLY_DELIVERED"), true);
  assert.equal(canTransitionStatus("delivery", "PARTIALLY_DELIVERED", "DELIVERED"), true);
  assert.equal(canTransitionStatus("delivery", "FAILED", "SCHEDULED"), true);
});

test("blocks invalid delivery lifecycle transitions", () => {
  assert.equal(canTransitionStatus("delivery", "PLANNED", "DELIVERED"), false);
  assert.equal(canTransitionStatus("delivery", "DELIVERED", "SCHEDULED"), false);
  assert.equal(isTerminalStatus("delivery", "CANCELLED"), true);
});

test("allows payment lifecycle transitions and treats terminal statuses as terminal", () => {
  assert.equal(canTransitionStatus("payment", "RECORDED", "VOIDED"), true);
  assert.equal(canTransitionStatus("payment", "RECORDED", "REFUNDED"), true);
  assert.equal(canTransitionStatus("payment", "VOIDED", "RECORDED"), false);
  assert.equal(isTerminalStatus("payment", "REFUNDED"), true);
});

test("returns allowed next statuses", () => {
  assert.deepEqual(getAllowedNextStatuses("quotation", "SENT"), [
    "DRAFT",
    "ACCEPTED",
    "DECLINED",
    "CANCELLED"
  ]);
  assert.deepEqual(getAllowedNextStatuses("payment", "VOIDED"), []);
});

test("derives order status through central transition checks", () => {
  assert.equal(
    nextOrderStatusFromProgress({
      currentStatus: "CONFIRMED",
      paymentStatus: "PARTIALLY_PAID",
      deliveryStatus: "NOT_SCHEDULED"
    }),
    "PARTIALLY_PAID"
  );
  assert.throws(
    () =>
      nextOrderStatusFromProgress({
        currentStatus: "DELIVERED",
        paymentStatus: "PARTIALLY_PAID",
        deliveryStatus: "NOT_SCHEDULED"
      }),
    /Invalid order status transition/
  );
});
