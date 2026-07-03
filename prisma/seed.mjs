import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnv() {
  if (!existsSync(".env")) {
    return;
  }

  const lines = readFileSync(".env", "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex);
    let value = trimmed.slice(separatorIndex + 1);

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

loadEnv();

const prisma = new PrismaClient();

const concerts = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "NEON PULSE LIVE 2026",
    artist: "윤하늘",
    venueName: "KSPO DOME",
    region: "서울",
    startDate: new Date("2026-08-15T19:00:00+09:00"),
    endDate: new Date("2026-08-16T18:00:00+09:00"),
    priceMin: 99000,
    priceMax: 165000,
    posterImageUrl:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80",
    description:
      "강한 밴드 사운드와 전자음 중심의 연출을 결합한 여름 콘서트입니다. 좌석 배치도 업로드와 티켓팅 연습 흐름을 검증하기 위한 대표 샘플 공연입니다.",
    schedules: [
      {
        id: "11111111-1111-4111-8111-111111111201",
        performanceDate: new Date("2026-08-15T19:00:00+09:00"),
        roundName: "1회차",
        startTime: "19:00",
      },
      {
        id: "11111111-1111-4111-8111-111111111202",
        performanceDate: new Date("2026-08-16T18:00:00+09:00"),
        roundName: "2회차",
        startTime: "18:00",
      },
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "MIDNIGHT STAGE",
    artist: "THE LUCID",
    venueName: "올림픽홀",
    region: "서울",
    startDate: new Date("2026-09-05T18:00:00+09:00"),
    endDate: new Date("2026-09-06T17:00:00+09:00"),
    priceMin: 88000,
    priceMax: 143000,
    posterImageUrl:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=900&q=80",
    description:
      "중형 공연장 좌석 구역 리뷰와 시야 사진 업로드 흐름을 확인하기 좋은 밴드 콘서트 샘플입니다.",
    schedules: [
      {
        id: "22222222-2222-4222-8222-222222222201",
        performanceDate: new Date("2026-09-05T18:00:00+09:00"),
        roundName: "토요일 공연",
        startTime: "18:00",
      },
      {
        id: "22222222-2222-4222-8222-222222222202",
        performanceDate: new Date("2026-09-06T17:00:00+09:00"),
        roundName: "일요일 공연",
        startTime: "17:00",
      },
    ],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    title: "SPRING NOTE ENCORE",
    artist: "서아린",
    venueName: "블루스퀘어 마스터카드홀",
    region: "서울",
    startDate: new Date("2026-10-10T18:30:00+09:00"),
    endDate: new Date("2026-10-10T18:30:00+09:00"),
    priceMin: 77000,
    priceMax: 132000,
    posterImageUrl:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80",
    description:
      "단일 회차 공연의 상세 페이지, 회차 선택, 티켓팅 연습 진입 조건을 확인하기 위한 샘플 공연입니다.",
    schedules: [
      {
        id: "33333333-3333-4333-8333-333333333201",
        performanceDate: new Date("2026-10-10T18:30:00+09:00"),
        roundName: "앙코르 공연",
        startTime: "18:30",
      },
    ],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    title: "CITY POP NIGHT",
    artist: "오브제",
    venueName: "고려대학교 화정체육관",
    region: "서울",
    startDate: new Date("2026-11-21T19:00:00+09:00"),
    endDate: new Date("2026-11-22T17:00:00+09:00"),
    priceMin: 99000,
    priceMax: 154000,
    posterImageUrl:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80",
    description:
      "넓은 체육관형 공연장의 좌석 구역 분석과 가상 좌석 생성 테스트에 적합한 샘플 공연입니다.",
    schedules: [
      {
        id: "44444444-4444-4444-8444-444444444201",
        performanceDate: new Date("2026-11-21T19:00:00+09:00"),
        roundName: "1회차",
        startTime: "19:00",
      },
      {
        id: "44444444-4444-4444-8444-444444444202",
        performanceDate: new Date("2026-11-22T17:00:00+09:00"),
        roundName: "2회차",
        startTime: "17:00",
      },
    ],
  },
];

async function main() {
  for (const concert of concerts) {
    const { schedules, ...concertData } = concert;

    await prisma.concert.upsert({
      where: {
        id: concert.id,
      },
      update: concertData,
      create: concertData,
    });

    for (const schedule of schedules) {
      await prisma.concertSchedule.upsert({
        where: {
          id: schedule.id,
        },
        update: {
          concertId: concert.id,
          performanceDate: schedule.performanceDate,
          roundName: schedule.roundName,
          startTime: schedule.startTime,
        },
        create: {
          ...schedule,
          concertId: concert.id,
        },
      });
    }
  }

  console.log(`Seeded ${concerts.length} concerts.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

