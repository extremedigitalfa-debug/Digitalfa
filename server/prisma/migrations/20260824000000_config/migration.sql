-- Admin-editable configuration (SMTP, LLM, cron, scan schedule, templates).
ALTER TABLE "Setting" ADD COLUMN "config" JSONB;
