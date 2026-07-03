-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('pending', 'success', 'failed');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('available', 'sold', 'disabled');

-- CreateEnum
CREATE TYPE "TicketTemplateType" AS ENUM ('interpark', 'melon', 'yes24', 'basic');

-- CreateEnum
CREATE TYPE "PracticeDifficulty" AS ENUM ('easy', 'normal', 'hard');

-- CreateEnum
CREATE TYPE "PracticeStatus" AS ENUM ('started', 'success', 'failed');

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "nickname" TEXT,
    "profileImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Concert" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "venueName" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "priceMin" INTEGER NOT NULL,
    "priceMax" INTEGER NOT NULL,
    "posterImageUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Concert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcertSchedule" (
    "id" UUID NOT NULL,
    "concertId" UUID NOT NULL,
    "performanceDate" TIMESTAMP(3) NOT NULL,
    "roundName" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,

    CONSTRAINT "ConcertSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatMap" (
    "id" UUID NOT NULL,
    "concertId" UUID NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'pending',
    "aiRawResult" JSONB,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatZone" (
    "id" UUID NOT NULL,
    "seatMapId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "price" INTEGER,
    "polygon" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "virtualSeatConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualSeat" (
    "id" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "rowLabel" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "status" "SeatStatus" NOT NULL DEFAULT 'available',
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,

    CONSTRAINT "VirtualSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "concertId" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "viewScore" INTEGER NOT NULL,
    "soundScore" INTEGER NOT NULL,
    "distanceScore" INTEGER NOT NULL,
    "satisfactionScore" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSession" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "concertId" UUID NOT NULL,
    "scheduleId" UUID,
    "templateType" "TicketTemplateType" NOT NULL,
    "difficulty" "PracticeDifficulty" NOT NULL DEFAULT 'normal',
    "status" "PracticeStatus" NOT NULL DEFAULT 'started',
    "selectedZoneId" UUID,
    "selectedSeatId" UUID,
    "elapsedMs" INTEGER NOT NULL DEFAULT 0,
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PracticeSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConcertSchedule_concertId_idx" ON "ConcertSchedule"("concertId");

-- CreateIndex
CREATE INDEX "SeatMap_concertId_idx" ON "SeatMap"("concertId");

-- CreateIndex
CREATE INDEX "SeatMap_createdBy_idx" ON "SeatMap"("createdBy");

-- CreateIndex
CREATE INDEX "SeatZone_seatMapId_idx" ON "SeatZone"("seatMapId");

-- CreateIndex
CREATE INDEX "VirtualSeat_zoneId_idx" ON "VirtualSeat"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualSeat_zoneId_rowLabel_seatNumber_key" ON "VirtualSeat"("zoneId", "rowLabel", "seatNumber");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "Review_concertId_idx" ON "Review"("concertId");

-- CreateIndex
CREATE INDEX "Review_zoneId_idx" ON "Review"("zoneId");

-- CreateIndex
CREATE INDEX "PracticeSession_userId_idx" ON "PracticeSession"("userId");

-- CreateIndex
CREATE INDEX "PracticeSession_concertId_idx" ON "PracticeSession"("concertId");

-- CreateIndex
CREATE INDEX "PracticeSession_selectedZoneId_idx" ON "PracticeSession"("selectedZoneId");

-- AddForeignKey
ALTER TABLE "ConcertSchedule" ADD CONSTRAINT "ConcertSchedule_concertId_fkey" FOREIGN KEY ("concertId") REFERENCES "Concert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatMap" ADD CONSTRAINT "SeatMap_concertId_fkey" FOREIGN KEY ("concertId") REFERENCES "Concert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatMap" ADD CONSTRAINT "SeatMap_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatZone" ADD CONSTRAINT "SeatZone_seatMapId_fkey" FOREIGN KEY ("seatMapId") REFERENCES "SeatMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualSeat" ADD CONSTRAINT "VirtualSeat_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "SeatZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_concertId_fkey" FOREIGN KEY ("concertId") REFERENCES "Concert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "SeatZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_concertId_fkey" FOREIGN KEY ("concertId") REFERENCES "Concert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ConcertSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_selectedZoneId_fkey" FOREIGN KEY ("selectedZoneId") REFERENCES "SeatZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_selectedSeatId_fkey" FOREIGN KEY ("selectedSeatId") REFERENCES "VirtualSeat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
