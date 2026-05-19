ALTER TABLE "OrderItem"
ADD COLUMN "unitCostSnapshot" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "lineCostTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "lineProfit" DECIMAL(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE "Order"
ADD COLUMN "totalCostAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "grossProfitAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0;

CREATE INDEX "Order_totalCostAmount_idx" ON "Order"("totalCostAmount");
CREATE INDEX "Order_grossProfitAmount_idx" ON "Order"("grossProfitAmount");
