-- Admin: block a user until a given time.
ALTER TABLE "User" ADD COLUMN "blockedUntil" TEXT;
