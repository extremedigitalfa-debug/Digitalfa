CREATE TABLE IF NOT EXISTS "CommLog" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "commKey" TEXT NOT NULL,
  "ref" TEXT,
  "sentAt" TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS "CommLog_userId_commKey_idx" ON "CommLog" ("userId","commKey");
