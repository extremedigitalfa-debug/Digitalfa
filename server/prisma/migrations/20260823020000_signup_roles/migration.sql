-- Free self-service signup + admin-granted permissions.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
