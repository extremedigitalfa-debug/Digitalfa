ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'User_referralCode_key') THEN
    CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS "Referral" (
  "id" TEXT PRIMARY KEY,
  "referrerId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "email" TEXT,
  "referredUserId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'invited',
  "invitedAt" TEXT NOT NULL DEFAULT '',
  "rewardedAt" TEXT
);
