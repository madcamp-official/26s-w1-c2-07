import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ConcertListScope = "upcoming" | "latest" | "samples" | "all";

type ConcertListOptions = {
  scope?: ConcertListScope;
  q?: string;
  region?: string;
  genre?: string;
};

function getTodayKstStart() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(`${year}-${month}-${day}T00:00:00+09:00`);
}

function getConcertListOrderBy(scope: ConcertListScope) {
  if (scope === "latest") {
    return [
      {
        createdAt: "desc" as const,
      },
      {
        startDate: "asc" as const,
      },
    ];
  }

  return [
    {
      startDate: "asc" as const,
    },
    {
      createdAt: "desc" as const,
    },
  ];
}

function normalizeFilterValue(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function containsInsensitive(value: string) {
  return {
    contains: value,
    mode: Prisma.QueryMode.insensitive,
  };
}

function getConcertWhere(options: ConcertListOptions = {}) {
  const scope = options.scope ?? "upcoming";
  const q = normalizeFilterValue(options.q);
  const region = normalizeFilterValue(options.region);
  const genre = normalizeFilterValue(options.genre);
  const and: Prisma.ConcertWhereInput[] = [
    {
      isVisible: true,
    },
  ];

  if (scope === "upcoming" || scope === "latest") {
    and.push({
      isSample: false,
    });
  }

  if (scope === "samples") {
    and.push({
      isSample: true,
    });
  }

  if (scope === "upcoming") {
    and.push({
      endDate: {
        gte: getTodayKstStart(),
      },
    });
  }

  if (q) {
    and.push({
      OR: [
        {
          title: containsInsensitive(q),
        },
        {
          artist: containsInsensitive(q),
        },
        {
          venueName: containsInsensitive(q),
        },
        {
          region: containsInsensitive(q),
        },
        {
          genre: containsInsensitive(q),
        },
      ],
    });
  }

  if (region) {
    and.push({
      region: containsInsensitive(region),
    });
  }

  if (genre) {
    and.push({
      genre: containsInsensitive(genre),
    });
  }

  return {
    AND: and,
  } satisfies Prisma.ConcertWhereInput;
}

export async function getConcertList(options: ConcertListOptions = {}) {
  const scope = options.scope ?? "upcoming";
  const concerts = await prisma.concert.findMany({
    where: getConcertWhere(options),
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
    orderBy: getConcertListOrderBy(scope),
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
      genre: concert.genre,
      bookingUrl: concert.bookingUrl,
      externalSource: concert.externalSource,
      syncedAt: concert.syncedAt,
      isSample: concert.isSample,
      hasSeatMap: concert._count.seatMaps > 0,
      seatMapCount: concert._count.seatMaps,
      reviewCount: concert._count.reviews,
      latestSeatMapId: latestSeatMap?.id ?? null,
      latestSeatMapStatus: latestSeatMap?.analysisStatus ?? null,
    };
  });
}

export async function getConcertFilterOptions(options: ConcertListOptions = {}) {
  const scopeWhere = getConcertWhere({
    scope: options.scope,
  });
  const [regionRows, genreRows] = await Promise.all([
    prisma.concert.findMany({
      where: scopeWhere,
      distinct: ["region"],
      select: {
        region: true,
      },
      orderBy: {
        region: "asc",
      },
    }),
    prisma.concert.findMany({
      where: {
        AND: [
          scopeWhere,
          {
            genre: {
              not: null,
            },
          },
        ],
      },
      distinct: ["genre"],
      select: {
        genre: true,
      },
      orderBy: {
        genre: "asc",
      },
    }),
  ]);

  return {
    regions: regionRows.map((row) => row.region).filter(Boolean),
    genres: genreRows
      .map((row) => row.genre)
      .filter((genre): genre is string => Boolean(genre)),
  };
}

export async function getConcertDetail(concertId: string) {
  const concert = await prisma.concert.findFirst({
    where: {
      id: concertId,
      isVisible: true,
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
    genre: concert.genre,
    bookingUrl: concert.bookingUrl,
    externalSource: concert.externalSource,
    syncedAt: concert.syncedAt,
    isSample: concert.isSample,
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
