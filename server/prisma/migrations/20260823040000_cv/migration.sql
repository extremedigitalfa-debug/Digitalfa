-- CV upload + extracted personal data on the candidate profile.
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "summary" TEXT;
ALTER TABLE "User" ADD COLUMN "cvFileName" TEXT;
ALTER TABLE "User" ADD COLUMN "cvText" TEXT;
ALTER TABLE "User" ADD COLUMN "cvUploadedAt" TEXT;
