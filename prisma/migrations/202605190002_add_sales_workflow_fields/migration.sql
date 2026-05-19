ALTER TABLE "Quotation"
ADD COLUMN "needsAssembly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "salesInvoiceRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "modeOfDelivery" TEXT,
ADD COLUMN "deliveryMethod" TEXT,
ADD COLUMN "paymentTerms" TEXT,
ADD COLUMN "specialInstructions" TEXT;

ALTER TABLE "Order"
ADD COLUMN "needsAssembly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "salesInvoiceRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "modeOfDelivery" TEXT,
ADD COLUMN "deliveryMethod" TEXT,
ADD COLUMN "paymentTerms" TEXT,
ADD COLUMN "specialInstructions" TEXT;
