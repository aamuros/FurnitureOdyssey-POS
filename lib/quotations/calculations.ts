import type { CreateQuotationInput, QuotationItemInput } from "@/lib/validation/quotations";

export const ASSEMBLY_FEE_PER_QUANTITY = 100;
export const SALES_INVOICE_FEE_RATE = 0.08;
export const SALES_INVOICE_FEE_PERCENTAGE = 8;

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

export function calculateAssemblyFeeTotal({
  items,
  needsAssembly,
  assemblyFeeRate = ASSEMBLY_FEE_PER_QUANTITY
}: Pick<CreateQuotationInput, "items" | "needsAssembly"> &
  Partial<Pick<CreateQuotationInput, "assemblyFeeRate">>) {
  if (!needsAssembly) {
    return 0;
  }

  return roundMoney(
    items.reduce(
      (sum, item) =>
        item.requiresAssembly ? sum + item.quantity * assemblyFeeRate : sum,
      0
    )
  );
}

export function calculateQuotationTotals(
  input: Pick<
    CreateQuotationInput,
    | "items"
    | "quotationDiscountType"
    | "quotationDiscountValue"
    | "needsAssembly"
    | "salesInvoiceRequested"
  > &
    Partial<
      Pick<
        CreateQuotationInput,
        "assemblyFeeRate" | "salesInvoiceFeePercentage" | "additionalFees"
      >
    >
) {
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

  const assemblyFeeTotal = calculateAssemblyFeeTotal(input);
  const additionalFees = roundMoney(input.additionalFees ?? 0);
  const finalSubtotal = roundMoney(
    postItemDiscountTotal + assemblyFeeTotal + additionalFees - quotationDiscountAmount
  );

  if (finalSubtotal < 0) {
    throw new Error("Quotation discount exceeds subtotal plus fees.");
  }

  const salesInvoiceFeeRate =
    (input.salesInvoiceFeePercentage ?? SALES_INVOICE_FEE_PERCENTAGE) / 100;
  const salesInvoiceFeeTotal = input.salesInvoiceRequested
    ? roundMoney(finalSubtotal * salesInvoiceFeeRate)
    : 0;
  const totalAdditionalFees = roundMoney(assemblyFeeTotal + salesInvoiceFeeTotal + additionalFees);
  const totalAmount = roundMoney(finalSubtotal + salesInvoiceFeeTotal);
  const totalCostAmount = roundMoney(
    calculatedItems.reduce((sum, item) => sum + item.lineCostTotal, 0)
  );

  return {
    items: calculatedItems,
    subtotalAmount,
    itemDiscountTotal,
    quotationDiscountAmount,
    assemblyFeeTotal,
    salesInvoiceFeeTotal,
    additionalFees,
    finalSubtotal,
    totalAdditionalFees,
    totalAmount,
    totalCostAmount,
    grossProfitAmount: roundMoney(subtotalAmount - totalCostAmount)
  };
}
