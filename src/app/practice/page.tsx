import Link from "next/link";
import { redirect } from "next/navigation";
import { ImageUp, Ticket } from "lucide-react";

import { PracticeClient } from "@/app/concerts/[concertId]/practice/practice-client";
import {
  RegisteredConcertHeader,
  RegisteredConcertWorkspace,
} from "@/components/registered-concert-workspace";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import {
  getRegisteredConcertsForUser,
  getRegisteredPracticeConcert,
} from "@/lib/registered-concerts";

type PracticeHubPageProps = {
  searchParams?: Promise<{
    concertId?: string;
  }>;
};

function getSelectedConcertId(
  concerts: Awaited<ReturnType<typeof getRegisteredConcertsForUser>>,
  requestedConcertId: string | undefined,
) {
  return (
    concerts.find((concert) => concert.id === requestedConcertId)?.id ??
    concerts[0]?.id ??
    null
  );
}

function PracticePreparationState({
  concertId,
  hasSeatMap,
  hasZones,
  hasVirtualSeats,
}: {
  concertId: string;
  hasSeatMap: boolean;
  hasZones: boolean;
  hasVirtualSeats: boolean;
}) {
  return (
    <section className="mt-5 rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-secondary">
          <Ticket className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-2xl font-black">티켓팅 연습 준비가 필요합니다</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            티켓팅 연습을 시작하려면 좌석 배치도 AI 분석과 구역별 가상 좌석
            생성이 먼저 완료되어야 합니다.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
        <p className="rounded-md border bg-secondary px-3 py-2">
          좌석 배치도: {hasSeatMap ? "등록됨" : "필요"}
        </p>
        <p className="rounded-md border bg-secondary px-3 py-2">
          AI 분석: {hasZones ? "완료" : "필요"}
        </p>
        <p className="rounded-md border bg-secondary px-3 py-2">
          가상 좌석: {hasVirtualSeats ? "생성됨" : "필요"}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/concerts/${concertId}/seat-map`}>
            <ImageUp className="h-4 w-4" aria-hidden="true" />
            좌석 데이터 준비하기
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/concerts/${concertId}`}>공연 상세 보기</Link>
        </Button>
      </div>
    </section>
  );
}

export default async function PracticeHubPage({
  searchParams,
}: PracticeHubPageProps) {
  const [resolvedSearchParams, user] = await Promise.all([
    searchParams,
    getCurrentUser(),
  ]);

  if (!user) {
    redirect("/login?redirect=/practice");
  }

  const registeredConcerts = await getRegisteredConcertsForUser(user.id);
  const selectedConcertId = getSelectedConcertId(
    registeredConcerts,
    resolvedSearchParams?.concertId,
  );
  const selectedConcertSummary =
    registeredConcerts.find((concert) => concert.id === selectedConcertId) ??
    null;
  const selectedConcert = selectedConcertId
    ? await getRegisteredPracticeConcert(user.id, selectedConcertId)
    : null;
  const latestSeatMap = selectedConcert?.seatMaps[0] ?? null;
  const zones =
    latestSeatMap?.zones.map((zone) => ({
      ...zone,
      virtualSeats: zone.virtualSeats,
    })) ?? [];
  const hasZones = zones.length > 0;
  const hasVirtualSeats = zones.some((zone) => zone.virtualSeats.length > 0);

  return (
    <RegisteredConcertWorkspace
      mode="practice"
      title="티켓팅 연습"
      description="내가 등록한 좌석 배치도를 기준으로 실전 예매 흐름을 연습하세요."
      sidebarTitle="내가 등록한 배치도"
      tip="배치도를 등록하면 티켓팅 연습을 더 실감나게 진행할 수 있습니다."
      concerts={registeredConcerts}
      selectedConcertId={selectedConcertId}
      emptyTitle="아직 등록한 좌석 배치도가 없습니다"
      emptyDescription="공연을 선택하고 좌석 배치도를 등록하면 티켓팅 연습을 시작할 수 있습니다."
    >
      {selectedConcertSummary ? (
        <>
          <RegisteredConcertHeader concert={selectedConcertSummary} />

          {selectedConcert && latestSeatMap && hasZones && hasVirtualSeats ? (
            <PracticeClient
              concert={{
                id: selectedConcert.id,
                title: selectedConcert.title,
                artist: selectedConcert.artist,
                venueName: selectedConcert.venueName,
                region: selectedConcert.region,
                priceMin: selectedConcert.priceMin,
                priceMax: selectedConcert.priceMax,
              }}
              schedules={selectedConcert.schedules.map((schedule) => ({
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
          ) : (
            <PracticePreparationState
              concertId={selectedConcertSummary.id}
              hasSeatMap={Boolean(selectedConcertSummary.latestSeatMap)}
              hasZones={Boolean(latestSeatMap && hasZones)}
              hasVirtualSeats={hasVirtualSeats}
            />
          )}
        </>
      ) : null}
    </RegisteredConcertWorkspace>
  );
}
