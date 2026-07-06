import Link from "next/link";
import { redirect } from "next/navigation";
import { ImageUp, MessageSquare } from "lucide-react";

import { ReviewClient } from "@/app/concerts/[concertId]/reviews/review-client";
import {
  RegisteredConcertHeader,
  RegisteredConcertWorkspace,
} from "@/components/registered-concert-workspace";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import {
  getRegisteredConcertsForUser,
  getRegisteredReviewConcert,
} from "@/lib/registered-concerts";

type ReviewsHubPageProps = {
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

function ReviewPreparationState({
  concertId,
  hasSeatMap,
  hasZones,
}: {
  concertId: string;
  hasSeatMap: boolean;
  hasZones: boolean;
}) {
  return (
    <section className="mt-5 rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-secondary">
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-2xl font-black">
            좌석 구역 리뷰 준비가 필요합니다
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            구역별 리뷰를 확인하고 작성하려면 좌석 배치도 업로드와 AI 좌석 구역
            분석이 먼저 완료되어야 합니다.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <p className="rounded-md border bg-secondary px-3 py-2">
          좌석 배치도: {hasSeatMap ? "등록됨" : "필요"}
        </p>
        <p className="rounded-md border bg-secondary px-3 py-2">
          AI 분석: {hasZones ? "완료" : "필요"}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/concerts/${concertId}/seat-map`}>
            <ImageUp className="h-4 w-4" aria-hidden="true" />
            좌석 배치도 준비하기
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/concerts/${concertId}`}>공연 상세 보기</Link>
        </Button>
      </div>
    </section>
  );
}

export default async function ReviewsHubPage({
  searchParams,
}: ReviewsHubPageProps) {
  const [resolvedSearchParams, user] = await Promise.all([
    searchParams,
    getCurrentUser(),
  ]);

  if (!user) {
    redirect("/login?redirect=/reviews");
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
    ? await getRegisteredReviewConcert(user.id, selectedConcertId)
    : null;
  const latestSeatMap = selectedConcert?.seatMaps[0] ?? null;
  const hasZones = Boolean(latestSeatMap && latestSeatMap.zones.length > 0);

  return (
    <RegisteredConcertWorkspace
      mode="reviews"
      title="좌석 리뷰"
      description="내가 등록한 공연의 좌석 구역을 선택해 시야와 만족도 후기를 확인하세요."
      sidebarTitle="내가 등록한 공연"
      tip="공연을 선택하면 등록한 좌석 배치도에서 구역별 리뷰를 확인할 수 있습니다."
      concerts={registeredConcerts}
      selectedConcertId={selectedConcertId}
      emptyTitle="아직 등록한 좌석 배치도가 없습니다"
      emptyDescription="공연을 선택하고 좌석 배치도를 등록하면 좌석 구역 리뷰를 확인하고 작성할 수 있습니다."
    >
      {selectedConcertSummary ? (
        <>
          <RegisteredConcertHeader concert={selectedConcertSummary} />

          {selectedConcert && latestSeatMap && hasZones ? (
            <ReviewClient
              concert={{
                id: selectedConcert.id,
                title: selectedConcert.title,
                artist: selectedConcert.artist,
                venueName: selectedConcert.venueName,
                region: selectedConcert.region,
              }}
              currentUserId={user.id}
              seatMap={{
                id: latestSeatMap.id,
                imageUrl: latestSeatMap.imageUrl,
                zones: latestSeatMap.zones,
              }}
            />
          ) : (
            <ReviewPreparationState
              concertId={selectedConcertSummary.id}
              hasSeatMap={Boolean(selectedConcertSummary.latestSeatMap)}
              hasZones={hasZones}
            />
          )}
        </>
      ) : null}
    </RegisteredConcertWorkspace>
  );
}
