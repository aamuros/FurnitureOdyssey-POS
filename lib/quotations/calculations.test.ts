import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuotationItem, calculateQuotationTotals } from "@/lib/quotations/calculations";

const baseItem = {
  itemType: "CUSTOM_ITEM" as const,
  sortOrder: 0,
  itemName: "Custom sofa",
  quantity: 1,
  unitPrice: 1000,
  images: []
};

test("calculateQuotationTotals handles a single custom item", () => {
  const totals = calculateQuotationTotals({
    items: [baseItem]
  });

  assert.equal(totals.subtotalAmount, 1000);
  assert.equal(totals.itemDiscountTotal, 0);
  assert.equal(totals.quotationDiscountAmount, 0);
  assert.equal(totals.totalAmount, 1000);
});

test("calculateQuotationTotals handles multiple catalog and custom item totals", () => {
  const totals = calculateQuotationTotals({
    items: [
      {
        ...baseItem,
        itemType: "CATALOG_PRODUCT",
        productId: "product-1",
        itemName: "Catalog dining chair",
        quantity: 4,
        unitPrice: 1250
      },
      {
        ...baseItem,
        itemName: "Custom cushion",
        quantity: 2,
        unitPrice: 350
      }
    ]
  });

  assert.equal(totals.items[0].lineSubtotal, 5000);
  assert.equal(totals.items[1].lineSubtotal, 700);
  assert.equal(totals.subtotalAmount, 5700);
  assert.equal(totals.totalAmount, 5700);
});

test("calculateQuotationItem applies quantity times unit price and fixed item discounts", () => {
  const item = calculateQuotationItem({
    ...baseItem,
    quantity: 3,
    unitPrice: 999.99,
    unitCostSnapshot: 400,
    discountType: "FIXED_AMOUNT",
    discountValue: 250
  });

  assert.equal(item.lineSubtotal, 2999.97);
  assert.equal(item.discountAmount, 250);
  assert.equal(item.lineTotal, 2749.97);
  assert.equal(item.unitCostSnapshot, 400);
  assert.equal(item.lineCostTotal, 1200);
  assert.equal(item.lineProfit, 1549.97);
});

test("calculateQuotationTotals applies percentage quotation discounts after item discounts", () => {
  const totals = calculateQuotationTotals({
    quotationDiscountType: "PERCENTAGE",
    quotationDiscountValue: 10,
    items: [
      {
        ...baseItem,
        quantity: 2,
        unitPrice: 1000,
        discountType: "FIXED_AMOUNT",
        discountValue: 200
      }
    ]
  });

  assert.equal(totals.subtotalAmount, 2000);
  assert.equal(totals.itemDiscountTotal, 200);
  assert.equal(totals.quotationDiscountAmount, 180);
  assert.equal(totals.totalAmount, 1620);
});

test("calculateQuotationTotals applies fixed quotation discounts and zero discount defaults", () => {
  const totals = calculateQuotationTotals({
    quotationDiscountType: "FIXED_AMOUNT",
    quotationDiscountValue: 300,
    items: [
      {
        ...baseItem,
        quantity: 2,
        unitPrice: 1000
      }
    ]
  });

  assert.equal(totals.itemDiscountTotal, 0);
  assert.equal(totals.quotationDiscountAmount, 300);
  assert.equal(totals.totalAmount, 1700);
});

test("calculateQuotationTotals rejects discounts larger than subtotal", () => {
  assert.throws(
    () =>
      calculateQuotationTotals({
        quotationDiscountType: "FIXED_AMOUNT",
        quotationDiscountValue: 2000,
        items: [baseItem]
      }),
    /Quotation discount exceeds/
  );

  assert.throws(
    () =>
      calculateQuotationItem({
        ...baseItem,
        discountType: "FIXED_AMOUNT",
        discountValue: 2000
      }),
    /Discount exceeds subtotal/
  );
});

test("calculateQuotationTotals rounds currency values to cents", () => {
  const totals = calculateQuotationTotals({
    quotationDiscountType: "PERCENTAGE",
    quotationDiscountValue: 12.5,
    items: [
      {
        ...baseItem,
        quantity: 1,
        unitPrice: 100.555
      }
    ]
  });

  assert.equal(totals.subtotalAmount, 100.56);
  assert.equal(totals.quotationDiscountAmount, 12.57);
  assert.equal(totals.totalAmount, 87.99);
});
