import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ImageUp, MapPin, Ticket } from "lucide-react";
import { z } from "zod";

import { PracticeWorkspaceClient } from "@/app/practice/practice-workspace-client";
import { RegisteredConcertWorkspace } from "@/components/registered-concert-workspace";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import {
  getRegisteredConcertsForUser,
  getRegisteredConcertSummaryForUser,
  type RegisteredConcertSummary,
  getRegisteredPracticeConcert,
} from "@/lib/registered-concerts";
import { getVirtualSeatReadinessForZones } from "@/lib/virtual-seats";
import { formatDateRange } from "@/utils/format";

const requestedConcertIdSchema = z.string().uuid();

type PracticeHubPageProps = {
  searchParams?: Promise<{
    concertId?: string;
  }>;
};

function getSelectedConcertId(
  concerts: RegisteredConcertSummary[],
  requestedConcertId: string | undefined,
) {
  return (
    concerts.find((concert) => concert.id === requestedConcertId)?.id ??
    concerts[0]?.id ??
    null
  );
}

function SelectedPracticeConcertInfo({
  concert,
}: {
  concert: RegisteredConcertSummary;
}) {
  return (
    <section className="h-full rounded-lg border bg-card p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-bold text-primary">공연명</p>
        <h2 className="mt-1.5 whitespace-normal break-words text-xl font-black leading-tight tracking-normal [overflow-wrap:anywhere]">
          {concert.title}
        </h2>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <p className="flex min-w-0 items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{concert.venueName}</span>
        </p>
        <p className="flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {formatDateRange(concert.startDate, concert.endDate)}
          </span>
        </p>
      </div>
    </section>
  );
}

function PracticePreparationState({
  concertId,
  hasSeatMap,
  hasZones,
  hasPracticeSeats,
}: {
  concertId: string;
  hasSeatMap: boolean;
  hasZones: boolean;
  hasPracticeSeats: boolean;
}) {
  const seatMapHref = !hasSeatMap
    ? `/concerts/${concertId}/seat-map/upload`
    : hasZones
      ? `/concerts/${concertId}/seat-map/edit`
      : `/concerts/${concertId}/seat-map/analysis`;

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-secondary">
          <Ticket className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-black">티켓팅 연습 준비가 필요합니다</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            티켓팅 연습을 시작하려면 좌석 배치도 AI 분석을 완료한 뒤 전체 좌석
            수를 입력해 좌석 데이터를 생성해야 합니다.
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
          좌석 데이터: {hasPracticeSeats ? "준비됨" : "생성 필요"}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link href={seatMapHref}>
            <ImageUp className="h-4 w-4" aria-hidden="true" />
            좌석 배치도 확인하기
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

function RegisteredSeatMapPreview({
  seatMap,
}: {
  seatMap: PracticePreviewSeatMap | null;
}) {
  return (
    <section className="min-h-0 rounded-lg border bg-card p-4 shadow-sm xl:flex xl:h-full xl:flex-col">
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
          <div className="mt-4 max-h-[240px] overflow-auto rounded-lg border bg-secondary xl:min-h-0 xl:flex-1 xl:max-h-none">
            <div className="relative flex min-h-full items-center justify-center bg-background">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={seatMap.imageUrl}
                alt="등록한 좌석 배치도"
                className="block h-auto max-h-[240px] w-full object-contain xl:max-h-full"
              />
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-lg border bg-secondary px-5 py-12 text-center text-sm text-muted-foreground xl:flex-1">
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

  const parsedRequestedConcertId = requestedConcertIdSchema.safeParse(
    resolvedSearchParams?.concertId,
  );
  const requestedConcertId = parsedRequestedConcertId.success
    ? parsedRequestedConcertId.data
    : undefined;
  const [registeredConcerts, requestedPracticeConcert] = await Promise.all([
    getRegisteredConcertsForUser(user.id),
    requestedConcertId
      ? getRegisteredPracticeConcert(user.id, requestedConcertId)
      : Promise.resolve(null),
  ]);

  let visibleRegisteredConcerts = registeredConcerts;

  if (
    requestedConcertId &&
    !visibleRegisteredConcerts.some(
      (concert) => concert.id === requestedConcertId,
    )
  ) {
    const requestedConcert = await getRegisteredConcertSummaryForUser(
      user.id,
      requestedConcertId,
    );

    if (requestedConcert) {
      visibleRegisteredConcerts = [
        requestedConcert,
        ...visibleRegisteredConcerts,
      ];
    }
  }

  const selectedConcertId = getSelectedConcertId(
    visibleRegisteredConcerts,
    requestedConcertId,
  );
  const selectedConcertSummary =
    visibleRegisteredConcerts.find(
      (concert) => concert.id === selectedConcertId,
    ) ?? null;
  const selectedConcert =
    selectedConcertId && selectedConcertId === requestedConcertId
      ? requestedPracticeConcert
      : selectedConcertId
        ? await getRegisteredPracticeConcert(user.id, selectedConcertId)
        : null;
  const latestSeatMap = selectedConcert?.seatMaps[0] ?? null;
  const zones = latestSeatMap?.zones ?? [];
  const hasZones = zones.length > 0;
  let hasPracticeSeats = false;
  let isPracticeReady = false;

  if (selectedConcertId && latestSeatMap && hasZones) {
    const seatPreparation = getVirtualSeatReadinessForZones(zones);

    hasPracticeSeats = seatPreparation.ready;
    isPracticeReady = seatPreparation.ready && zones.length > 0;
  }

  return (
    <RegisteredConcertWorkspace
      mode="practice"
      title="티켓팅 연습"
      description="내가 등록한 좌석 배치도를 기준으로 실전 예매 흐름을 연습하세요."
      sidebarTitle="내가 등록한 배치도"
      showTip={false}
      concerts={visibleRegisteredConcerts}
      selectedConcertId={selectedConcertId}
      sidebarListSize="three"
      emptyTitle="아직 등록한 좌석 배치도가 없습니다"
      emptyDescription="공연을 선택하고 좌석 배치도를 등록하면 티켓팅 연습을 시작할 수 있습니다."
    >
      {selectedConcertSummary ? (
        selectedConcert && latestSeatMap && hasZones && isPracticeReady ? (
          <PracticeWorkspaceClient
            key={latestSeatMap.id}
            concert={{
              id: selectedConcert.id,
              title: selectedConcert.title,
              artist: selectedConcert.artist,
              venueName: selectedConcert.venueName,
              region: selectedConcert.region,
              priceMin: selectedConcert.priceMin,
              priceMax: selectedConcert.priceMax,
              dateLabel: formatDateRange(
                selectedConcertSummary.startDate,
                selectedConcertSummary.endDate,
              ),
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
              analysisStatus:
                selectedConcertSummary.latestSeatMap.analysisStatus,
            }}
            zones={zones.map((zone) => ({
              id: zone.id,
              name: zone.name,
              grade: zone.grade,
              price: zone.price,
              bbox: zone.bbox,
              polygon: zone.polygon,
              virtualSeats: [],
            }))}
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-stretch">
            <div className="grid gap-4 xl:h-full xl:min-h-0 xl:grid-rows-[auto_minmax(0,1fr)]">
              <SelectedPracticeConcertInfo concert={selectedConcertSummary} />
              <RegisteredSeatMapPreview
                seatMap={selectedConcertSummary.latestSeatMap}
              />
            </div>

            <div className="xl:sticky xl:top-28">
              <PracticePreparationState
                concertId={selectedConcertSummary.id}
                hasSeatMap={Boolean(selectedConcertSummary.latestSeatMap)}
                hasZones={Boolean(latestSeatMap && hasZones)}
                hasPracticeSeats={hasPracticeSeats}
              />
            </div>
          </div>
        )
      ) : null}
    </RegisteredConcertWorkspace>
  );
}
