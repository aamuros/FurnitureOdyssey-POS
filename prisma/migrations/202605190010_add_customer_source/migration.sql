ALTER TABLE "Customer" ADD COLUMN "source" "InquirySource";

CREATE INDEX "Customer_source_idx" ON "Customer"("source");
