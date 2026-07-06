import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExternalConcertInput } from "@/lib/concert-providers/types";

const fetchKopisConcertsMock = vi.hoisted(() => vi.fn());
const transactionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/concert-providers/kopis", () => ({
  KOPIS_SOURCE: "kopis",
  fetchKopisConcerts: fetchKopisConcertsMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

import { syncUpcomingConcerts } from "@/lib/concert-sync";

describe("concert sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts all incoming schedules instead of only the first one", async () => {
    const firstDate = new Date("2026-07-07T15:00:00.000Z");
    const secondDate = new Date("2026-07-08T15:00:00.000Z");
    const staleDate = new Date("2026-07-09T15:00:00.000Z");
    const concert: ExternalConcertInput = {
      externalSource: "kopis",
      externalId: "PF_DAILY",
      title: "DAILY TEST LIVE",
      artist: "테스트 아티스트",
      venueName: "KSPO DOME",
      region: "서울",
      startDate: firstDate,
      endDate: new Date("2026-07-11T14:59:59.000Z"),
      priceMin: 0,
      priceMax: 0,
      schedules: [
        {
          performanceDate: firstDate,
          roundName: "1일차",
          startTime: "19:00",
        },
        {
          performanceDate: secondDate,
          roundName: "2일차",
          startTime: "19:00",
        },
      ],
    };
    const tx = {
      concert: {
        upsert: vi.fn(async () => ({
          id: "concert-1",
        })),
      },
      concertSchedule: {
        findMany: vi.fn(async () => [
          {
            id: "schedule-1",
            performanceDate: firstDate,
          },
          {
            id: "stale-schedule",
            performanceDate: staleDate,
          },
        ]),
        update: vi.fn(async () => ({
          id: "schedule-1",
        })),
        create: vi.fn(async () => ({
          id: "schedule-2",
        })),
        deleteMany: vi.fn(async () => ({
          count: 1,
        })),
      },
    };

    fetchKopisConcertsMock.mockResolvedValueOnce([concert]);
    transactionMock.mockImplementation(
      async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await syncUpcomingConcerts({
      provider: "kopis",
      monthsAhead: 1,
      rows: 10,
      pages: 1,
    });

    expect(tx.concertSchedule.update).toHaveBeenCalledWith({
      where: {
        id: "schedule-1",
      },
      data: {
        performanceDate: firstDate,
        roundName: "1일차",
        startTime: "19:00",
      },
    });
    expect(tx.concertSchedule.create).toHaveBeenCalledWith({
      data: {
        concertId: "concert-1",
        performanceDate: secondDate,
        roundName: "2일차",
        startTime: "19:00",
      },
      select: {
        id: true,
      },
    });
    expect(tx.concertSchedule.deleteMany).toHaveBeenCalledWith({
      where: {
        concertId: "concert-1",
        id: {
          in: ["stale-schedule"],
        },
      },
    });
  });
});
