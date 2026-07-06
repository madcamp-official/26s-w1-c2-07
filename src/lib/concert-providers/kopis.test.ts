import { describe, expect, it, vi } from "vitest";

import {
  fetchKopisConcerts,
  KOPIS_SOURCE,
  normalizeKopisConcert,
} from "@/lib/concert-providers/kopis";

describe("kopis concert provider", () => {
  it("normalizes KOPIS list and detail records into concert input", () => {
    const concert = normalizeKopisConcert({
      listRecord: {
        mt20id: "PF123456",
        prfnm: "NEON TEST LIVE",
        prfpdfrom: "2026.08.15",
        prfpdto: "2026.08.16",
        fcltynm: "KSPO DOME",
        poster: "http://www.kopis.or.kr/upload/pfmPoster/PF_TEST.gif",
        genrenm: "대중음악",
        area: "서울",
      },
      detailRecord: {
        prfcast: "테스트 아티스트",
        pcseguidance: "VIP석 165,000원, R석 132,000원",
        dtguidance: "토요일 19:00, 일요일 18:00",
        sty: "테스트 공연 소개",
        prfstate: "공연예정",
        relates: {
          relate: {
            relatenm: "예매처",
            relateurl: "https://tickets.example.com",
          },
        },
      },
    });

    expect(concert).toMatchObject({
      externalSource: KOPIS_SOURCE,
      externalId: "PF123456",
      title: "NEON TEST LIVE",
      artist: "테스트 아티스트",
      venueName: "KSPO DOME",
      region: "서울",
      priceMin: 132000,
      priceMax: 165000,
      genre: "대중음악",
      bookingUrl: "https://tickets.example.com",
      posterImageUrl: "https://kopis.or.kr/upload/pfmPoster/PF_TEST.gif",
    });
    expect(concert?.schedules).toHaveLength(2);
    expect(concert?.schedules[0]).toMatchObject({
      roundName: "1일차",
      startTime: "19:00",
    });
    expect(concert?.schedules[1]).toMatchObject({
      roundName: "2일차",
      startTime: "19:00",
    });
    expect(concert?.schedules.map((schedule) => schedule.performanceDate.toISOString())).toEqual([
      "2026-08-14T15:00:00.000Z",
      "2026-08-15T15:00:00.000Z",
    ]);
  });

  it("creates daily practice schedules for short multi-day KOPIS periods", () => {
    const concert = normalizeKopisConcert({
      listRecord: {
        mt20id: "PF_DAILY",
        prfnm: "DAILY TEST LIVE",
        prfpdfrom: "2026.07.08",
        prfpdto: "2026.07.12",
        fcltynm: "KSPO DOME",
      },
    });

    expect(concert?.schedules).toHaveLength(5);
    expect(concert?.schedules.map((schedule) => schedule.roundName)).toEqual([
      "1일차",
      "2일차",
      "3일차",
      "4일차",
      "5일차",
    ]);
    expect(concert?.schedules.map((schedule) => schedule.performanceDate.toISOString())).toEqual([
      "2026-07-07T15:00:00.000Z",
      "2026-07-08T15:00:00.000Z",
      "2026-07-09T15:00:00.000Z",
      "2026-07-10T15:00:00.000Z",
      "2026-07-11T15:00:00.000Z",
    ]);
  });

  it("keeps long KOPIS periods as one range schedule", () => {
    const concert = normalizeKopisConcert({
      listRecord: {
        mt20id: "PF_LONG",
        prfnm: "LONG RUN TEST",
        prfpdfrom: "2026.07.01",
        prfpdto: "2026.09.15",
        fcltynm: "테스트 극장",
      },
    });

    expect(concert?.schedules).toHaveLength(1);
    expect(concert?.schedules[0]).toMatchObject({
      roundName: "공연 기간",
      startTime: "시간 미정",
    });
  });

  it("rejects records without an external id or valid date range", () => {
    expect(
      normalizeKopisConcert({
        listRecord: {
          prfnm: "BROKEN",
          prfpdfrom: "2026.08.15",
          prfpdto: "2026.08.16",
        },
      }),
    ).toBeNull();

    expect(
      normalizeKopisConcert({
        listRecord: {
          mt20id: "PF123456",
          prfnm: "BROKEN",
          prfpdfrom: "invalid",
          prfpdto: "2026.08.16",
        },
      }),
    ).toBeNull();

    expect(
      normalizeKopisConcert({
        listRecord: {
          mt20id: "PF123456",
          prfnm: "BROKEN",
          prfpdfrom: "2026.08.17",
          prfpdto: "2026.08.16",
        },
      }),
    ).toBeNull();
  });

  it("passes optional KOPIS list filters as query parameters", async () => {
    const originalApiKey = process.env.KOPIS_API_KEY;
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];

    process.env.KOPIS_API_KEY = "test-kopis-key";
    globalThis.fetch = vi.fn(async (input) => {
      requestedUrls.push(String(input));

      return new Response("<dbs></dbs>", {
        status: 200,
        headers: {
          "content-type": "application/xml",
        },
      });
    }) as typeof fetch;

    try {
      await fetchKopisConcerts({
        from: new Date("2026-07-01T00:00:00+09:00"),
        to: new Date("2026-07-31T23:59:59+09:00"),
        page: 2,
        rows: 30,
        genreCode: "AAAA",
        regionCode: "11",
        keyword: "사랑",
      });
    } finally {
      if (originalApiKey === undefined) {
        delete process.env.KOPIS_API_KEY;
      } else {
        process.env.KOPIS_API_KEY = originalApiKey;
      }

      globalThis.fetch = originalFetch;
    }

    const url = new URL(requestedUrls[0]);

    expect(url.pathname).toBe("/openApi/restful/pblprfr");
    expect(url.searchParams.get("service")).toBe("test-kopis-key");
    expect(url.searchParams.get("cpage")).toBe("2");
    expect(url.searchParams.get("rows")).toBe("30");
    expect(url.searchParams.get("shcate")).toBe("AAAA");
    expect(url.searchParams.get("signgucode")).toBe("11");
    expect(url.searchParams.get("shprfnm")).toBe("사랑");
  });
});
