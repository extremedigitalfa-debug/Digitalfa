-- Consente log di scansione non legati a una Source (es. il motore candidati) + etichetta
ALTER TABLE "ScanLog" ALTER COLUMN "sourceId" DROP NOT NULL;
ALTER TABLE "ScanLog" ADD COLUMN IF NOT EXISTS "label" TEXT;
