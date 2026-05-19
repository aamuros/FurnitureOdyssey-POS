ALTER TABLE "Quotation"
ADD COLUMN "quotationNumber" TEXT;

ALTER TABLE "Payment"
ADD COLUMN "paymentNumber_tmp" TEXT;

UPDATE "Payment"
SET "paymentNumber_tmp" = "paymentNumber";

ALTER TABLE "Payment"
DROP COLUMN "paymentNumber";

ALTER TABLE "Payment"
RENAME COLUMN "paymentNumber_tmp" TO "paymentNumber";

ALTER TABLE "Delivery"
ADD COLUMN "deliveryNumber" TEXT;

ALTER TABLE "OrderDocument"
ADD COLUMN "documentNumber" TEXT;

ALTER TYPE "DocumentType" ADD VALUE 'FINAL_ORDER_SUMMARY';

CREATE TABLE "DocumentCounter" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "nextValue" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Quotation_quotationNumber_key" ON "Quotation"("quotationNumber");
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");
CREATE UNIQUE INDEX "Delivery_deliveryNumber_key" ON "Delivery"("deliveryNumber");
CREATE UNIQUE INDEX "OrderDocument_documentNumber_key" ON "OrderDocument"("documentNumber");
CREATE UNIQUE INDEX "DocumentCounter_type_year_key" ON "DocumentCounter"("type", "year");
