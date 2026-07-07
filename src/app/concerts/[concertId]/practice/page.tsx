import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ImageUp, Ticket } from "lucide-react";
import { z } from "zod";

import { PracticeClient } from "@/app/concerts/[concertId]/practice/practice-client";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVirtualSeatReadinessForSeatMap } from "@/lib/virtual-seats";

const concertIdSchema = z.string().uuid();

type PracticePageProps = {
  params: Promise<{
    concertId: string;
  }>;
};

async function getPracticeConcert(concertId: string, userId: string) {
  return prisma.concert.findUnique({
    where: {
      id: concertId,
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
              virtualSeats: {
                select: {
                  id: true,
                  rowLabel: true,
                  seatNumber: true,
                  status: true,
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

export default async function PracticePage({ params }: PracticePageProps) {
  const { concertId } = await params;
  const parsedConcertId = concertIdSchema.safeParse(concertId);

  if (!parsedConcertId.success) {
    notFound();
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?redirect=/concerts/${parsedConcertId.data}/practice`);
  }

  const concert = await getPracticeConcert(parsedConcertId.data, user.id);

  if (!concert) {
    notFound();
  }

  const latestSeatMap = concert.seatMaps[0] ?? null;
  const zones =
    latestSeatMap?.zones.map((zone) => ({
      ...zone,
      virtualSeats: zone.virtualSeats,
    })) ?? [];
  const hasZones = zones.length > 0;
  let hasPracticeSeats =
    zones.length > 0 && zones.every((zone) => zone.virtualSeats.length > 0);
  let isPracticeReady = false;

  if (latestSeatMap && hasZones) {
    const seatPreparation = await getVirtualSeatReadinessForSeatMap(
      latestSeatMap.id,
    );
    hasPracticeSeats = seatPreparation.ready;
    isPracticeReady =
      seatPreparation.ready &&
      zones.length > 0 &&
      hasPracticeSeats;
  }

  if (!latestSeatMap || !hasZones || !isPracticeReady) {
    const seatMapHref =
      latestSeatMap && hasZones
        ? `/concerts/${concert.id}/seat-map/edit`
        : `/concerts/${concert.id}/seat-map/analysis`;

    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/concerts/${concert.id}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            공연 상세
          </Link>
        </Button>

        <section className="mt-5 rounded-lg border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-secondary">
              <Ticket className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{concert.title}</p>
              <h1 className="mt-1 text-2xl font-semibold">
                티켓팅 연습 준비가 필요합니다
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                티켓팅 연습을 시작하려면 좌석 배치도 AI 분석을 완료한 뒤 전체
                좌석 수를 입력해 좌석 데이터를 생성해야 합니다.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-sm text-muted-foreground">
            <p>
              좌석 배치도 분석: {latestSeatMap && hasZones ? "완료" : "필요"}
            </p>
            <p>좌석 데이터: {hasPracticeSeats ? "준비됨" : "생성 필요"}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link href={seatMapHref}>
                <ImageUp className="h-4 w-4" aria-hidden="true" />
                좌석 배치도 확인하기
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/concerts/${concert.id}`}>공연 상세로 돌아가기</Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/concerts/${concert.id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          공연 상세
        </Link>
      </Button>

      <PracticeClient
        concert={{
          id: concert.id,
          title: concert.title,
          artist: concert.artist,
          venueName: concert.venueName,
          region: concert.region,
          priceMin: concert.priceMin,
          priceMax: concert.priceMax,
        }}
        schedules={concert.schedules.map((schedule) => ({
          id: schedule.id,
          performanceDate: schedule.performanceDate.toISOString(),
          roundName: schedule.roundName,
          startTime: schedule.startTime,
        }))}
        seatMap={{
          id: latestSeatMap.id,
          imageUrl: latestSeatMap.imageUrl,
          imageWidth: latestSeatMap.imageWidth,
          imageHeight: latestSeatMap.imageHeight,
        }}
        zones={zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          grade: zone.grade,
          price: zone.price,
          bbox: zone.bbox,
          polygon: zone.polygon,
          virtualSeats: zone.virtualSeats.map((seat) => ({
            id: seat.id,
            rowLabel: seat.rowLabel,
            seatNumber: seat.seatNumber,
            status: seat.status,
            zoneId: zone.id,
            x: seat.x,
            y: seat.y,
          })),
        }))}
      />
    </main>
  );
}
