-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "desiredTitles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "experienceLevel" TEXT,
ADD COLUMN     "jobTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "minSalary" INTEGER,
ADD COLUMN     "onboarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferredLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[];

