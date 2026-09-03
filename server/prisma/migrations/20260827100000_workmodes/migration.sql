-- Modalità di lavoro preferite (remoto/ibrido/onsite), separate dal luogo
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workModes" TEXT[] DEFAULT ARRAY[]::TEXT[];
