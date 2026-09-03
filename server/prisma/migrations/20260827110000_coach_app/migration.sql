CREATE TABLE IF NOT EXISTS "CoachApplication" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "linkedin" TEXT,
  "message" TEXT,
  "userId" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT '',
  "emailed" BOOLEAN NOT NULL DEFAULT false
);
