CREATE TABLE IF NOT EXISTS "AnswerBank" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL DEFAULT '',
  "createdAt" TEXT NOT NULL DEFAULT '',
  "updatedAt" TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS "AnswerBank_userId_idx" ON "AnswerBank" ("userId");
