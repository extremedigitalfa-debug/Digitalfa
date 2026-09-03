-- CreateTable
CREATE TABLE "MatchPref" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    "updatedAt" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MatchPref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MatchFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchPref_userId_key" ON "MatchPref"("userId");

