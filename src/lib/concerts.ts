import { prisma } from "@/lib/prisma";

export async function getConcertList() {
  const concerts = await prisma.concert.findMany({
    include: {
      _count: {
        select: {
          seatMaps: true,
          reviews: true,
        },
      },
      seatMaps: {
        select: {
          id: true,
          analysisStatus: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
    orderBy: [
      {
        startDate: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });

  return concerts.map((concert) => {
    const latestSeatMap = concert.seatMaps[0] ?? null;

    return {
      id: concert.id,
      title: concert.title,
      artist: concert.artist,
      venueName: concert.venueName,
      region: concert.region,
      startDate: concert.startDate,
      endDate: concert.endDate,
      priceMin: concert.priceMin,
      priceMax: concert.priceMax,
      posterImageUrl: concert.posterImageUrl,
      description: concert.description,
      hasSeatMap: concert._count.seatMaps > 0,
      seatMapCount: concert._count.seatMaps,
      reviewCount: concert._count.reviews,
      latestSeatMapId: latestSeatMap?.id ?? null,
      latestSeatMapStatus: latestSeatMap?.analysisStatus ?? null,
    };
  });
}

export async function getConcertDetail(concertId: string) {
  const concert = await prisma.concert.findUnique({
    where: {
      id: concertId,
    },
    include: {
      schedules: {
        orderBy: [
          {
            performanceDate: "asc",
          },
          {
            startTime: "asc",
          },
        ],
      },
      seatMaps: {
        include: {
          _count: {
            select: {
              zones: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
      _count: {
        select: {
          seatMaps: true,
          reviews: true,
          practiceSessions: true,
        },
      },
    },
  });

  if (!concert) {
    return null;
  }

  const latestSeatMap = concert.seatMaps[0] ?? null;

  return {
    id: concert.id,
    title: concert.title,
    artist: concert.artist,
    venueName: concert.venueName,
    region: concert.region,
    startDate: concert.startDate,
    endDate: concert.endDate,
    priceMin: concert.priceMin,
    priceMax: concert.priceMax,
    posterImageUrl: concert.posterImageUrl,
    description: concert.description,
    createdAt: concert.createdAt,
    schedules: concert.schedules,
    hasSeatMap: concert._count.seatMaps > 0,
    seatMapCount: concert._count.seatMaps,
    reviewCount: concert._count.reviews,
    practiceSessionCount: concert._count.practiceSessions,
    latestSeatMap: latestSeatMap
      ? {
          id: latestSeatMap.id,
          imageUrl: latestSeatMap.imageUrl,
          imageWidth: latestSeatMap.imageWidth,
          imageHeight: latestSeatMap.imageHeight,
          analysisStatus: latestSeatMap.analysisStatus,
          zoneCount: latestSeatMap._count.zones,
          createdAt: latestSeatMap.createdAt,
        }
      : null,
  };
}

