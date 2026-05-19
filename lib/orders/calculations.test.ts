import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrderItem, calculateOrderTotals, orderStatusFromProgress } from "@/lib/orders/calculations";

const baseOrderItem = {
  itemType: "CUSTOM_ITEM" as const,
  sortOrder: 0,
  itemName: "Custom counter",
  quantity: 1,
  unitPrice: 1000,
  images: []
};

test("calculateOrderTotals handles manual order totals and zero discounts", () => {
  const totals = calculateOrderTotals({
    items: [
      {
        ...baseOrderItem,
        quantity: 2,
        unitPrice: 1500
      },
      {
        ...baseOrderItem,
        itemName: "Add-on shelf",
        quantity: 1,
        unitPrice: 750
      }
    ]
  });

  assert.equal(totals.items[0].lineSubtotal, 3000);
  assert.equal(totals.items[1].lineSubtotal, 750);
  assert.equal(totals.subtotalAmount, 3750);
  assert.equal(totals.itemDiscountTotal, 0);
  assert.equal(totals.orderDiscountAmount, 0);
  assert.equal(totals.totalAmount, 3750);
});

test("calculateOrderTotals handles order created from quotation item snapshots", () => {
  const totals = calculateOrderTotals({
    orderDiscountType: "PERCENTAGE",
    orderDiscountValue: 5,
    items: [
      {
        ...baseOrderItem,
        quotationItemId: "quotation-item-1",
        productId: "product-1",
        itemType: "CATALOG_PRODUCT",
        snapshotProductCode: "FO-CHAIR-001",
        itemName: "Dining chair snapshot",
        quantity: 4,
        unitPrice: 1200,
        unitCostSnapshot: 650
      }
    ]
  });

  assert.equal(totals.subtotalAmount, 4800);
  assert.equal(totals.orderDiscountAmount, 240);
  assert.equal(totals.totalAmount, 4560);
  assert.equal(totals.totalCostAmount, 2600);
  assert.equal(totals.grossProfitAmount, 1960);
});

test("calculateOrderItem applies item-level percentage discounts", () => {
  const item = calculateOrderItem({
    ...baseOrderItem,
    quantity: 2,
    unitPrice: 2000,
    discountType: "PERCENTAGE",
    discountValue: 12.5
  });

  assert.equal(item.lineSubtotal, 4000);
  assert.equal(item.discountAmount, 500);
  assert.equal(item.lineTotal, 3500);
});

test("calculateOrderTotals applies fixed and percentage order discounts", () => {
  const fixed = calculateOrderTotals({
    orderDiscountType: "FIXED_AMOUNT",
    orderDiscountValue: 500,
    items: [{ ...baseOrderItem, quantity: 2, unitPrice: 2000 }]
  });
  const percentage = calculateOrderTotals({
    orderDiscountType: "PERCENTAGE",
    orderDiscountValue: 10,
    items: [{ ...baseOrderItem, quantity: 2, unitPrice: 2000 }]
  });

  assert.equal(fixed.orderDiscountAmount, 500);
  assert.equal(fixed.totalAmount, 3500);
  assert.equal(percentage.orderDiscountAmount, 400);
  assert.equal(percentage.totalAmount, 3600);
});

test("calculateOrderTotals rejects discounts larger than subtotal", () => {
  assert.throws(
    () =>
      calculateOrderTotals({
        orderDiscountType: "FIXED_AMOUNT",
        orderDiscountValue: 2000,
        items: [baseOrderItem]
      }),
    /Order discount exceeds/
  );
});

test("calculateOrderItem snapshots line cost and profit from unit cost", () => {
  const item = calculateOrderItem({
    ...baseOrderItem,
    quantity: 2,
    unitPrice: 1000,
    unitCostSnapshot: 350,
    images: []
  });

  assert.equal(item.lineSubtotal, 2000);
  assert.equal(item.lineTotal, 2000);
  assert.equal(item.lineCostTotal, 700);
  assert.equal(item.lineProfit, 1300);
});

test("calculateOrderTotals reduces gross profit by order-level discounts", () => {
  const totals = calculateOrderTotals({
    orderDiscountType: "FIXED_AMOUNT",
    orderDiscountValue: 100,
    items: [
      {
        itemType: "CUSTOM_ITEM",
        sortOrder: 0,
        itemName: "Chair",
        quantity: 2,
        unitPrice: 500,
        unitCostSnapshot: 300,
        images: []
      }
    ]
  });

  assert.equal(totals.totalAmount, 900);
  assert.equal(totals.totalCostAmount, 600);
  assert.equal(totals.grossProfitAmount, 300);
});

test("calculateOrderTotals snapshots unit cost instead of later product reference cost", () => {
  const itemAtOrderCreation = {
    ...baseOrderItem,
    quantity: 2,
    unitPrice: 1000,
    unitCostSnapshot: 350,
    unitCost: 500
  };

  const totals = calculateOrderTotals({
    items: [itemAtOrderCreation]
  });

  assert.equal(totals.items[0].unitCostSnapshot, 350);
  assert.equal(totals.items[0].lineCostTotal, 700);
  assert.equal(totals.items[0].lineProfit, 1300);
});

test("calculateOrderItem permits negative profit", () => {
  const item = calculateOrderItem({
    itemType: "CUSTOM_ITEM",
    sortOrder: 0,
    itemName: "Discounted item",
    quantity: 1,
    unitPrice: 200,
    unitCostSnapshot: 250,
    images: []
  });

  assert.equal(item.lineCostTotal, 250);
  assert.equal(item.lineProfit, -50);
});

test("orderStatusFromProgress derives payment and delivery progress", () => {
  assert.equal(
    orderStatusFromProgress({
      currentStatus: "CONFIRMED",
      paymentStatus: "PAID",
      deliveryStatus: "NOT_SCHEDULED"
    }),
    "PAID"
  );
  assert.equal(
    orderStatusFromProgress({
      currentStatus: "PAID",
      paymentStatus: "PAID",
      deliveryStatus: "SCHEDULED"
    }),
    "SCHEDULED_FOR_DELIVERY"
  );
  assert.equal(
    orderStatusFromProgress({
      currentStatus: "SCHEDULED_FOR_DELIVERY",
      paymentStatus: "PAID",
      deliveryStatus: "PARTIALLY_DELIVERED"
    }),
    "PARTIALLY_DELIVERED"
  );
  assert.equal(
    orderStatusFromProgress({
      currentStatus: "PARTIALLY_DELIVERED",
      paymentStatus: "PAID",
      deliveryStatus: "DELIVERED"
    }),
    "DELIVERED"
  );
});
