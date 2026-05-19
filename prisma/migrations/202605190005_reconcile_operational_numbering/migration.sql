ALTER TABLE "Quotation"
ADD COLUMN IF NOT EXISTS "quotationNumber" TEXT;

ALTER TABLE "Payment"
ADD COLUMN IF NOT EXISTS "paymentNumber" TEXT;

ALTER TABLE "Delivery"
ADD COLUMN IF NOT EXISTS "deliveryNumber" TEXT;

ALTER TABLE "OrderDocument"
ADD COLUMN IF NOT EXISTS "documentNumber" TEXT;

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'FINAL_ORDER_SUMMARY';

CREATE TABLE IF NOT EXISTS "DocumentCounter" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "nextValue" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Quotation_quotationNumber_key" ON "Quotation"("quotationNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_paymentNumber_key" ON "Payment"("paymentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Delivery_deliveryNumber_key" ON "Delivery"("deliveryNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "OrderDocument_documentNumber_key" ON "OrderDocument"("documentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentCounter_type_year_key" ON "DocumentCounter"("type", "year");
