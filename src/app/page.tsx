import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  MessageSquare,
  Sparkles,
  Star,
  Ticket,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getConcertList } from "@/lib/concerts";
import { prisma } from "@/lib/prisma";
import { formatDateRange } from "@/utils/format";
import homeBannerImage from "../../home-banner-homeblend.png";

async function getRecentReviews() {
  return prisma.review.findMany({
    include: {
      concert: {
        select: {
          id: true,
          title: true,
          artist: true,
        },
      },
      zone: {
        select: {
          name: true,
          grade: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 3,
  });
}

function formatReviewSeat(review: Awaited<ReturnType<typeof getRecentReviews>>[number]) {
  if (
    review.seatFloor &&
    review.seatSection &&
    review.seatRow &&
    review.seatNumber
  ) {
    const floorLabel =
      review.seatFloor === "floor" ? "floor층" : `${review.seatFloor}층`;

    return `${floorLabel} · ${review.seatSection}구역`;
  }

  if (review.zone) {
    return `${review.zone.name} 후기`;
  }

  return "좌석 리뷰";
}

export default async function Home() {
  const [user, recentReviews] = await Promise.all([
    getCurrentUser(),
    getRecentReviews(),
  ]);
  const concerts = await getConcertList({
    scope: "upcoming",
    seatMapOwnerId: user?.id ?? null,
  });
  const featuredConcerts = concerts.slice(0, 4);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-5 py-8 sm:px-8">
      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="grid min-h-[330px] gap-8 p-8 lg:grid-cols-[1fr_0.92fr] lg:p-10">
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              실전형 티켓팅 연습
            </span>
            <h1 className="mt-6 max-w-2xl text-4xl font-black leading-tight tracking-normal text-foreground sm:text-5xl">
              실전처럼 연습하고,
              <span className="block text-primary">좋은 좌석을 잡아보세요!</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              공연을 고르고 좌석 배치도를 분석한 뒤, 예매 흐름과 좌석 선택을
              반복해서 연습할 수 있습니다.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/concerts">
                  공연 둘러보기
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/concerts">티켓팅 연습 시작</Link>
              </Button>
            </div>
          </div>

          <div className="relative min-h-[240px] lg:min-h-[280px]">
            <Image
              src={homeBannerImage}
              alt="티켓팅 연습 홈 배너"
              fill
              priority
              sizes="(min-width: 1024px) 520px, 100vw"
              className="object-contain"
            />
          </div>
        </div>
      </section>

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

        {featuredConcerts.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredConcerts.map((concert) => (
              <article
                key={concert.id}
                className="overflow-hidden rounded-lg border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
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
                      {concert.hasSeatMap ? "분석 가능" : "배치도 필요"}
                    </span>
                  </div>
                </Link>
                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      {concert.artist}
                    </p>
                    <h3 className="mt-1 line-clamp-2 min-h-12 text-base font-black">
                      {concert.title}
                    </h3>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatDateRange(concert.startDate, concert.endDate)}
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
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
            표시할 공연이 없습니다.
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
            {recentReviews.length > 0 ? (
              recentReviews.map((review) => (
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
                아직 등록된 리뷰가 없습니다.
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
    </main>
  );
}
