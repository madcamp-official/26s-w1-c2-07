CREATE INDEX "SeatMap_createdBy_createdAt_idx"
ON "SeatMap"("createdBy", "createdAt");

CREATE INDEX "SeatMap_concertId_createdBy_analysisStatus_createdAt_idx"
ON "SeatMap"("concertId", "createdBy", "analysisStatus", "createdAt");

CREATE INDEX "SeatZone_seatMapId_createdAt_idx"
ON "SeatZone"("seatMapId", "createdAt");

CREATE INDEX "ConcertSchedule_concertId_performanceDate_startTime_idx"
ON "ConcertSchedule"("concertId", "performanceDate", "startTime");
