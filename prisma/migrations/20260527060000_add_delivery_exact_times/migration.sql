-- Add exact manual delivery times while keeping the existing text time window for display/backward compatibility.
ALTER TABLE "Delivery" ADD COLUMN "scheduledStartAt" TIMESTAMP(3);
ALTER TABLE "Delivery" ADD COLUMN "scheduledEndAt" TIMESTAMP(3);
ALTER TABLE "Delivery" ADD COLUMN "scheduledStartTime" TEXT;
ALTER TABLE "Delivery" ADD COLUMN "scheduledEndTime" TEXT;
