import { prisma } from "@/lib/prisma";

export type RegisteredConcertSummary = {
  id: string;
  title: string;
  artist: string;
  venueName: string;
  region: string;
  startDate: Date;
  endDate: Date;
  posterImageUrl: string | null;
  reviewCount: number;
  scheduleCount: number;
  latestSeatMap: {
    id: string;
    imageUrl: string;
    analysisStatus: "pending" | "success" | "failed";
    createdAt: Date;
    zoneCount: number;
  };
};

export async function getRegisteredConcertsForUser(userId: string) {
  const seatMaps = await prisma.seatMap.findMany({
    where: {
      createdBy: userId,
      concert: {
        isVisible: true,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    select: {
      id: true,
      imageUrl: true,
      analysisStatus: true,
      createdAt: true,
      _count: {
        select: {
          zones: true,
        },
      },
      concert: {
        select: {
          id: true,
          title: true,
          artist: true,
          venueName: true,
          region: true,
          startDate: true,
          endDate: true,
          posterImageUrl: true,
          _count: {
            select: {
              reviews: true,
              schedules: true,
            },
          },
        },
      },
    },
  });
  const concertsById = new Map<string, RegisteredConcertSummary>();

  for (const seatMap of seatMaps) {
    if (concertsById.has(seatMap.concert.id)) {
      continue;
    }

    concertsById.set(seatMap.concert.id, {
      id: seatMap.concert.id,
      title: seatMap.concert.title,
      artist: seatMap.concert.artist,
      venueName: seatMap.concert.venueName,
      region: seatMap.concert.region,
      startDate: seatMap.concert.startDate,
      endDate: seatMap.concert.endDate,
      posterImageUrl: seatMap.concert.posterImageUrl,
      reviewCount: seatMap.concert._count.reviews,
      scheduleCount: seatMap.concert._count.schedules,
      latestSeatMap: {
        id: seatMap.id,
        imageUrl: seatMap.imageUrl,
        analysisStatus: seatMap.analysisStatus,
        createdAt: seatMap.createdAt,
        zoneCount: seatMap._count.zones,
      },
    });
  }

  return Array.from(concertsById.values());
}

export async function getRegisteredConcertSummaryForUser(
  userId: string,
  concertId: string,
) {
  const seatMap = await prisma.seatMap.findFirst({
    where: {
      concertId,
      createdBy: userId,
      concert: {
        isVisible: true,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      imageUrl: true,
      analysisStatus: true,
      createdAt: true,
      _count: {
        select: {
          zones: true,
        },
      },
      concert: {
        select: {
          id: true,
          title: true,
          artist: true,
          venueName: true,
          region: true,
          startDate: true,
          endDate: true,
          posterImageUrl: true,
          _count: {
            select: {
              reviews: true,
              schedules: true,
            },
          },
        },
      },
    },
  });

  if (!seatMap) {
    return null;
  }

  return {
    id: seatMap.concert.id,
    title: seatMap.concert.title,
    artist: seatMap.concert.artist,
    venueName: seatMap.concert.venueName,
    region: seatMap.concert.region,
    startDate: seatMap.concert.startDate,
    endDate: seatMap.concert.endDate,
    posterImageUrl: seatMap.concert.posterImageUrl,
    reviewCount: seatMap.concert._count.reviews,
    scheduleCount: seatMap.concert._count.schedules,
    latestSeatMap: {
      id: seatMap.id,
      imageUrl: seatMap.imageUrl,
      analysisStatus: seatMap.analysisStatus,
      createdAt: seatMap.createdAt,
      zoneCount: seatMap._count.zones,
    },
  } satisfies RegisteredConcertSummary;
}

export async function getRegisteredPracticeConcert(
  userId: string,
  concertId: string,
) {
  return prisma.concert.findFirst({
    where: {
      id: concertId,
      isVisible: true,
      seatMaps: {
        some: {
          createdBy: userId,
        },
      },
    },
    select: {
      id: true,
      title: true,
      artist: true,
      venueName: true,
      region: true,
      priceMin: true,
      priceMax: true,
      schedules: {
        orderBy: [
          {
            performanceDate: "asc",
          },
          {
            startTime: "asc",
          },
        ],
        select: {
          id: true,
          performanceDate: true,
          roundName: true,
          startTime: true,
        },
      },
      seatMaps: {
        where: {
          createdBy: userId,
          analysisStatus: "success",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          id: true,
          imageUrl: true,
          imageWidth: true,
          imageHeight: true,
          zones: {
            orderBy: {
              createdAt: "asc",
            },
            select: {
              id: true,
              name: true,
              grade: true,
              price: true,
              bbox: true,
              polygon: true,
              allocatedSeatCount: true,
              virtualSeatConfig: true,
              _count: {
                select: {
                  virtualSeats: true,
                },
              },
              virtualSeats: {
                take: 1,
                select: {
                  x: true,
                  y: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function getRegisteredReviewConcert(
  userId: string,
  concertId: string,
) {
  return prisma.concert.findFirst({
    where: {
      id: concertId,
      isVisible: true,
      seatMaps: {
        some: {
          createdBy: userId,
        },
      },
    },
    select: {
      id: true,
      title: true,
      artist: true,
      venueName: true,
      region: true,
      seatMaps: {
        where: {
          createdBy: userId,
          analysisStatus: "success",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          id: true,
          imageUrl: true,
          zones: {
            orderBy: {
              createdAt: "asc",
            },
            select: {
              id: true,
              name: true,
              grade: true,
              price: true,
              bbox: true,
              polygon: true,
            },
          },
        },
      },
    },
  });
}
