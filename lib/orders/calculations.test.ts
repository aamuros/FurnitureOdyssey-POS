import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrderItem, calculateOrderTotals } from "@/lib/orders/calculations";

test("calculateOrderItem snapshots line cost and profit from unit cost", () => {
  const item = calculateOrderItem({
    itemType: "CUSTOM_ITEM",
    sortOrder: 0,
    itemName: "Custom counter",
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
