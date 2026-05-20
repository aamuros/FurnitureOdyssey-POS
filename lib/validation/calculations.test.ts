import assert from "node:assert/strict";
import test from "node:test";
import { createManualOrderSchema } from "@/lib/validation/orders";
import { createQuotationSchema } from "@/lib/validation/quotations";

const customerId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";

const validQuotationItem = {
  itemType: "CUSTOM_ITEM" as const,
  itemName: "Custom sofa",
  quantity: "2",
  unitPrice: "1500",
  images: []
};

const validOrderItem = {
  itemType: "CUSTOM_ITEM" as const,
  itemName: "Custom sofa",
  quantity: "2",
  unitPrice: "1500",
  unitCostSnapshot: "700",
  images: []
};

test("createQuotationSchema accepts valid form data and normalizes optional text and booleans", () => {
  const parsed = createQuotationSchema.parse({
    customerId,
    paymentTerms: "  Due on delivery  ",
    specialInstructions: "   ",
    needsAssembly: "on",
    salesInvoiceRequested: "false",
    items: [validQuotationItem]
  });

  assert.equal(parsed.paymentTerms, "Due on delivery");
  assert.equal(parsed.specialInstructions, undefined);
  assert.equal(parsed.needsAssembly, true);
  assert.equal(parsed.salesInvoiceRequested, false);
  assert.equal(parsed.items[0].quantity, 2);
  assert.equal(parsed.items[0].unitPrice, 1500);
});

test("createQuotationSchema rejects missing customer, catalog product, invalid quantity, price, and discount", () => {
  assert.equal(
    createQuotationSchema.safeParse({
      items: [validQuotationItem]
    }).success,
    false
  );

  assert.equal(
    createQuotationSchema.safeParse({
      customerId,
      items: [{ ...validQuotationItem, itemType: "CATALOG_PRODUCT" }]
    }).success,
    false
  );

  assert.equal(
    createQuotationSchema.safeParse({
      customerId,
      quotationDiscountType: "PERCENTAGE",
      quotationDiscountValue: "101",
      items: [{ ...validQuotationItem, quantity: "0", unitPrice: "-1" }]
    }).success,
    false
  );

  assert.equal(
    createQuotationSchema.safeParse({
      customerId,
      items: [{ ...validQuotationItem, quantity: "1.5" }]
    }).success,
    false
  );
});

test("createQuotationSchema enforces payment terms and special instructions max lengths", () => {
  const tooLong = "x".repeat(1001);

  assert.equal(
    createQuotationSchema.safeParse({
      customerId,
      paymentTerms: tooLong,
      specialInstructions: tooLong,
      items: [validQuotationItem]
    }).success,
    false
  );
});

test("createManualOrderSchema accepts valid catalog and custom order data", () => {
  const parsed = createManualOrderSchema.parse({
    customerId,
    orderDiscountType: "FIXED_AMOUNT",
    orderDiscountValue: "100",
    needsAssembly: "yes",
    salesInvoiceRequested: "1",
    modeOfDelivery: " Delivery ",
    deliveryMethod: " Truck ",
    items: [
      validOrderItem,
      {
        ...validOrderItem,
        itemType: "CATALOG_PRODUCT",
        productId,
        itemName: "Catalog chair"
      }
    ]
  });

  assert.equal(parsed.needsAssembly, true);
  assert.equal(parsed.salesInvoiceRequested, true);
  assert.equal(parsed.modeOfDelivery, "Delivery");
  assert.equal(parsed.deliveryMethod, "Truck");
  assert.equal(parsed.items[1].productId, productId);
});

test("createManualOrderSchema rejects invalid quantity, price, discount, and missing item name", () => {
  const parsed = createManualOrderSchema.safeParse({
    customerId,
    orderDiscountType: "PERCENTAGE",
    orderDiscountValue: "101",
    items: [
      {
        ...validOrderItem,
        itemName: "",
        quantity: "-1",
        unitPrice: "-1",
        discountType: "PERCENTAGE",
        discountValue: "101"
      }
    ]
  });

  assert.equal(parsed.success, false);
});
