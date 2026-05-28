-- Add display-only Delivery Receipt PDF detail rows.
ALTER TABLE "Delivery" ADD COLUMN "pdfDetails" JSONB;
