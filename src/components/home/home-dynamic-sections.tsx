"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  MessageSquare,
  Star,
  Ticket,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateRange, formatSeatCode } from "@/utils/format";

type HomeConcert = {
  id: string;
  title: string;
  artist: string;
  venueName: string;
  startDate: string;
  endDate: string;
  posterImageUrl: string | null;
};

type HomeReview = {
  id: string;
  seatFloor: string | null;
  seatSection: string | null;
  seatRow: string | null;
  seatNumber: string | null;
  satisfactionScore: number;
  concert: {
    id: string;
    title: string;
  };
  zone: {
    name: string;
  } | null;
};

type HomeData = {
  featuredConcerts: HomeConcert[];
  recentReviews: HomeReview[];
};

type HomeDataResponse = {
  data?: HomeData;
};

const initialHomeData: HomeData = {
  featuredConcerts: [],
  recentReviews: [],
};

function formatConcertDateRange(concert: HomeConcert) {
  return formatDateRange(new Date(concert.startDate), new Date(concert.endDate));
}

function formatReviewSeat(review: HomeReview) {
  if (
    review.seatFloor &&
    review.seatSection &&
    review.seatRow &&
    review.seatNumber
  ) {
    const floorLabel =
      review.seatFloor === "floor" ? "Floor층" : `${review.seatFloor}층`;

    return `${floorLabel} · ${formatSeatCode(review.seatSection)}구역`;
  }

  if (review.zone) {
    return `${review.zone.name} 후기`;
  }

  return "좌석 리뷰";
}

function ConcertCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="aspect-[16/10] animate-pulse bg-secondary" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
        <div className="h-12 animate-pulse rounded bg-secondary" />
        <div className="space-y-1.5">
          <div className="h-4 animate-pulse rounded bg-secondary" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
        </div>
        <div className="h-9 animate-pulse rounded-md bg-secondary" />
      </div>
    </article>
  );
}

function ReviewSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-background px-4 py-3">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-secondary" />
        <div className="h-3 w-44 animate-pulse rounded bg-secondary" />
      </div>
      <div className="h-5 w-12 animate-pulse rounded bg-secondary" />
    </div>
  );
}

function ConcertCard({ concert }: { concert: HomeConcert }) {
  return (
    <article className="overflow-hidden rounded-lg border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/concerts/${concert.id}`} className="block">
        <div className="relative aspect-[16/10] bg-secondary">
          {concert.posterImageUrl ? (
            <Image
              src={concert.posterImageUrl}
              alt={`${concert.title} 포스터`}
              fill
              sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              포스터 준비 중
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
            공연 정보
          </span>
        </div>
      </Link>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold text-primary">{concert.artist}</p>
          <h3 className="mt-1 line-clamp-2 min-h-12 text-base font-black">
            {concert.title}
          </h3>
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {formatConcertDateRange(concert)}
          </p>
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {concert.venueName}
          </p>
        </div>
        <div className="grid">
          <Button asChild variant="outline" size="sm">
            <Link href={`/concerts/${concert.id}`}>상세보기</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export function HomeDynamicSections() {
  const [homeData, setHomeData] = useState<HomeData>(initialHomeData);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHomeData() {
      try {
        const response = await fetch("/api/home", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to load home data");
        }

        const payload = (await response.json()) as HomeDataResponse;

        if (!controller.signal.aborted) {
          setHomeData(payload.data ?? initialHomeData);
          setHasError(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setHomeData(initialHomeData);
          setHasError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadHomeData();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <>
      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">다가오는 공연</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              공연일이 가까운 순서로 보여드립니다.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/concerts">
              더보기
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <ConcertCardSkeleton key={index} />
            ))}
          </div>
        ) : homeData.featuredConcerts.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {homeData.featuredConcerts.map((concert) => (
              <ConcertCard key={concert.id} concert={concert} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
            {hasError
              ? "공연 정보를 불러오지 못했습니다."
              : "표시할 공연이 없습니다."}
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">최근 등록된 리뷰</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                좌석 구역별 시야와 만족도를 확인해보세요.
              </p>
            </div>
            <MessageSquare className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <div className="mt-5 grid gap-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <ReviewSkeleton key={index} />
              ))
            ) : homeData.recentReviews.length > 0 ? (
              homeData.recentReviews.map((review) => (
                <Link
                  key={review.id}
                  href={`/concerts/${review.concert.id}/reviews`}
                  className="flex items-center justify-between gap-4 rounded-md border bg-background px-4 py-3 transition hover:border-primary/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {formatReviewSeat(review)}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {review.concert.title}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                    <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                    {review.satisfactionScore.toFixed(1)}
                  </span>
                </Link>
              ))
            ) : (
              <div className="rounded-md border bg-secondary px-4 py-8 text-center text-sm text-muted-foreground">
                {hasError
                  ? "리뷰 정보를 불러오지 못했습니다."
                  : "아직 등록된 리뷰가 없습니다."}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-primary/5 p-6 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-[120px_1fr] sm:items-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UploadCloud className="h-12 w-12" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-black">티켓팅 연습이 처음인가요?</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                좌석 배치도를 등록하고 AI 분석을 완료하면 공연별 연습 흐름을
                바로 시작할 수 있습니다.
              </p>
              <Button asChild variant="outline" className="mt-5">
                <Link href="/concerts">
                  연습할 공연 찾기
                  <Ticket className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
