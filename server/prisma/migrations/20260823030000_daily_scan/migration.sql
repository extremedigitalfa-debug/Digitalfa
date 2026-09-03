-- Track the daily profile-driven scan.
ALTER TABLE "Setting" ADD COLUMN "lastDailyScanDate" TEXT;
ALTER TABLE "Setting" ADD COLUMN "lastDailyScanInfo" TEXT;
