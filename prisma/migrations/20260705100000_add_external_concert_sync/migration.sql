ALTER TABLE "Concert"
ADD COLUMN "genre" TEXT,
ADD COLUMN "bookingUrl" TEXT,
ADD COLUMN "ticketOpenAt" TIMESTAMP(3),
ADD COLUMN "externalSource" TEXT,
ADD COLUMN "externalId" TEXT,
ADD COLUMN "syncedAt" TIMESTAMP(3),
ADD COLUMN "rawExternalData" JSONB,
ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "Concert_externalSource_externalId_key"
ON "Concert"("externalSource", "externalId");

CREATE INDEX "Concert_startDate_idx"
ON "Concert"("startDate");

CREATE INDEX "Concert_externalSource_syncedAt_idx"
ON "Concert"("externalSource", "syncedAt");
