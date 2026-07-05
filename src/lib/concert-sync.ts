import { Prisma } from "@prisma/client";

import { fetchKopisConcerts, KOPIS_SOURCE } from "@/lib/concert-providers/kopis";
import type { ExternalConcertInput } from "@/lib/concert-providers/types";
import { prisma } from "@/lib/prisma";

const DEFAULT_SYNC_MONTHS_AHEAD = 6;
const DEFAULT_SYNC_ROWS = 20;
const DEFAULT_SYNC_PAGES = 1;
const MAX_SYNC_MONTHS_AHEAD = 12;
const MAX_SYNC_ROWS = 50;
const MAX_SYNC_PAGES = 5;

export type ConcertSyncOptions = {
  provider?: "kopis";
  monthsAhead?: number;
  rows?: number;
  pages?: number;
  genreCode?: string;
  regionCode?: string;
  keyword?: string;
};

function clampInteger(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(Math.max(value as number, min), max);
}

function getSyncDateRange(monthsAhead: number) {
  const from = new Date();
  const to = new Date(from);

  to.setMonth(to.getMonth() + monthsAhead);

  return {
    from,
    to,
  };
}

async function upsertExternalConcert(concert: ExternalConcertInput) {
  const syncedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const upsertedConcert = await tx.concert.upsert({
      where: {
        externalSource_externalId: {
          externalSource: concert.externalSource,
          externalId: concert.externalId,
        },
      },
      update: {
        title: concert.title,
        artist: concert.artist,
        venueName: concert.venueName,
        region: concert.region,
        startDate: concert.startDate,
        endDate: concert.endDate,
        priceMin: concert.priceMin,
        priceMax: concert.priceMax,
        posterImageUrl: concert.posterImageUrl ?? null,
        description: concert.description ?? null,
        genre: concert.genre ?? null,
        bookingUrl: concert.bookingUrl ?? null,
        ticketOpenAt: concert.ticketOpenAt ?? null,
        syncedAt,
        rawExternalData:
          (concert.rawExternalData as Prisma.InputJsonValue | undefined) ??
          Prisma.JsonNull,
        isVisible: true,
        isSample: false,
      },
      create: {
        title: concert.title,
        artist: concert.artist,
        venueName: concert.venueName,
        region: concert.region,
        startDate: concert.startDate,
        endDate: concert.endDate,
        priceMin: concert.priceMin,
        priceMax: concert.priceMax,
        posterImageUrl: concert.posterImageUrl ?? null,
        description: concert.description ?? null,
        genre: concert.genre ?? null,
        bookingUrl: concert.bookingUrl ?? null,
        ticketOpenAt: concert.ticketOpenAt ?? null,
        externalSource: concert.externalSource,
        externalId: concert.externalId,
        syncedAt,
        rawExternalData:
          (concert.rawExternalData as Prisma.InputJsonValue | undefined) ??
          Prisma.JsonNull,
        isVisible: true,
        isSample: false,
      },
      select: {
        id: true,
      },
    });

    const primarySchedule = concert.schedules[0];

    if (primarySchedule) {
      const existingSchedule = await tx.concertSchedule.findFirst({
        where: {
          concertId: upsertedConcert.id,
        },
        orderBy: {
          performanceDate: "asc",
        },
        select: {
          id: true,
        },
      });

      if (existingSchedule) {
        await tx.concertSchedule.update({
          where: {
            id: existingSchedule.id,
          },
          data: {
            performanceDate: primarySchedule.performanceDate,
            roundName: primarySchedule.roundName,
            startTime: primarySchedule.startTime,
          },
        });
      } else {
        await tx.concertSchedule.create({
          data: {
            concertId: upsertedConcert.id,
            performanceDate: primarySchedule.performanceDate,
            roundName: primarySchedule.roundName,
            startTime: primarySchedule.startTime,
          },
        });
      }
    }

    return upsertedConcert.id;
  });
}

export async function syncUpcomingConcerts(options: ConcertSyncOptions = {}) {
  const provider = options.provider ?? KOPIS_SOURCE;
  const monthsAhead = clampInteger(
    options.monthsAhead,
    DEFAULT_SYNC_MONTHS_AHEAD,
    1,
    MAX_SYNC_MONTHS_AHEAD,
  );
  const rows = clampInteger(options.rows, DEFAULT_SYNC_ROWS, 1, MAX_SYNC_ROWS);
  const pages = clampInteger(options.pages, DEFAULT_SYNC_PAGES, 1, MAX_SYNC_PAGES);
  const genreCode = options.genreCode ?? process.env.KOPIS_DEFAULT_GENRE_CODE;
  const regionCode = options.regionCode;
  const keyword = options.keyword;
  const { from, to } = getSyncDateRange(monthsAhead);
  const fetchedConcerts: ExternalConcertInput[] = [];

  if (provider !== KOPIS_SOURCE) {
    throw new Error(`지원하지 않는 공연 정보 provider입니다: ${provider}`);
  }

  for (let page = 1; page <= pages; page += 1) {
    const pageConcerts = await fetchKopisConcerts({
      from,
      to,
      page,
      rows,
      genreCode,
      regionCode,
      keyword,
    });

    fetchedConcerts.push(...pageConcerts);

    if (pageConcerts.length < rows) {
      break;
    }
  }

  const uniqueConcerts = Array.from(
    new Map(
      fetchedConcerts.map((concert) => [
        `${concert.externalSource}:${concert.externalId}`,
        concert,
      ]),
    ).values(),
  );
  let createdOrUpdatedCount = 0;

  for (const concert of uniqueConcerts) {
    await upsertExternalConcert(concert);
    createdOrUpdatedCount += 1;
  }

  return {
    provider,
    from,
    to,
    fetchedCount: fetchedConcerts.length,
    upsertedCount: createdOrUpdatedCount,
  };
}
