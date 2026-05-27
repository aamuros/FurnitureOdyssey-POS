-- CreateEnum
CREATE TYPE "CalendarTargetType" AS ENUM ('STAFF_CREATOR', 'OWNER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CalendarSyncStatus" ADD VALUE 'SKIPPED';
ALTER TYPE "CalendarSyncStatus" ADD VALUE 'DELETED';

-- CreateTable
CREATE TABLE "DeliveryCalendarEvent" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "googleCalendarConnectionId" UUID,
    "googleCalendarId" TEXT,
    "googleCalendarEventId" TEXT,
    "targetType" "CalendarTargetType" NOT NULL,
    "syncStatus" "CalendarSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
    "syncError" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryCalendarEvent_deliveryId_idx" ON "DeliveryCalendarEvent"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryCalendarEvent_userId_idx" ON "DeliveryCalendarEvent"("userId");

-- CreateIndex
CREATE INDEX "DeliveryCalendarEvent_syncStatus_idx" ON "DeliveryCalendarEvent"("syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryCalendarEvent_deliveryId_userId_targetType_key" ON "DeliveryCalendarEvent"("deliveryId", "userId", "targetType");

-- AddForeignKey
ALTER TABLE "DeliveryCalendarEvent" ADD CONSTRAINT "DeliveryCalendarEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCalendarEvent" ADD CONSTRAINT "DeliveryCalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
