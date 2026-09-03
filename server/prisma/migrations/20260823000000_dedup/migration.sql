-- Cross-source duplicate detection: content fingerprint on Job.
ALTER TABLE "Job" ADD COLUMN "dedupKey" TEXT;
CREATE INDEX "Job_dedupKey_idx" ON "Job"("dedupKey");
