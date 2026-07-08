CREATE INDEX "Concert_isVisible_isSample_endDate_startDate_idx"
ON "Concert"("isVisible", "isSample", "endDate", "startDate");

CREATE INDEX "Concert_isVisible_isSample_createdAt_startDate_idx"
ON "Concert"("isVisible", "isSample", "createdAt", "startDate");

CREATE INDEX "Review_userId_createdAt_idx"
ON "Review"("userId", "createdAt");

CREATE INDEX "Review_concertId_createdAt_idx"
ON "Review"("concertId", "createdAt");

CREATE INDEX "PracticeSession_userId_createdAt_idx"
ON "PracticeSession"("userId", "createdAt");
