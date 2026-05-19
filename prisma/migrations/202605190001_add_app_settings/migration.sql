-- Add simple key/value application settings for admin-managed business defaults.
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SETTINGS_UPDATED';

CREATE TABLE "AppSetting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");
CREATE INDEX "AppSetting_key_idx" ON "AppSetting"("key");
CREATE INDEX "AppSetting_updatedById_idx" ON "AppSetting"("updatedById");

ALTER TABLE "AppSetting"
ADD CONSTRAINT "AppSetting_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "UserProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
