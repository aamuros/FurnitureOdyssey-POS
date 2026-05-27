-- CreateEnum
CREATE TYPE "CalendarSyncStatus" AS ENUM ('NOT_SYNCED', 'SYNCED', 'FAILED', 'DISABLED');

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "calendarSyncError" TEXT,
ADD COLUMN     "calendarSyncStatus" "CalendarSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
ADD COLUMN     "calendarSyncedAt" TIMESTAMP(3),
ADD COLUMN     "calendarSyncedUserId" UUID,
ADD COLUMN     "googleCalendarEventId" TEXT,
ADD COLUMN     "googleCalendarId" TEXT;

-- CreateTable
CREATE TABLE "UserCalendarConnection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "googleAccountEmail" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "accessToken" TEXT,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "UserCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCalendarConnection_userId_key" ON "UserCalendarConnection"("userId");

-- CreateIndex
CREATE INDEX "Delivery_googleCalendarEventId_idx" ON "Delivery"("googleCalendarEventId");

-- CreateIndex
CREATE INDEX "Delivery_calendarSyncedUserId_idx" ON "Delivery"("calendarSyncedUserId");

-- CreateIndex
CREATE INDEX "Delivery_calendarSyncStatus_idx" ON "Delivery"("calendarSyncStatus");

-- AddForeignKey
ALTER TABLE "UserCalendarConnection" ADD CONSTRAINT "UserCalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
