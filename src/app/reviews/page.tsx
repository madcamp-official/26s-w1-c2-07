import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  ListFilter,
  MapPin,
  MessageSquare,
} from "lucide-react";

import { ReviewClient } from "@/app/concerts/[concertId]/reviews/review-client";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import {
  getRegisteredConcertsForUser,
  type RegisteredConcertSummary,
} from "@/lib/registered-concerts";
import { cn } from "@/lib/utils";
import {
  getConcertReviewData,
  normalizeReviewScoreField,
  normalizeReviewSortMode,
  REVIEW_PAGE_SIZE,
} from "@/lib/reviews";
import { formatDateRange } from "@/utils/format";

type ReviewsHubPageProps = {
  searchParams?: Promise<{
    concertId?: string;
    page?: string;
    score?: string;
    sort?: string;
    zoneId?: string;
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

function ReviewConcertCard({
  concert,
  selected,
}: {
  concert: RegisteredConcertSummary;
  selected: boolean;
}) {
  const href = `/reviews?concertId=${encodeURIComponent(concert.id)}`;

  return (
    <Link
      href={href}
      className={cn(
        "group grid h-[148px] grid-cols-[76px_minmax(0,1fr)_18px] gap-3 overflow-hidden rounded-lg border bg-background p-3 shadow-sm transition hover:border-primary/60",
        selected && "border-primary bg-primary/5 ring-1 ring-primary/30",
      )}
    >
      <div className="relative h-[76px] w-[76px] overflow-hidden rounded-md border bg-secondary">
        {concert.posterImageUrl ? (
          <Image
            src={concert.posterImageUrl}
            alt=""
            fill
            sizes="76px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            포스터
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-black leading-5">
          {concert.title}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {concert.artist}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {concert.venueName}
        </p>
        <p className="mt-2 text-xs font-semibold text-primary">
          리뷰 {concert.reviewCount}개
        </p>
      </div>
      <ChevronRight
        className={cn(
          "mt-1 h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary",
          selected && "text-primary",
        )}
        aria-hidden="true"
      />
    </Link>
  );
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "", 10);

  return Number.isFinite(page) && page > 0 ? page : 1;
}

function getReviewsPaginationBaseHref(
  concertId: string,
  filters: {
    score: string;
    sort: string;
    zoneId: string | null;
  },
) {
  const params = new URLSearchParams({
    concertId,
    sort: filters.sort,
    score: filters.score,
  });

  if (filters.zoneId) {
    params.set("zoneId", filters.zoneId);
  }

  return `/reviews?${params.toString()}`;
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

  const concerts = await getRegisteredConcertsForUser(user.id);
  const selectedConcertId = getSelectedConcertId(
    concerts,
    resolvedSearchParams?.concertId,
  );
  const page = parsePage(resolvedSearchParams?.page);
  const sortMode = normalizeReviewSortMode(resolvedSearchParams?.sort);
  const scoreField = normalizeReviewScoreField(resolvedSearchParams?.score);
  const selectedConcert = selectedConcertId
    ? await getConcertReviewData(selectedConcertId, {
        page,
        pageSize: REVIEW_PAGE_SIZE,
        sortMode,
        scoreField,
        zoneId: resolvedSearchParams?.zoneId ?? null,
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-normal">좌석 리뷰</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            내가 배치도를 등록한 공연의 리뷰 목록을 확인하세요.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/concerts">
            <ListFilter className="h-4 w-4" aria-hidden="true" />
            공연 찾기
          </Link>
        </Button>
      </div>

      {concerts.length === 0 ? (
        <section className="mt-8 rounded-lg border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MessageSquare className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-2xl font-black">
            등록한 배치도가 없습니다
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            좌석 배치도를 등록한 공연이 생기면 해당 공연의 리뷰를 확인할 수
            있습니다.
          </p>
        </section>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">공연 목록</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    내 배치도 등록 공연
                  </p>
                </div>
                <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">
                  {concerts.length}개
                </span>
              </div>

              <div className="mt-4 max-h-[468px] space-y-3 overflow-y-auto overscroll-contain pr-1">
                {concerts.map((concert) => (
                  <ReviewConcertCard
                    key={concert.id}
                    concert={concert}
                    selected={concert.id === selectedConcertId}
                  />
                ))}
              </div>
            </section>
          </aside>

          <section className="min-w-0">
            {selectedConcert ? (
              <>
                <section className="rounded-lg border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black">
                        {selectedConcert.concert.title}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                          {selectedConcert.concert.venueName}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          {formatDateRange(
                            selectedConcert.concert.startDate,
                            selectedConcert.concert.endDate,
                          )}
                        </span>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/concerts/${selectedConcert.concert.id}`}>
                        공연 상세
                      </Link>
                    </Button>
                  </div>
                </section>

                <ReviewClient
                  reviews={selectedConcert.reviews}
                  filters={selectedConcert.filters}
                  zoneOptions={selectedConcert.zoneOptions}
                  pagination={selectedConcert.pagination}
                  paginationBaseHref={getReviewsPaginationBaseHref(
                    selectedConcert.concert.id,
                    {
                      score: selectedConcert.filters.scoreField,
                      sort: selectedConcert.filters.sortMode,
                      zoneId: selectedConcert.filters.zoneId,
                    },
                  )}
                  filterFormAction="/reviews"
                  filterHiddenFields={[
                    {
                      name: "concertId",
                      value: selectedConcert.concert.id,
                    },
                  ]}
                  writeHref={`/concerts/${selectedConcert.concert.id}/reviews/new`}
                />
              </>
            ) : (
              <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
                <CalendarDays
                  className="mx-auto h-10 w-10 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2 className="mt-4 text-xl font-black">공연을 선택해주세요</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  왼쪽 목록에서 공연을 선택하면 리뷰 목록이 표시됩니다.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
