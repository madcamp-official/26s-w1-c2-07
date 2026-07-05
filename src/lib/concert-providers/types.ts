import type { Prisma } from "@prisma/client";

export type ExternalConcertScheduleInput = {
  performanceDate: Date;
  roundName: string;
  startTime: string;
};

export type ExternalConcertInput = {
  externalSource: string;
  externalId: string;
  title: string;
  artist: string;
  venueName: string;
  region: string;
  startDate: Date;
  endDate: Date;
  priceMin: number;
  priceMax: number;
  posterImageUrl?: string | null;
  description?: string | null;
  genre?: string | null;
  bookingUrl?: string | null;
  ticketOpenAt?: Date | null;
  rawExternalData?: Prisma.InputJsonValue;
  schedules: ExternalConcertScheduleInput[];
};

export type ExternalConcertFetchOptions = {
  from: Date;
  to: Date;
  page: number;
  rows: number;
  genreCode?: string;
};
