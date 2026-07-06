import Link from "next/link";
import { redirect } from "next/navigation";
import { ImageUp, Ticket } from "lucide-react";

import { PracticeClient } from "@/app/concerts/[concertId]/practice/practice-client";
import { RegisteredConcertWorkspace } from "@/components/registered-concert-workspace";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import {
  getRegisteredConcertsForUser,
  getRegisteredPracticeConcert,
} from "@/lib/registered-concerts";
import {
  getBboxCenter,
  getPolygonCenter,
  getPolygonPointsAttribute,
  parseBbox,
  parsePolygon,
  polygonFromBbox,
  type Point,
} from "@/lib/seat-zone-geometry";

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
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-secondary">
          <Ticket className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-black">티켓팅 연습 준비가 필요합니다</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            티켓팅 연습을 시작하려면 좌석 배치도 AI 분석과 구역별 가상 좌석
            생성이 먼저 완료되어야 합니다.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 text-sm text-muted-foreground">
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

type PracticePreviewSeatMap = {
  imageUrl: string;
  analysisStatus: "pending" | "success" | "failed";
  zoneCount: number;
};

type PracticePreviewZone = {
  id: string;
  name: string;
  grade: string;
  bbox: unknown;
  polygon: unknown;
  virtualSeats: unknown[];
};

function getStatusLabel(status: PracticePreviewSeatMap["analysisStatus"]) {
  if (status === "success") {
    return "분석 완료";
  }

  if (status === "failed") {
    return "분석 실패";
  }

  return "분석 대기";
}

function getZonePreviewOverlays(zones: PracticePreviewZone[]) {
  return zones
    .map((zone) => {
      const bbox = parseBbox(zone.bbox);
      const polygon =
        parsePolygon(zone.polygon) ?? (bbox ? polygonFromBbox(bbox) : null);

      if (!polygon) {
        return null;
      }

      const labelPoint: Point = parsePolygon(zone.polygon)
        ? getPolygonCenter(polygon)
        : bbox
          ? getBboxCenter(bbox)
          : getPolygonCenter(polygon);

      return {
        ...zone,
        polygon,
        labelPoint,
      };
    })
    .filter(
      (
        zone,
      ): zone is PracticePreviewZone & {
        polygon: Point[];
        labelPoint: Point;
      } => Boolean(zone),
    );
}

function RegisteredSeatMapPreview({
  seatMap,
  zones,
}: {
  seatMap: PracticePreviewSeatMap | null;
  zones: PracticePreviewZone[];
}) {
  const overlays = getZonePreviewOverlays(zones);
  const virtualSeatCount = zones.reduce(
    (total, zone) => total + zone.virtualSeats.length,
    0,
  );
  const coordinateReviewCount = seatMap
    ? Math.max(seatMap.zoneCount - overlays.length, 0)
    : 0;

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-muted-foreground">
          선택한 공연에 등록된 좌석 배치도를 확인합니다.
        </p>
        {seatMap ? (
          <span className="rounded-full border bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
            {getStatusLabel(seatMap.analysisStatus)}
          </span>
        ) : null}
      </div>

      {seatMap ? (
        <>
          <div className="mt-5 overflow-hidden rounded-lg border bg-secondary">
            <div className="relative bg-background">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={seatMap.imageUrl}
                alt="등록한 좌석 배치도"
                className="block h-auto w-full"
              />
              {overlays.length > 0 ? (
                <>
                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {overlays.map((zone) => (
                      <polygon
                        key={zone.id}
                        points={getPolygonPointsAttribute(zone.polygon)}
                        className="fill-emerald-400/15 stroke-emerald-600"
                        strokeWidth={0.55}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </svg>
                  {overlays.map((zone) => (
                    <span
                      key={`${zone.id}-label`}
                      className="absolute max-w-32 -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background/95 px-2 py-1 text-[11px] font-semibold shadow-sm"
                      style={{
                        left: `${zone.labelPoint.x * 100}%`,
                        top: `${zone.labelPoint.y * 100}%`,
                      }}
                    >
                      <span className="block truncate">{zone.name}</span>
                      <span className="block truncate text-muted-foreground">
                        {zone.grade}
                      </span>
                    </span>
                  ))}
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p className="rounded-md border bg-secondary px-3 py-2">
              구역 {seatMap.zoneCount}개
            </p>
            <p className="rounded-md border bg-secondary px-3 py-2">
              가상 좌석 {virtualSeatCount}석
            </p>
          </div>
          {coordinateReviewCount > 0 ? (
            <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              좌표 확인 필요 {coordinateReviewCount}개
            </p>
          ) : null}
        </>
      ) : (
        <div className="mt-5 rounded-lg border bg-secondary px-5 py-12 text-center text-sm text-muted-foreground">
          등록된 좌석 배치도를 찾지 못했습니다.
        </div>
      )}
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
      showTip={false}
      concerts={registeredConcerts}
      selectedConcertId={selectedConcertId}
      emptyTitle="아직 등록한 좌석 배치도가 없습니다"
      emptyDescription="공연을 선택하고 좌석 배치도를 등록하면 티켓팅 연습을 시작할 수 있습니다."
    >
      {selectedConcertSummary ? (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <RegisteredSeatMapPreview
            seatMap={selectedConcertSummary.latestSeatMap}
            zones={zones}
          />
          <div className="xl:sticky xl:top-28">
            {selectedConcert && latestSeatMap && hasZones && hasVirtualSeats ? (
              <PracticeClient
                layout="panel"
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
          </div>
        </div>
      ) : null}
    </RegisteredConcertWorkspace>
  );
}
