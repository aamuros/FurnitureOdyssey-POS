import type { CreateQuotationInput, QuotationItemInput } from "@/lib/validation/quotations";

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function discountAmount(
  subtotal: number,
  discountType?: "FIXED_AMOUNT" | "PERCENTAGE",
  discountValue = 0
) {
  if (!discountType || discountValue <= 0) {
    return 0;
  }

  if (discountType === "PERCENTAGE") {
    return roundMoney(subtotal * (discountValue / 100));
  }

  return roundMoney(discountValue);
}

export function calculateQuotationItem(item: QuotationItemInput) {
  const lineSubtotal = roundMoney(item.quantity * item.unitPrice);
  const itemDiscountAmount = discountAmount(lineSubtotal, item.discountType, item.discountValue);
  const unitCostSnapshot = roundMoney(item.unitCostSnapshot ?? item.unitCost ?? 0);
  const lineCostTotal = roundMoney(item.quantity * unitCostSnapshot);

  if (itemDiscountAmount > lineSubtotal) {
    throw new Error(`Discount exceeds subtotal for ${item.itemName}.`);
  }

  const lineTotal = roundMoney(Math.max(lineSubtotal - itemDiscountAmount, 0));

  return {
    lineSubtotal,
    discountAmount: itemDiscountAmount,
    lineTotal,
    unitCostSnapshot,
    lineCostTotal,
    lineProfit: roundMoney(lineTotal - lineCostTotal)
  };
}

export function calculateQuotationTotals(input: Pick<CreateQuotationInput, "items" | "quotationDiscountType" | "quotationDiscountValue">) {
  const calculatedItems = input.items.map((item) => calculateQuotationItem(item));
  const subtotalAmount = roundMoney(
    calculatedItems.reduce((sum, item) => sum + item.lineSubtotal, 0)
  );
  const itemDiscountTotal = roundMoney(
    calculatedItems.reduce((sum, item) => sum + item.discountAmount, 0)
  );
  const postItemDiscountTotal = roundMoney(
    calculatedItems.reduce((sum, item) => sum + item.lineTotal, 0)
  );
  const quotationDiscountAmount = discountAmount(
    postItemDiscountTotal,
    input.quotationDiscountType,
    input.quotationDiscountValue
  );

  if (quotationDiscountAmount > postItemDiscountTotal) {
    throw new Error("Quotation discount exceeds the post-item-discount total.");
  }

  const totalAmount = roundMoney(Math.max(postItemDiscountTotal - quotationDiscountAmount, 0));
  const totalCostAmount = roundMoney(
    calculatedItems.reduce((sum, item) => sum + item.lineCostTotal, 0)
  );

  return {
    items: calculatedItems,
    subtotalAmount,
    itemDiscountTotal,
    quotationDiscountAmount,
    totalAmount,
    totalCostAmount,
    grossProfitAmount: roundMoney(totalAmount - totalCostAmount)
  };
}
