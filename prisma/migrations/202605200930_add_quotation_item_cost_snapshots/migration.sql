-- Add cost and profit snapshots to quotation items so accepted quotations
-- convert to orders using the negotiated quotation costs.
ALTER TABLE "QuotationItem"
ADD COLUMN "unitCostSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "lineCostTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "lineProfit" DECIMAL(12,2) NOT NULL DEFAULT 0;
